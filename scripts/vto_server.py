"""
VTO HTTP server — runs on Daniel's RunPod pod (with FitDiT pre-installed).
Started automatically when the pod boots via the pod's start command:
  cd /workspace && git pull && python SeekSuit/scripts/vto_server.py

Exposes:
  GET  /health          — liveness check
  POST /vto             — run VTO for one garment across all models
"""

import os
import re
import sys
import time
import types
import io
import ipaddress
import socket
from pathlib import Path
from urllib.parse import urlparse

import requests
import numpy as np
from PIL import Image, ImageFilter
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Shared secret the backend sends on every request — set same value in .env
VTO_POD_SECRET = os.environ.get("VTO_POD_SECRET", "")
ALLOWED_SUPABASE_HOST = os.environ.get("SUPABASE_URL", "").replace("https://", "").split("/")[0]
PRODUCT_ID_RE = re.compile(r'^[A-Za-z0-9_-]+$')


def _validate_garment_url(url: str) -> None:
    """Reject non-HTTPS, non-Supabase, and RFC-1918/loopback URLs (SSRF guard)."""
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise HTTPException(status_code=400, detail="garment_url must use https")
    if ALLOWED_SUPABASE_HOST and parsed.hostname != ALLOWED_SUPABASE_HOST:
        raise HTTPException(status_code=400, detail="garment_url must point to project storage")
    # Resolve DNS and reject private/loopback addresses
    try:
        addr = ipaddress.ip_address(socket.gethostbyname(parsed.hostname or ""))
        if addr.is_private or addr.is_loopback or addr.is_link_local:
            raise HTTPException(status_code=400, detail="garment_url resolves to a private address")
    except (socket.gaierror, ValueError):
        raise HTTPException(status_code=400, detail="garment_url DNS resolution failed")

# ── Bootstrap FitDiT ─────────────────────────────────────────────────────────
FITDIT_DIR = Path(os.environ.get("FITDIT_DIR", "/workspace/FitDiT"))
sys.path.insert(0, str(FITDIT_DIR))

mock_gr = types.ModuleType("gradio")
sys.modules.setdefault("gradio", mock_gr)

os.chdir(str(FITDIT_DIR))

from gradio_sd3 import FitDiTGenerator  # noqa: E402

MODEL_ROOT = str(FITDIT_DIR)
DEVICE     = "cuda:0"
STEPS      = 20
SCALE      = 2.0
SEED       = 42
RESOLUTION = "768x1024"

SCRIPTS_DIR = Path(__file__).parent
MODELS_DIR  = SCRIPTS_DIR / "vto_models"

# Supabase
from supabase import create_client  # noqa: E402

SUPABASE_URL              = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
VTO_BUCKET                = "vto-results"

_supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Lazy-loaded FitDiT — survives across requests (pod is always-on)
_fitdit: FitDiTGenerator | None = None


# ── Reuse helpers from runpod_handler ────────────────────────────────────────

def _make_jacket_atr_mask(original, fitdit, pre_mask_template):
    import copy
    from preprocess.humanparsing.run_parsing import Parsing
    parsing = getattr(fitdit, "parsing_model", None) or Parsing(model_root=MODEL_ROOT, device="cpu")
    parse_result, _ = parsing(original.convert("RGB").resize((384, 512)))
    parse_arr = np.array(parse_result)
    mask_384 = (parse_arr == 4).astype(np.uint8) * 255
    mask_img = Image.fromarray(mask_384, "L")
    mask_img = mask_img.filter(ImageFilter.MaxFilter(size=15))
    mask_img = mask_img.filter(ImageFilter.MinFilter(size=7))
    ph, pw = pre_mask_template["layers"][0][:, :, 3].shape
    mask_fitdit = np.array(mask_img.resize((pw, ph), Image.NEAREST))
    import copy
    modified = copy.deepcopy(pre_mask_template)
    modified["layers"][0][:, :, 3] = mask_fitdit
    return modified, mask_img


def _composite_with_mask(fitdit_result, original, mask_img):
    orig = original.convert("RGB")
    ow, oh = orig.size
    fitdit_full  = fitdit_result.resize((ow, oh), Image.LANCZOS)
    garment_mask = mask_img.resize((ow, oh), Image.LANCZOS).filter(ImageFilter.GaussianBlur(radius=2))
    return Image.composite(fitdit_full, orig, garment_mask)


def _atr_vest_points(fitdit_result, fitdit, w, h):
    from preprocess.humanparsing.run_parsing import Parsing
    parsing = getattr(fitdit, "parsing_model", None) or Parsing(model_root=MODEL_ROOT, device="cpu")
    parse_result, _ = parsing(fitdit_result.convert("RGB").resize((384, 512)))
    upper = np.array(parse_result) == 4
    ys, xs = np.where(upper)
    if len(xs) < 10:
        return (int(w * 0.38), int(h * 0.40)), (int(w * 0.62), int(h * 0.40))
    mid = upper.shape[1] // 2
    lm, rm = xs < mid, xs >= mid
    sx, sy = w / 384, h / 512
    lx = int(xs[lm].mean() * sx) if lm.any() else int(w * 0.38)
    ly = int(ys[lm].mean() * sy) if lm.any() else int(h * 0.40)
    rx = int(xs[rm].mean() * sx) if rm.any() else int(w * 0.62)
    ry = int(ys[rm].mean() * sy) if rm.any() else int(h * 0.40)
    return (lx, ly), (rx, ry)


_sam2_predictor = None


def _get_sam2():
    global _sam2_predictor
    if _sam2_predictor is None:
        import torch
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        _sam2_predictor = SAM2ImagePredictor.from_pretrained("facebook/sam2.1-hiera-large")
        _sam2_predictor.model.eval()
    return _sam2_predictor


def _composite_vest_sam2(fitdit_result, original, fitdit):
    import torch
    w, h = fitdit_result.size
    orig = original.convert("RGB").resize((w, h), Image.LANCZOS)
    (lx, ly), (rx, ry) = _atr_vest_points(fitdit_result, fitdit, w, h)
    predictor = _get_sam2()
    with torch.inference_mode():
        predictor.set_image(np.array(fitdit_result.convert("RGB")))
        masks, _, _ = predictor.predict(
            point_coords=np.array([[lx, ly], [rx, ry]]),
            point_labels=np.array([1, 1]),
            multimask_output=False,
        )
    mask_arr = masks[0].astype(np.uint8) * 255
    if mask_arr.mean() > 127:
        mask_arr = 255 - mask_arr
    if mask_arr.mean() < 5:
        return fitdit_result
    vest_mask = Image.fromarray(mask_arr, "L")
    vest_mask = vest_mask.filter(ImageFilter.MaxFilter(size=15))
    vest_mask = vest_mask.filter(ImageFilter.MinFilter(size=13))
    vest_mask = vest_mask.filter(ImageFilter.GaussianBlur(radius=1))
    return Image.composite(fitdit_result, orig, vest_mask)


def _upload_to_supabase(img: Image.Image, path: str) -> str:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    buf.seek(0)
    _supabase.storage.from_(VTO_BUCKET).upload(
        path, buf.read(), {"content-type": "image/jpeg", "upsert": "true"}
    )
    signed = _supabase.storage.from_(VTO_BUCKET).create_signed_url(
        path, 60 * 60 * 24 * 365 * 10
    )
    url = signed.get("signedURL") or signed.get("signedUrl")
    if not url:
        raise RuntimeError(f"Failed to get signed URL for {path}")
    return url


def _collect_models():
    if not MODELS_DIR.exists():
        raise RuntimeError(f"Models directory not found: {MODELS_DIR}")
    result = []
    for model_dir in sorted(d for d in MODELS_DIR.iterdir() if d.is_dir()):
        photos = sorted(model_dir.glob("*.jpg")) + sorted(model_dir.glob("*.png"))
        photos = [p for p in photos if not p.stem.endswith(("_mask", "_auto_mask"))]
        if photos:
            result.append((model_dir.name, photos[0]))
    return result


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title="SeekSuit VTO Server")
# Restrict CORS to backend origin only — pod is not a public API
_backend_origin = os.environ.get("BACKEND_ORIGIN", "http://localhost:5000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_backend_origin],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


class VTORequest(BaseModel):
    garment_url:     str
    garment_type:    str = "JACKETS"
    product_id:      str = "unknown"
    source_image_id: str = "unknown"


def _check_auth(authorization: str | None) -> None:
    if not VTO_POD_SECRET:
        return  # secret not configured — skip (dev mode)
    if authorization != f"Bearer {VTO_POD_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health():
    return {"status": "ok", "fitdit_ready": _fitdit is not None}


@app.post("/vto")
def run_vto(req: VTORequest, authorization: str | None = Header(default=None)):
    _check_auth(authorization)

    garment_type = req.garment_type.upper()

    if not PRODUCT_ID_RE.match(req.product_id):
        raise HTTPException(status_code=400, detail="Invalid product_id")

    _validate_garment_url(req.garment_url)

    # Download garment image
    resp = requests.get(req.garment_url, timeout=30)
    resp.raise_for_status()
    garment_path = Path("/tmp/vto_garment.jpg")
    garment_path.write_bytes(resp.content)

    if _fitdit is None:
        print("[VTO] Loading FitDiT...")
        _fitdit = FitDiTGenerator(model_root=MODEL_ROOT, offload=True, device=DEVICE)
        print("[VTO] FitDiT ready")

    models = _collect_models()
    if not models:
        raise HTTPException(status_code=500, detail="No model photos found in vto_models/")

    results = []

    for model_key, photo_path in models:
        print(f"[VTO] Processing {model_key}...")
        try:
            person_pil = Image.open(photo_path).convert("RGB")
            tmp_person = Path("/tmp/vto_person.jpg")
            person_pil.save(str(tmp_person), quality=95)

            pre_mask, pose_img = _fitdit.generate_mask(
                str(tmp_person), "Upper-body", 0, 0, 0, 0
            )

            if garment_type == "JACKETS":
                process_mask, mask_img = _make_jacket_atr_mask(person_pil, _fitdit, pre_mask)
            else:
                process_mask = pre_mask
                mask_img     = None

            result_img = _fitdit.process(
                vton_img=str(tmp_person),
                garm_img=str(garment_path),
                pre_mask=process_mask,
                pose_image=np.array(pose_img),
                n_steps=STEPS,
                image_scale=SCALE,
                seed=SEED,
                num_images_per_prompt=1,
                resolution=RESOLUTION,
            )[0]

            if garment_type == "VESTS":
                result_img = _composite_vest_sam2(result_img, person_pil, _fitdit)
            elif mask_img is not None:
                result_img = _composite_with_mask(result_img, person_pil, mask_img)

            ts = int(time.time() * 1000)
            supabase_path = f"{req.product_id}/{model_key}_{ts}.jpg"
            url = _upload_to_supabase(result_img, supabase_path)

            results.append({"modelKey": model_key, "url": url})
            print(f"[VTO] {model_key} → ok")

        except Exception as e:
            print(f"[VTO] {model_key} FAILED: {e}")

    return {"results": results}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

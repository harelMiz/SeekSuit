"""
RunPod Serverless handler for SeekSuit VTO.

Input:
  {
    "garment_url":     "https://...",
    "garment_type":    "JACKETS" | "VESTS",
    "product_id":      "...",
    "source_image_id": "..."
  }

Output:
  { "results": [{ "modelKey": "model_01_0", "url": "https://...", "storagePath": "prod-id/model_01_0_ts.jpg" }, ...] }

Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

import os
import sys
import time
import io
from pathlib import Path

# ── Constants (no heavy imports at module level) ──────────────────────────────

FITDIT_DIR  = Path(os.environ.get("FITDIT_DIR",  "/workspace/FitDiT"))       # source code
FITDIT_CKPT = Path(os.environ.get("FITDIT_CKPT", "/workspace/FitDiT/ckpt"))  # model weights
MODEL_ROOT  = str(FITDIT_CKPT)
DEVICE     = "cuda:0"
STEPS      = 20
SCALE      = 2.0
SEED       = 42
RESOLUTION = "768x1024"
VTO_BUCKET = "vto-results"
MODELS_DIR    = Path(__file__).parent / "vto_models"
VTO_MODELS_BUCKET = "vto-models"

SUPABASE_URL              = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# Lazy singletons — initialized on first job, reused across warm invocations
_fitdit    = None
_supabase  = None


def _get_supabase():
    global _supabase
    if _supabase is None:
        from supabase import create_client
        _supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _supabase


def _get_fitdit():
    global _fitdit
    if _fitdit is None:
        import types
        mock_gr = types.ModuleType("gradio")
        sys.modules.setdefault("gradio", mock_gr)
        sys.path.insert(0, str(FITDIT_DIR))
        os.chdir(str(FITDIT_DIR))
        from gradio_sd3 import FitDiTGenerator
        from huggingface_hub import try_to_load_from_cache
        clip_cached = try_to_load_from_cache("laion/CLIP-ViT-bigG-14-laion2B-39B-b160k", "config.json")
        print(f"[VTO] CLIP-bigG in cache: {clip_cached is not None} ({clip_cached})")
        print("[VTO] Loading FitDiT...")
        _fitdit = FitDiTGenerator(model_root=MODEL_ROOT, offload=True, device=DEVICE)
        clip_cached_after = try_to_load_from_cache("laion/CLIP-ViT-bigG-14-laion2B-39B-b160k", "config.json")
        print(f"[VTO] CLIP-bigG in cache after init: {clip_cached_after is not None} ({clip_cached_after})")
        print("[VTO] FitDiT ready")
    return _fitdit


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_jacket_atr_mask(original, fitdit, pre_mask_template):
    import copy
    import numpy as np
    from PIL import Image, ImageFilter
    from preprocess.humanparsing.run_parsing import Parsing

    parsing = getattr(fitdit, "parsing_model", None) or Parsing(model_root=MODEL_ROOT, device="cpu")
    parse_result, _ = parsing(original.convert("RGB").resize((384, 512)))
    parse_arr = np.array(parse_result)
    mask_384  = (parse_arr == 4).astype(np.uint8) * 255
    mask_img  = Image.fromarray(mask_384, "L")
    mask_img  = mask_img.filter(ImageFilter.MaxFilter(size=15))
    mask_img  = mask_img.filter(ImageFilter.MinFilter(size=7))
    ph, pw    = pre_mask_template["layers"][0][:, :, 3].shape
    mask_fitdit = np.array(mask_img.resize((pw, ph), Image.NEAREST))
    modified  = copy.deepcopy(pre_mask_template)
    modified["layers"][0][:, :, 3] = mask_fitdit
    return modified, mask_img


def _composite_with_mask(fitdit_result, original, mask_img):
    from PIL import Image, ImageFilter
    orig         = original.convert("RGB")
    ow, oh       = orig.size
    fitdit_full  = fitdit_result.resize((ow, oh), Image.LANCZOS)
    garment_mask = mask_img.resize((ow, oh), Image.LANCZOS).filter(ImageFilter.GaussianBlur(radius=2))
    return Image.composite(fitdit_full, orig, garment_mask)


_sam2_predictor = None


def _get_sam2():
    global _sam2_predictor
    if _sam2_predictor is None:
        import torch
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        _sam2_predictor = SAM2ImagePredictor.from_pretrained("facebook/sam2.1-hiera-large")
        _sam2_predictor.model.eval()
    return _sam2_predictor


def _atr_vest_points(fitdit_result, fitdit, w, h):
    import numpy as np
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


def _composite_vest_sam2(fitdit_result, original, fitdit):
    import torch
    import numpy as np
    from PIL import Image, ImageFilter
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


def _upload_to_supabase(img, path: str) -> str:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    buf.seek(0)
    sb = _get_supabase()
    sb.storage.from_(VTO_BUCKET).upload(path, buf.read(), {"content-type": "image/jpeg", "upsert": "true"})
    signed = sb.storage.from_(VTO_BUCKET).create_signed_url(path, 60 * 60 * 24 * 365 * 10)
    url = signed.get("signedURL") or signed.get("signedUrl")
    if not url:
        raise RuntimeError(f"Failed to get signed URL for {path}")
    return url


# Cache model photos per worker lifetime — downloaded once on first job
_models_cache: list | None = None


def _collect_models() -> list:
    """Return (modelKey, path) pairs — downloads from Supabase vto-models bucket on first call."""
    global _models_cache
    if _models_cache is not None:
        return _models_cache

    _models_cache = _load_models_from_bucket()
    return _models_cache


def _load_models_from_bucket() -> list:
    tmp_dir = Path("/tmp/vto_models")
    tmp_dir.mkdir(parents=True, exist_ok=True)

    sb = _get_supabase()
    try:
        files = sb.storage.from_(VTO_MODELS_BUCKET).list()
    except Exception as e:
        print(f"[VTO] Warning: failed to list {VTO_MODELS_BUCKET} bucket: {e}")
        files = []

    downloaded: list[Path] = []
    for f in sorted(files, key=lambda x: x["name"]):
        name = f["name"]
        if not name.lower().endswith((".jpg", ".jpeg", ".png")):
            continue
        try:
            data = sb.storage.from_(VTO_MODELS_BUCKET).download(name)
            dest = tmp_dir / name
            dest.write_bytes(data)
            downloaded.append(dest)
            print(f"[VTO] Downloaded model photo: {name}")
        except Exception as e:
            print(f"[VTO] Warning: failed to download {name}: {e}")

    if not downloaded:
        print("[VTO] vto-models bucket empty — falling back to local vto_models/")
        return _load_models_local()

    return [(p.stem, p) for p in downloaded]


def _load_models_local() -> list:
    if not MODELS_DIR.exists():
        raise RuntimeError(f"No models found: bucket empty and {MODELS_DIR} does not exist")
    result = []
    for model_dir in sorted(d for d in MODELS_DIR.iterdir() if d.is_dir()):
        photos = sorted(model_dir.glob("*.jpg")) + sorted(model_dir.glob("*.png"))
        photos = [p for p in photos if not p.stem.endswith(("_mask", "_auto_mask"))]
        for idx, photo in enumerate(photos):
            key = f"{model_dir.name}_{idx}" if len(photos) > 1 else model_dir.name
            result.append((key, photo))
    return result


# ── Main handler ──────────────────────────────────────────────────────────────

def handler(job):
    import numpy as np
    from PIL import Image
    import requests

    job_input    = job["input"]
    garment_url  = job_input["garment_url"]
    garment_type = job_input.get("garment_type", "JACKETS").upper()
    product_id   = job_input.get("product_id", "unknown")
    source_id    = job_input.get("source_image_id", "unknown")
    seed         = int(job_input.get("seed", SEED))

    print(f"[VTO] product={product_id}  type={garment_type}  source={source_id}")

    resp = requests.get(garment_url, timeout=30)
    resp.raise_for_status()
    garment_path = Path("/tmp/vto_garment.jpg")
    garment_path.write_bytes(resp.content)

    fitdit = _get_fitdit()
    models = _collect_models()
    if not models:
        return {"error": "No model photos found in vto_models/"}

    results = []

    for model_key, photo_path in models:
        print(f"[VTO] Processing {model_key}...")
        try:
            person_pil = Image.open(photo_path).convert("RGB")
            tmp_person = Path("/tmp/vto_person.jpg")
            person_pil.save(str(tmp_person), quality=95)

            pre_mask, pose_img = fitdit.generate_mask(str(tmp_person), "Upper-body", 0, 0, 0, 0)

            result_img = fitdit.process(
                vton_img=str(tmp_person),
                garm_img=str(garment_path),
                pre_mask=pre_mask,
                pose_image=np.array(pose_img),
                n_steps=STEPS,
                image_scale=SCALE,
                seed=seed,
                num_images_per_prompt=1,
                resolution=RESOLUTION,
            )[0]

            if garment_type == "VESTS":
                result_img = _composite_vest_sam2(result_img, person_pil, fitdit)

            ts            = int(time.time() * 1000)
            supabase_path = f"{product_id}/{model_key}_{ts}.jpg"
            url           = _upload_to_supabase(result_img, supabase_path)

            results.append({"modelKey": model_key, "url": url, "storagePath": supabase_path})
            print(f"[VTO] {model_key} → ok")

        except Exception as e:
            print(f"[VTO] {model_key} FAILED: {e}")

    return {"results": results}

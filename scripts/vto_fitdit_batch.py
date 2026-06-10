"""
FitDiT batch VTO — puts JACKETS and VESTS on the model (upper-body only).

Both types: SAM2 segments just the garment from the FitDiT result (dynamic ATR
points), then composites onto the original model image so the face, shirt,
background and pants stay at full original resolution and quality.

VESTS:   MaxFilter+MinFilter applied to fill holes in the vest body.
JACKETS: No hole-filling (preserves lapel/collar opening).

Setup (run once):
  python scripts/vto_fitdit_download.py
  pip install sam2

Usage:
  cd /workspace/SeekSuit
  python scripts/vto_fitdit_batch.py --one          # quick test: 1 garment
  python scripts/vto_fitdit_batch.py --type VESTS   # vests only
  python scripts/vto_fitdit_batch.py --type JACKETS
  python scripts/vto_fitdit_batch.py                # full batch
"""

import sys
import types
import argparse
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

FITDIT_DIR = Path("/workspace/FitDiT")
sys.path.insert(0, str(FITDIT_DIR))

mock_gr = types.ModuleType("gradio")
sys.modules.setdefault("gradio", mock_gr)

os.chdir(str(FITDIT_DIR))

from gradio_sd3 import FitDiTGenerator

SCRIPTS_DIR = Path(__file__).parent
SAMPLES_DIR = SCRIPTS_DIR / "vto_samples"
OUTPUT_DIR  = SCRIPTS_DIR / "vto_results_fitdit"
MODEL_IMAGE = SCRIPTS_DIR.parent / "Management" / "Architecture" / "model.png"

MODEL_ROOT = str(FITDIT_DIR)
DEVICE     = "cuda:0"
STEPS      = 20
SCALE      = 2.0
SEED       = 42
RESOLUTION = "768x1024"

UPPER_TYPES = {"JACKETS", "VESTS"}


# ---------------------------------------------------------------------------
# SAM2 with dynamic ATR points — shared by JACKETS and VESTS
# ---------------------------------------------------------------------------

_sam2_predictor = None


def _get_sam2_predictor():
    global _sam2_predictor
    if _sam2_predictor is None:
        import torch
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        print("[SAM2] Loading model (first use — downloads ~300 MB)...")
        _sam2_predictor = SAM2ImagePredictor.from_pretrained("facebook/sam2.1-hiera-large")
        _sam2_predictor.model.eval()
        print("[SAM2] Ready.")
    return _sam2_predictor


def _atr_upper_points(fitdit_result: Image.Image, fitdit, w: int, h: int, ptype: str):
    """Return dynamic SAM2 foreground points derived from ATR class-4 centroids."""
    parsing = getattr(fitdit, "parsing_model", None)
    if parsing is None:
        from preprocess.humanparsing.run_parsing import Parsing
        parsing = Parsing(model_root=MODEL_ROOT, device="cpu")

    parse_result, _ = parsing(fitdit_result.convert("RGB").resize((384, 512)))
    upper = np.array(parse_result) == 4

    ys, xs = np.where(upper)
    if len(xs) < 10:
        return (int(w * 0.38), int(h * 0.40)), (int(w * 0.62), int(h * 0.40))

    mid = upper.shape[1] // 2
    lm, rm = xs < mid, xs >= mid
    sx, sy = w / 384, h / 512

    if lm.any() and rm.any():
        lx, ly = int(xs[lm].mean() * sx), int(ys[lm].mean() * sy)
        rx, ry = int(xs[rm].mean() * sx), int(ys[rm].mean() * sy)
    else:
        lx, ly = int(w * 0.38), int(h * 0.40)
        rx, ry = int(w * 0.62), int(h * 0.40)

    print(f"[ATR] {ptype} points: L=({lx},{ly})  R=({rx},{ry})")
    return (lx, ly), (rx, ry)


def _composite_with_sam2(
    fitdit_result: Image.Image,
    original: Image.Image,
    fitdit,
    ptype: str,
    debug_dir: Path | None = None,
    stem: str = "garment",
) -> Image.Image:
    import torch

    w, h = fitdit_result.size
    orig = original.convert("RGB").resize((w, h), Image.LANCZOS)

    if debug_dir:
        fitdit_result.save(str(debug_dir / f"{stem}_raw.jpg"), quality=92)

    (lx, ly), (rx, ry) = _atr_upper_points(fitdit_result, fitdit, w, h, ptype)

    predictor = _get_sam2_predictor()
    with torch.inference_mode():
        predictor.set_image(np.array(fitdit_result.convert("RGB")))
        masks, scores, _ = predictor.predict(
            point_coords=np.array([[lx, ly], [rx, ry]]),
            point_labels=np.array([1, 1]),
            multimask_output=False,
        )

    mask_arr = masks[0].astype(np.uint8) * 255
    coverage = mask_arr.mean()
    print(f"[SAM2] coverage: {coverage:.1f}/255")

    if coverage > 127:
        mask_arr = 255 - mask_arr
        print(f"[SAM2] inverted → {mask_arr.mean():.1f}/255")

    if debug_dir:
        Image.fromarray(mask_arr, "L").save(str(debug_dir / f"{stem}_mask.jpg"))

    if mask_arr.mean() < 5:
        print("[SAM2] empty mask — using plain FitDiT result")
        return fitdit_result

    garment_mask = Image.fromarray(mask_arr, "L")

    if ptype == "VESTS":
        garment_mask = garment_mask.filter(ImageFilter.MaxFilter(size=15))
        garment_mask = garment_mask.filter(ImageFilter.MinFilter(size=13))

    garment_mask = garment_mask.filter(ImageFilter.GaussianBlur(radius=1))
    return Image.composite(fitdit_result, orig, garment_mask)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_person_path() -> Path:
    for p in [MODEL_IMAGE, MODEL_IMAGE.with_suffix(".jpg")]:
        if p.exists():
            return p
    print(f"[ERROR] model image not found at {MODEL_IMAGE}")
    sys.exit(1)


def collect_samples() -> list:
    items = []
    for d in sorted(SAMPLES_DIR.iterdir()):
        if not d.is_dir() or d.name not in UPPER_TYPES:
            continue
        for img in sorted(d.glob("*.jpg")):
            items.append((d.name, img))
    return items


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--one",  action="store_true", help="Run only the first garment")
    parser.add_argument("--type", choices=["JACKETS", "VESTS"], help="Run only this garment type")
    args = parser.parse_args()

    person_path = get_person_path()
    temp_person = SCRIPTS_DIR / "temp_model_rgb.jpg"
    OUTPUT_DIR.mkdir(exist_ok=True)
    Image.open(person_path).convert("RGB").save(str(temp_person), quality=95)
    person_path = temp_person

    samples = collect_samples()
    if not samples:
        print(f"[ERROR] No images in {SAMPLES_DIR}")
        sys.exit(1)
    if args.type:
        samples = [(t, p) for t, p in samples if t == args.type]
    if args.one:
        samples = samples[:1]
        print("Quick test — 1 garment.\n")

    print("Loading FitDiT...")
    fitdit = FitDiTGenerator(model_root=MODEL_ROOT, offload=True, device=DEVICE)

    person_pil = Image.open(person_path).convert("RGB")

    print(f"\n{len(samples)} garment(s)...\n")

    cached_mask = None
    ok = err = 0

    for ptype, img_path in samples:
        vto_dir   = OUTPUT_DIR / ptype / "vto"
        debug_dir = OUTPUT_DIR / ptype / "debug"
        vto_dir.mkdir(parents=True, exist_ok=True)
        debug_dir.mkdir(parents=True, exist_ok=True)
        out_path = vto_dir / f"{img_path.stem}_vto.jpg"

        print(f"  [{ptype}] {img_path.stem} ... ", end="", flush=True)
        try:
            if cached_mask is None:
                pre_mask, pose_img = fitdit.generate_mask(
                    str(person_path), "Upper-body", 0, 0, 0, 0,
                )
                cached_mask = (pre_mask, np.array(pose_img))
            pre_mask, pose_arr = cached_mask

            result = fitdit.process(
                vton_img=str(person_path),
                garm_img=str(img_path),
                pre_mask=pre_mask,
                pose_image=pose_arr,
                n_steps=STEPS,
                image_scale=SCALE,
                seed=SEED,
                num_images_per_prompt=1,
                resolution=RESOLUTION,
            )[0]

            if ptype in ("JACKETS", "VESTS"):
                result = _composite_with_sam2(result, person_pil, fitdit, ptype, debug_dir=debug_dir, stem=img_path.stem)

            result.save(out_path, quality=92)
            print("ok")
            ok += 1
        except Exception as e:
            import traceback
            print(f"FAIL  {e}")
            traceback.print_exc()
            err += 1

    if temp_person.exists():
        temp_person.unlink(missing_ok=True)

    print(f"\nDone — {ok} ok, {err} failed")
    print(f"Results: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()

"""
FitDiT batch VTO — puts JACKETS and VESTS on model photos.

JACKETS: FitDiT result composited onto original using FitDiT's own pre_mask,
         preserving original resolution for face/background/pants.
VESTS:   SAM2 segments just the vest from the FitDiT result (dynamic ATR points),
         then composites onto original to preserve the original shirt and arms.

Folder layout
-------------
scripts/vto_models/
    model_01/photo_01.jpg, photo_02.jpg, ...
    model_02/photo_01.jpg, ...

scripts/vto_samples/
    JACKETS/suit_002_front.jpg, ...
    VESTS/vest_001_front.jpg, ...

Results
-------
scripts/vto_results_fitdit/
    suit_002_front/
        model_1_Caucasian_1_vto.jpg
        model_2_black_1_vto.jpg
        model_2_black_2_vto.jpg
        ...
    vest_001_front/
        model_1_Caucasian_1_vto.jpg
        ...

Setup (run once):
  python scripts/vto_fitdit_download.py
  pip install sam2

Usage:
  cd /workspace/SeekSuit
  python scripts/vto_fitdit_batch.py                       # all models, all garments
  python scripts/vto_fitdit_batch.py --model model_01      # one model only
  python scripts/vto_fitdit_batch.py --type JACKETS        # garment type filter
  python scripts/vto_fitdit_batch.py --one                 # quick test: 1 model/photo/garment
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

SCRIPTS_DIR  = Path(__file__).parent
MODELS_DIR   = SCRIPTS_DIR / "vto_models"
SAMPLES_DIR  = SCRIPTS_DIR / "vto_samples"
OUTPUT_DIR   = SCRIPTS_DIR / "vto_results_fitdit"
TEMP_PERSON  = SCRIPTS_DIR / "temp_model_rgb.jpg"

MODEL_ROOT = str(FITDIT_DIR)
DEVICE     = "cuda:0"
STEPS      = 20
SCALE      = 2.0
SEED       = 42
RESOLUTION = "768x1024"

UPPER_TYPES = {"JACKETS", "VESTS"}


# ---------------------------------------------------------------------------
# JACKETS — composite via FitDiT pre_mask (preserves original resolution)
# ---------------------------------------------------------------------------

def _composite_jacket(
    fitdit_result: Image.Image,
    original: Image.Image,
    pre_mask: dict,
) -> Image.Image:
    orig = original.convert("RGB")
    ow, oh = orig.size
    fitdit_full = fitdit_result.resize((ow, oh), Image.LANCZOS)
    mask_arr = pre_mask["layers"][0][:, :, 3]   # 255 = garment region
    garment_mask = Image.fromarray(mask_arr, "L").filter(ImageFilter.GaussianBlur(radius=3))
    return Image.composite(fitdit_full, orig, garment_mask)


# ---------------------------------------------------------------------------
# VESTS — SAM2 with dynamic ATR points
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


def _atr_upper_points(fitdit_result: Image.Image, fitdit, w: int, h: int):
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

    print(f"[ATR] vest points: L=({lx},{ly})  R=({rx},{ry})")
    return (lx, ly), (rx, ry)


def _composite_with_sam2(
    fitdit_result: Image.Image,
    original: Image.Image,
    fitdit,
    debug_dir: Path | None = None,
    stem: str = "vest",
) -> Image.Image:
    import torch

    w, h = fitdit_result.size
    orig = original.convert("RGB").resize((w, h), Image.LANCZOS)

    if debug_dir:
        fitdit_result.save(str(debug_dir / f"{stem}_raw.jpg"), quality=92)

    (lx, ly), (rx, ry) = _atr_upper_points(fitdit_result, fitdit, w, h)

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

    vest_mask = Image.fromarray(mask_arr, "L")
    vest_mask = vest_mask.filter(ImageFilter.MaxFilter(size=15))
    vest_mask = vest_mask.filter(ImageFilter.MinFilter(size=13))
    vest_mask = vest_mask.filter(ImageFilter.GaussianBlur(radius=1))
    return Image.composite(fitdit_result, orig, vest_mask)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def collect_models(model_filter: str | None) -> list[Path]:
    if not MODELS_DIR.exists():
        print(f"[ERROR] Models folder not found: {MODELS_DIR}")
        sys.exit(1)
    dirs = sorted(d for d in MODELS_DIR.iterdir() if d.is_dir())
    if model_filter:
        dirs = [d for d in dirs if d.name == model_filter]
    if not dirs:
        print(f"[ERROR] No model folders found in {MODELS_DIR}")
        sys.exit(1)
    return dirs


def collect_photos(model_dir: Path) -> list[Path]:
    photos = sorted(model_dir.glob("*.jpg")) + sorted(model_dir.glob("*.png"))
    return photos


def collect_garments(type_filter: str | None) -> list[tuple[str, Path]]:
    items = []
    for d in sorted(SAMPLES_DIR.iterdir()):
        if not d.is_dir() or d.name not in UPPER_TYPES:
            continue
        if type_filter and d.name != type_filter:
            continue
        for img in sorted(d.glob("*.jpg")):
            items.append((d.name, img))
    return items


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--one",   action="store_true", help="Quick test: first model/photo/garment only")
    parser.add_argument("--model", help="Run only this model folder (e.g. model_01)")
    parser.add_argument("--type",  choices=["JACKETS", "VESTS"], help="Run only this garment type")
    args = parser.parse_args()

    models   = collect_models(args.model)
    garments = collect_garments(args.type)

    if not garments:
        print(f"[ERROR] No garment images found in {SAMPLES_DIR}")
        sys.exit(1)

    if args.one:
        models   = models[:1]
        garments = garments[:1]
        print("Quick test — 1 model / 1 photo / 1 garment.\n")

    print("Loading FitDiT...")
    fitdit = FitDiTGenerator(model_root=MODEL_ROOT, offload=True, device=DEVICE)
    OUTPUT_DIR.mkdir(exist_ok=True)

    total_ok = total_err = 0

    for model_dir in models:
        photos = collect_photos(model_dir)
        if not photos:
            print(f"[WARN] No photos in {model_dir}, skipping.")
            continue

        if args.one:
            photos = photos[:1]

        print(f"\nModel: {model_dir.name}  ({len(photos)} photo(s), {len(garments)} garment(s))")

        for photo_path in photos:
            print(f"  Photo: {photo_path.name}")

            person_pil = Image.open(photo_path).convert("RGB")
            person_pil.save(str(TEMP_PERSON), quality=95)

            cached_mask = None

            for ptype, garment_path in garments:
                out_dir = OUTPUT_DIR / garment_path.stem
                out_dir.mkdir(parents=True, exist_ok=True)
                out_path = out_dir / f"{photo_path.stem}_vto.jpg"

                debug_dir = out_dir / "debug"

                print(f"    [{ptype}] {garment_path.stem} ... ", end="", flush=True)
                try:
                    if cached_mask is None:
                        pre_mask, pose_img = fitdit.generate_mask(
                            str(TEMP_PERSON), "Upper-body", 0, 0, 0, 0,
                        )
                        cached_mask = (pre_mask, np.array(pose_img))
                    pre_mask, pose_arr = cached_mask

                    result = fitdit.process(
                        vton_img=str(TEMP_PERSON),
                        garm_img=str(garment_path),
                        pre_mask=pre_mask,
                        pose_image=pose_arr,
                        n_steps=STEPS,
                        image_scale=SCALE,
                        seed=SEED,
                        num_images_per_prompt=1,
                        resolution=RESOLUTION,
                    )[0]

                    if ptype == "JACKETS":
                        result = _composite_jacket(result, person_pil, pre_mask)
                    elif ptype == "VESTS":
                        debug_dir.mkdir(parents=True, exist_ok=True)
                        result = _composite_with_sam2(
                            result, person_pil, fitdit,
                            debug_dir=debug_dir,
                            stem=f"{photo_path.stem}_{garment_path.stem}",
                        )

                    result.save(out_path, quality=92)
                    print("ok")
                    total_ok += 1
                except Exception as e:
                    import traceback
                    print(f"FAIL  {e}")
                    traceback.print_exc()
                    total_err += 1

    if TEMP_PERSON.exists():
        TEMP_PERSON.unlink(missing_ok=True)

    print(f"\nDone — {total_ok} ok, {total_err} failed")
    print(f"Results: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()

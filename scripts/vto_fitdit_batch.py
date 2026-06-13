"""
FitDiT batch VTO — puts JACKETS and VESTS on model photos.

JACKETS: FitDiT result composited onto original using FitDiT's pre_mask.
VESTS:   SAM2 segments the vest from the FitDiT result (ATR-guided points),
         then composites onto original to preserve shirt and arms.

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
        ...

Setup (run once on RunPod):
  python scripts/vto_fitdit_download.py
  pip install sam2

Usage:
  python scripts/vto_fitdit_batch.py                   # all models, all garments
  python scripts/vto_fitdit_batch.py --model model_01  # one model only
  python scripts/vto_fitdit_batch.py --type JACKETS    # garment type filter
  python scripts/vto_fitdit_batch.py --garment suit_002_front
  python scripts/vto_fitdit_batch.py --one             # quick test: 1 model/photo/garment
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
MODELS_DIR  = SCRIPTS_DIR / "vto_models"
SAMPLES_DIR = SCRIPTS_DIR / "vto_samples"
OUTPUT_DIR  = SCRIPTS_DIR / "vto_results_fitdit"
TEMP_PERSON = SCRIPTS_DIR / "temp_model_rgb.jpg"

MODEL_ROOT = str(FITDIT_DIR)
DEVICE     = "cuda:0"
STEPS      = 20
SCALE      = 2.0
SEED       = 42
RESOLUTION = "768x1024"

UPPER_TYPES = {"JACKETS", "VESTS"}


# ---------------------------------------------------------------------------
# Custom mask — override FitDiT's auto mask with a locally edited one
# ---------------------------------------------------------------------------

def _apply_custom_mask(pre_mask: dict, photo_path: Path) -> dict:
    mask_path = photo_path.parent / f"{photo_path.stem}_mask.png"
    if not mask_path.exists():
        return pre_mask

    import copy
    ph, pw = pre_mask["layers"][0][:, :, 3].shape
    custom = np.array(
        Image.open(mask_path).convert("L").resize((pw, ph), Image.NEAREST)
    )
    result = copy.deepcopy(pre_mask)
    result["layers"][0][:, :, 3] = custom
    print(f"[mask] custom mask: {mask_path.name}  ({custom.mean()/255*100:.1f}% coverage)")
    return result


# ---------------------------------------------------------------------------
# JACKETS — composite via ATR parsing (precise jacket + sleeve mask)
# ---------------------------------------------------------------------------

_parsing_model = None


def _get_parsing_model(fitdit):
    global _parsing_model
    if _parsing_model is None:
        _parsing_model = getattr(fitdit, "parsing_model", None)
    if _parsing_model is None:
        from preprocess.humanparsing.run_parsing import Parsing
        _parsing_model = Parsing(model_root=MODEL_ROOT, device="cpu")
    return _parsing_model


def _composite_jacket_atr(
    fitdit_result: Image.Image,
    original: Image.Image,
    fitdit,
) -> Image.Image:
    parsing = _get_parsing_model(fitdit)
    parse_result, _ = parsing(fitdit_result.convert("RGB").resize((384, 512)))
    parse_arr = np.array(parse_result)

    # class 4 = upper-clothes (jacket body + sleeves); arms (14/15) excluded to avoid wrist artifacts
    jacket_mask = (parse_arr == 4).astype(np.uint8) * 255
    coverage = jacket_mask.mean() / 255 * 100
    print(f"[ATR] jacket coverage: {coverage:.1f}%")

    mask_img = Image.fromarray(jacket_mask, "L")
    mask_img = mask_img.filter(ImageFilter.MaxFilter(size=9))
    mask_img = mask_img.filter(ImageFilter.MinFilter(size=5))

    orig = original.convert("RGB")
    ow, oh = orig.size
    fitdit_full = fitdit_result.resize((ow, oh), Image.LANCZOS)
    garment_mask = mask_img.resize((ow, oh), Image.LANCZOS).filter(ImageFilter.GaussianBlur(radius=1))

    return Image.composite(fitdit_full, orig, garment_mask)


# ---------------------------------------------------------------------------
# VESTS — SAM2 with ATR-guided points
# ---------------------------------------------------------------------------

_sam2_predictor = None


def _get_sam2_predictor():
    global _sam2_predictor
    if _sam2_predictor is None:
        import torch
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        print("[SAM2] loading model...")
        _sam2_predictor = SAM2ImagePredictor.from_pretrained("facebook/sam2.1-hiera-large")
        _sam2_predictor.model.eval()
        print("[SAM2] ready.")
    return _sam2_predictor


def _atr_vest_points(fitdit_result: Image.Image, fitdit, w: int, h: int):
    parsing = _get_parsing_model(fitdit)

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


def _composite_vest_sam2(
    fitdit_result: Image.Image,
    original: Image.Image,
    fitdit,
) -> Image.Image:
    import torch

    w, h = fitdit_result.size
    orig = original.convert("RGB").resize((w, h), Image.LANCZOS)

    (lx, ly), (rx, ry) = _atr_vest_points(fitdit_result, fitdit, w, h)

    predictor = _get_sam2_predictor()
    with torch.inference_mode():
        predictor.set_image(np.array(fitdit_result.convert("RGB")))
        masks, _, _ = predictor.predict(
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
    return [p for p in photos if not p.stem.endswith(("_mask", "_auto_mask"))]


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
    parser.add_argument("--one",     action="store_true", help="Quick test: 1 model/photo/garment")
    parser.add_argument("--model",   help="Run only this model folder (e.g. model_01)")
    parser.add_argument("--type",    choices=["JACKETS", "VESTS"], help="Garment type filter")
    parser.add_argument("--garment", help="Run only this garment stem (e.g. suit_002_front)")
    args = parser.parse_args()

    models   = collect_models(args.model)
    garments = collect_garments(args.type)

    if args.garment:
        garments = [(t, p) for t, p in garments if p.stem == args.garment]
        if not garments:
            print(f"[ERROR] Garment '{args.garment}' not found in {SAMPLES_DIR}")
            sys.exit(1)

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
                out_dir  = OUTPUT_DIR / garment_path.stem
                out_dir.mkdir(parents=True, exist_ok=True)
                out_path = out_dir / f"{photo_path.stem}_vto.jpg"

                print(f"    [{ptype}] {garment_path.stem} ... ", end="", flush=True)
                try:
                    if cached_mask is None:
                        pre_mask, pose_img = fitdit.generate_mask(
                            str(TEMP_PERSON), "Upper-body", 0, 0, 0, 0,
                        )
                        cached_mask = (pre_mask, np.array(pose_img))

                        auto_mask_path = photo_path.parent / f"{photo_path.stem}_auto_mask.png"
                        if not auto_mask_path.exists():
                            mask_arr = pre_mask["layers"][0][:, :, 3]
                            Image.fromarray(mask_arr, "L").save(str(auto_mask_path))
                            print(f"[mask] saved auto mask: {auto_mask_path.name}")

                    pre_mask, pose_arr = cached_mask
                    process_mask = _apply_custom_mask(pre_mask, photo_path)

                    result = fitdit.process(
                        vton_img=str(TEMP_PERSON),
                        garm_img=str(garment_path),
                        pre_mask=process_mask,
                        pose_image=pose_arr,
                        n_steps=STEPS,
                        image_scale=SCALE,
                        seed=SEED,
                        num_images_per_prompt=1,
                        resolution=RESOLUTION,
                    )[0]

                    if ptype == "JACKETS":
                        result = _composite_jacket_atr(result, person_pil, fitdit)
                    elif ptype == "VESTS":
                        result = _composite_vest_sam2(result, person_pil, fitdit)

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

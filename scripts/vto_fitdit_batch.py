"""
FitDiT batch VTO — puts JACKETS and VESTS on the model (upper-body only).

For VESTS: after FitDiT generates the result, SAM2 segments just the vest
(using a point prompt in the chest area), and the vest is composited onto
the original model image so the original shirt and arms are preserved.

Setup (run once):
  python scripts/vto_fitdit_download.py
  pip install sam2

Usage:
  cd /workspace/SeekSuit
  python scripts/vto_fitdit_batch.py --one          # quick test: 1 garment
  python scripts/vto_fitdit_batch.py --type VESTS   # vests only
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


def _atr_upper_mask(fitdit_result: Image.Image, fitdit, w: int, h: int):
    """
    Run ATR parsing on the FitDiT result and return:
      - points: ((lx,ly), (rx,ry)) — left/right centroids of class-4 region
      - upper_bool: (h, w) boolean array of class-4 pixels at full image size
    Falls back to fixed percentages if ATR finds nothing.
    """
    parsing = getattr(fitdit, "parsing_model", None)
    if parsing is None:
        from preprocess.humanparsing.run_parsing import Parsing
        parsing = Parsing(model_root=MODEL_ROOT, device="cpu")

    parse_result, _ = parsing(fitdit_result.convert("RGB").resize((384, 512)))
    upper = np.array(parse_result) == 4  # class 4 = upper clothes

    # Scale ATR mask to full image size
    upper_full = np.array(
        Image.fromarray(upper.astype(np.uint8) * 255, "L")
        .resize((w, h), Image.BILINEAR)
    ) > 128

    ys, xs = np.where(upper)
    if len(xs) < 10:
        print("[ATR] No upper-body pixels found, using fixed fallback points")
        return (int(w * 0.38), int(h * 0.40)), (int(w * 0.62), int(h * 0.40)), upper_full

    mid = upper.shape[1] // 2
    left_m  = xs < mid
    right_m = xs >= mid
    scale_x, scale_y = w / 384, h / 512

    if left_m.any() and right_m.any():
        lx = int(xs[left_m].mean()  * scale_x)
        ly = int(ys[left_m].mean()  * scale_y)
        rx = int(xs[right_m].mean() * scale_x)
        ry = int(ys[right_m].mean() * scale_y)
    else:
        lx, ly = int(w * 0.38), int(h * 0.40)
        rx, ry = int(w * 0.62), int(h * 0.40)

    print(f"[ATR] Vest points: L=({lx},{ly})  R=({rx},{ry})")
    return (lx, ly), (rx, ry), upper_full


def _extract_vest_with_sam2(
    fitdit_result: Image.Image,
    original: Image.Image,
    fitdit,
    debug_dir: Path | None = None,
    stem: str = "vest",
) -> Image.Image:
    """
    Segment just the vest from the FitDiT result using SAM2, then composite
    the vest pixels onto the original model image.

    SAM2 foreground points are derived dynamically from ATR parsing so they
    always land on the vest regardless of model pose.
    """
    import torch

    w, h = fitdit_result.size
    orig = original.convert("RGB").resize((w, h), Image.LANCZOS)

    if debug_dir:
        fitdit_result.save(str(debug_dir / f"{stem}_raw.jpg"), quality=92)

    predictor = _get_sam2_predictor()

    (lx, ly), (rx, ry), atr_upper = _atr_upper_mask(fitdit_result, fitdit, w, h)
    points = np.array([[lx, ly], [rx, ry]])
    labels = np.array([1, 1])

    with torch.inference_mode():
        predictor.set_image(np.array(fitdit_result.convert("RGB")))
        masks, scores, _ = predictor.predict(
            point_coords=points,
            point_labels=labels,
            multimask_output=False,
        )

    mask_arr = masks[0].astype(np.uint8) * 255
    coverage = mask_arr.mean()
    print(f"[SAM2] mask coverage: {coverage:.1f}/255")

    # If coverage > 50% SAM2 likely selected the background — invert
    if coverage > 127:
        mask_arr = 255 - mask_arr
        coverage = mask_arr.mean()
        print(f"[SAM2] Inverted (was background). New coverage: {coverage:.1f}/255")

    if debug_dir:
        Image.fromarray(mask_arr, "L").save(str(debug_dir / f"{stem}_mask.jpg"))

    if coverage < 5:
        print("[SAM2] Empty mask — returning plain FitDiT result")
        return fitdit_result

    mask_arr = (mask_arr > 0).astype(np.uint8) * 255
    vest_mask = Image.fromarray(mask_arr, "L")
    vest_mask = vest_mask.filter(ImageFilter.MaxFilter(size=15))  # fill holes
    vest_mask = vest_mask.filter(ImageFilter.MinFilter(size=13))  # restore outer edge
    vest_mask = vest_mask.filter(ImageFilter.GaussianBlur(radius=1))
    return Image.composite(fitdit_result, orig, vest_mask)


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

            if ptype in ("VESTS", "JACKETS"):
                result = _extract_vest_with_sam2(result, person_pil, fitdit, debug_dir=debug_dir, stem=img_path.stem)

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

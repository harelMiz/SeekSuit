"""
FitDiT batch VTO — puts JACKETS and VESTS on the model (upper-body only).

The model image should already have pants in the desired color.
Generate one model image per pants color and run this script with each.

Post-processing:
  VESTS   — original arm/sleeve pixels composited back (preserves shirt sleeves).
  JACKETS — sleeve pixels below the original wrist boundary restored from original
            so over-long generated sleeves are hidden and the shirt cuff shows.

Setup (run once):
  python scripts/vto_fitdit_download.py

Usage:
  cd /workspace/SeekSuit
  python scripts/vto_fitdit_batch.py --one   # quick test: 1 garment
  python scripts/vto_fitdit_batch.py         # full batch
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

# ATR parsing class indices for arms
_ARM_CLASSES = [14, 15]  # 14=left-arm, 15=right-arm


def _load_parsing(fitdit):
    """Reuse FitDiT's parsing model, or create a new instance if needed."""
    p = getattr(fitdit, "parsing_model", None)
    if p is not None:
        return p
    from preprocess.humanparsing.run_parsing import Parsing
    return Parsing(model_root=MODEL_ROOT, device="cpu")


def _parse_person(parsing, person_img: Image.Image) -> np.ndarray:
    parse_out, _ = parsing(person_img.convert("RGB").resize((384, 512)))
    return np.array(parse_out)


def _arm_bool(parse_arr: np.ndarray) -> np.ndarray:
    """
    Boolean mask of the arm/sleeve region.
    Long-sleeve shirt sleeves are classified as upper-clothes (class 4).
    We include class 4 + arm (14/15) in the outer 40% of columns where
    sleeves appear, covering the full arm from shoulder to wrist.
    """
    PH, PW = parse_arr.shape
    arm = np.isin(parse_arr, _ARM_CLASSES)
    outer = int(PW * 0.40)
    upper = (parse_arr == 4)
    arm[:, :outer] |= upper[:, :outer]
    arm[:, -outer:] |= upper[:, -outer:]
    return arm


def _build_arm_mask(parse_arr: np.ndarray) -> Image.Image:
    """L-mode mask of the arm/sleeve region for vest post-processing."""
    pixels = _arm_bool(parse_arr).astype(np.uint8) * 255
    mask = Image.fromarray(pixels, mode="L")
    # Dilate to fill arm region solidly, then blur only the edges
    mask = mask.filter(ImageFilter.MaxFilter(size=19))
    mask = mask.filter(ImageFilter.GaussianBlur(radius=3))
    return mask


def _build_sleeve_trim_mask(parse_arr: np.ndarray) -> Image.Image:
    """
    L-mode mask of pixels BELOW the wrist in each arm column.
    Restores the original wrist/hand area on jacket results so
    over-long generated sleeves are hidden and the shirt cuff shows.
    """
    PH, PW = parse_arr.shape
    arm = _arm_bool(parse_arr)
    trim = np.zeros((PH, PW), dtype=np.uint8)
    for c in range(PW):
        rows = np.where(arm[:, c])[0]
        if len(rows) == 0:
            continue
        bottom = int(rows.max())
        if bottom + 1 < PH:
            trim[bottom + 1:, c] = 255
    return Image.fromarray(trim, mode="L").filter(ImageFilter.GaussianBlur(radius=4))


def _composite_original(
    result: Image.Image,
    original: Image.Image,
    mask_small: Image.Image,
) -> Image.Image:
    """Where mask=255 use original pixels, where mask=0 keep VTO result."""
    w, h = result.size
    mask = mask_small.resize((w, h), Image.BILINEAR)
    orig = original.convert("RGB").resize((w, h), Image.LANCZOS)
    return Image.composite(orig, result, mask)


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
    parser.add_argument("--one", action="store_true", help="Run only the first garment")
    parser.add_argument("--type", choices=["JACKETS", "VESTS"], help="Run only this garment type")
    args = parser.parse_args()

    person_path = get_person_path()
    temp_person = SCRIPTS_DIR / "temp_model_rgb.jpg"
    OUTPUT_DIR.mkdir(exist_ok=True)

    person_pil = Image.open(person_path).convert("RGB")
    person_pil.save(str(temp_person), quality=95)
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

    # Build masks once — reused for all garments
    print("Loading parsing model and computing arm masks...")
    parsing   = _load_parsing(fitdit)
    parse_arr = _parse_person(parsing, person_pil)
    print(f"  Parse classes found: {np.unique(parse_arr).tolist()}")
    print(f"  Raw arm pixels (cls 14+15): {np.isin(parse_arr, _ARM_CLASSES).sum()}")
    arm_mask    = _build_arm_mask(parse_arr)
    sleeve_trim = _build_sleeve_trim_mask(parse_arr)
    print(f"  arm_mask nonzero (>10): {(np.array(arm_mask) > 10).sum()}")
    print(f"  sleeve_trim nonzero (>10): {(np.array(sleeve_trim) > 10).sum()}")
    arm_mask.save(str(OUTPUT_DIR / "debug_arm_mask.png"))
    sleeve_trim.save(str(OUTPUT_DIR / "debug_sleeve_trim.png"))
    print("Masks ready. (saved debug PNGs to vto_results_fitdit/)\n")

    print(f"{len(samples)} garment(s)...\n")

    cached_mask = None
    ok = err = 0

    for ptype, img_path in samples:
        out_dir = OUTPUT_DIR / ptype
        out_dir.mkdir(exist_ok=True)
        out_path = out_dir / f"{img_path.stem}_vto.jpg"

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

            # Post-processing per garment type
            if ptype == "VESTS":
                result = _composite_original(result, person_pil, arm_mask)
            elif ptype == "JACKETS":
                result = _composite_original(result, person_pil, sleeve_trim)

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

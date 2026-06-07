"""
FitDiT batch VTO — two-pass inference per garment:
  Pass 1: Upper-body  — puts JACKETS / VESTS on the model
  Pass 2: Lower-body  — puts the closest-color pants on the Pass-1 result

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


def get_jacket_rgb(jacket_path: Path) -> np.ndarray:
    from PIL import Image
    arr = np.array(Image.open(jacket_path).convert("RGB"))
    non_bg = arr[arr.mean(axis=2) < 210]
    return non_bg.mean(axis=0) if len(non_bg) else np.array([50.0, 50.0, 60.0])


def recolor_pants(vto_img, jacket_rgb: np.ndarray, waist_frac: float = 0.40):
    """Recolor gray pants in the lower body to match the jacket color."""
    from PIL import Image
    arr = np.array(vto_img).astype(float)
    waist_y = int(arr.shape[0] * waist_frac)
    lower = arr[waist_y:]

    r, g, b = lower[:,:,0], lower[:,:,1], lower[:,:,2]
    lum = r * 0.299 + g * 0.587 + b * 0.114
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    sat = (max_c - min_c) / np.maximum(max_c, 1.0)

    # Gray pants pixels: low saturation, not background, not shadows
    is_pants = (sat < 0.25) & (lum > 40) & (lum < 230)

    lum_norm = lum / 255.0
    jR, jG, jB = jacket_rgb
    lower[:,:,0] = np.where(is_pants, np.clip(lum_norm * jR, 0, 255), r)
    lower[:,:,1] = np.where(is_pants, np.clip(lum_norm * jG, 0, 255), g)
    lower[:,:,2] = np.where(is_pants, np.clip(lum_norm * jB, 0, 255), b)

    arr[waist_y:] = lower
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


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
    args = parser.parse_args()

    from PIL import Image
    person_path = get_person_path()
    temp_person = SCRIPTS_DIR / "temp_model_rgb.jpg"
    OUTPUT_DIR.mkdir(exist_ok=True)
    Image.open(person_path).convert("RGB").save(str(temp_person), quality=95)
    person_path = temp_person
    samples = collect_samples()
    if not samples:
        print(f"[ERROR] No images in {SAMPLES_DIR}")
        sys.exit(1)
    if args.one:
        samples = samples[:1]
        print("Quick test — 1 garment.\n")

    print("Loading FitDiT...")
    fitdit = FitDiTGenerator(model_root=MODEL_ROOT, offload=True, device=DEVICE)

    print(f"\n{len(samples)} garment(s)...\n")

    cached_masks = {}
    ok = err = 0

    for ptype, img_path in samples:
        out_dir = OUTPUT_DIR / ptype
        out_dir.mkdir(exist_ok=True)
        out_path = out_dir / f"{img_path.stem}_vto.jpg"

        print(f"  [{ptype}] {img_path.stem} ...", end="", flush=True)
        try:
            # FitDiT upper-body — puts jacket/vest on model, gray pants preserved
            if "Upper-body" not in cached_masks:
                pre_mask, pose_img = fitdit.generate_mask(
                    str(person_path), "Upper-body", 0, 0, 0, 0,
                )
                cached_masks["Upper-body"] = (pre_mask, np.array(pose_img))
            pre_mask_u, pose_arr_u = cached_masks["Upper-body"]

            vto_upper = fitdit.process(
                vton_img=str(person_path),
                garm_img=str(img_path),
                pre_mask=pre_mask_u,
                pose_image=pose_arr_u,
                n_steps=STEPS,
                image_scale=SCALE,
                seed=SEED,
                num_images_per_prompt=1,
                resolution=RESOLUTION,
            )[0]
            print(" jacket ok", end="", flush=True)

            # PIL recolor — gray pants → jacket color (no second model pass)
            jacket_rgb = get_jacket_rgb(img_path)
            final = recolor_pants(vto_upper, jacket_rgb)
            print(" pants recolor ok", flush=True)

            final.save(out_path, quality=92)
            ok += 1
        except Exception as e:
            import traceback
            print(f" FAIL  {e}")
            traceback.print_exc()
            err += 1

    if temp_person.exists():
        temp_person.unlink(missing_ok=True)

    print(f"\nDone — {ok} ok, {err} failed")
    print(f"Results: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()

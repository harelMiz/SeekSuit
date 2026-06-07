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
from PIL import Image

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


def recolor_with_mask(img, jacket_rgb: np.ndarray, pants_mask: np.ndarray):
    """Recolor pixels inside pants_mask to jacket color, preserving luminance."""
    arr = np.array(img).astype(float)
    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255.0
    jR, jG, jB = jacket_rgb
    arr[:,:,0] = np.where(pants_mask, np.clip(lum * jR, 0, 255), r)
    arr[:,:,1] = np.where(pants_mask, np.clip(lum * jG, 0, 255), g)
    arr[:,:,2] = np.where(pants_mask, np.clip(lum * jB, 0, 255), b)
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

            # Get FitDiT pants mask and recolor gray → jacket color
            if "Lower-body" not in cached_masks:
                pre_mask_l, _ = fitdit.generate_mask(
                    str(person_path), "Lower-body", 0, 0, 0, 0,
                )
                cached_masks["Lower-body"] = pre_mask_l
            pre_mask_l = cached_masks["Lower-body"]

            # Alpha channel of layers[0] is the pants region mask (0-255)
            mask_raw = pre_mask_l["layers"][0][:,:,3]
            mask_img = Image.fromarray(mask_raw, mode="L")
            if mask_img.size != vto_upper.size:
                mask_img = mask_img.resize(vto_upper.size, Image.NEAREST)
            pants_mask = np.array(mask_img) > 128

            jacket_rgb = get_jacket_rgb(img_path)
            final = recolor_with_mask(vto_upper, jacket_rgb, pants_mask)

            # Resize back to original model image size
            orig_size = Image.open(person_path).size
            if final.size != orig_size:
                final = final.resize(orig_size, Image.LANCZOS)

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

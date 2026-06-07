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

from gradio_sd3 import FitDiTGenerator, resize_image

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


def get_pants_alpha(fitdit_gen, img: Image, target_size: tuple) -> np.ndarray:
    """Return a soft alpha mask (0.0-1.0) for the pants region.

    Runs FitDiT's ATR parsing model (classes 5=skirt, 6=pants), then applies
    Gaussian blur to feather the edges so the recolor blends smoothly.
    """
    from PIL import ImageFilter
    img_det = resize_image(img)
    model_parse, _ = fitdit_gen.parsing_model(img_det)
    parse_arr = np.array(model_parse)
    hard_mask = np.isin(parse_arr, [5, 6]).astype(np.uint8) * 255
    mask_img = (
        Image.fromarray(hard_mask, mode="L")
        .resize(target_size, Image.BILINEAR)
        .filter(ImageFilter.GaussianBlur(radius=4))
    )
    return np.array(mask_img).astype(float) / 255.0


def recolor_with_alpha(img: Image, jacket_rgb: np.ndarray, alpha: np.ndarray) -> Image:
    """Blend recolored pants into the image using a soft alpha mask."""
    arr = np.array(img).astype(float)
    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255.0
    jR, jG, jB = jacket_rgb
    recolored_r = np.clip(lum * jR, 0, 255)
    recolored_g = np.clip(lum * jG, 0, 255)
    recolored_b = np.clip(lum * jB, 0, 255)
    arr[:,:,0] = alpha * recolored_r + (1 - alpha) * r
    arr[:,:,1] = alpha * recolored_g + (1 - alpha) * g
    arr[:,:,2] = alpha * recolored_b + (1 - alpha) * b
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

            # Soft pants mask from FitDiT's ATR parsing model + Gaussian blur
            pants_alpha = get_pants_alpha(fitdit, vto_upper, vto_upper.size)
            jacket_rgb  = get_jacket_rgb(img_path)
            final = recolor_with_alpha(vto_upper, jacket_rgb, pants_alpha)

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

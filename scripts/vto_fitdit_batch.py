"""
FitDiT batch test — runs garments from vto_samples/ through FitDiT.
Designed to run on RunPod (CUDA GPU required).

Setup (run once on RunPod):
  pip install diffusers==0.31.0 transformers==4.39.3 accelerate==0.31.0 \
              huggingface_hub==0.26.5 onnxruntime opencv-python matplotlib \
              einops scikit-image torch==2.4.0+cu118 torchvision==0.19.0+cu118 \
              --index-url https://download.pytorch.org/whl/cu118
  python scripts/vto_fitdit_download.py

Usage:
  cd /workspace/SeekSuit
  python scripts/vto_fitdit_batch.py --one
  python scripts/vto_fitdit_batch.py
"""

import sys
import types
import argparse
from pathlib import Path

FITDIT_DIR = Path("/workspace/FitDiT")
sys.path.insert(0, str(FITDIT_DIR))

# Mock gradio so we can import from gradio_sd3 without installing it
mock_gr = types.ModuleType("gradio")
sys.modules.setdefault("gradio", mock_gr)

import os
os.chdir(str(FITDIT_DIR))

from gradio_sd3 import FitDiTGenerator, resize_image, pad_and_resize, unpad_and_resize

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

CLOTH_CATEGORY = {
    "JACKETS": "upper_body",
    "VESTS":   "upper_body",
    "PANTS":   "lower_body",
}


def get_person_path() -> Path:
    for p in [MODEL_IMAGE, MODEL_IMAGE.with_suffix(".jpg")]:
        if p.exists():
            return p
    print(f"[ERROR] model image not found at {MODEL_IMAGE}")
    sys.exit(1)


def collect_samples() -> list[tuple[str, Path]]:
    items = []
    for type_dir in sorted(SAMPLES_DIR.iterdir()):
        if not type_dir.is_dir():
            continue
        for img in sorted(type_dir.glob("*.jpg")):
            items.append((type_dir.name, img))
    return items


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--one", action="store_true", help="Run only the first garment")
    args = parser.parse_args()

    from PIL import Image
    person_path = get_person_path()
    # FitDiT requires RGB JPG — convert if model image is PNG/RGBA
    temp_person = OUTPUT_DIR.parent / "temp_model_rgb.jpg"
    OUTPUT_DIR.mkdir(exist_ok=True)
    Image.open(person_path).convert("RGB").save(str(temp_person), quality=95)
    person_path = temp_person

    samples = collect_samples()
    if not samples:
        print(f"[ERROR] No images found in {SAMPLES_DIR}")
        sys.exit(1)
    if args.one:
        samples = samples[:1]
        print("Quick test — 1 garment.\n")

    print("Loading FitDiT model (offload=True to save VRAM)...")
    generator = FitDiTGenerator(model_root=MODEL_ROOT, offload=True, device=DEVICE)

    OUTPUT_DIR.mkdir(exist_ok=True)
    print(f"\nRunning FitDiT for {len(samples)} garment(s)...\n")

    # Pre-generate masks per category (person image is always the same)
    masks = {}

    ok = err = 0
    for ptype, img_path in samples:
        category = CLOTH_CATEGORY.get(ptype, "upper_body")
        out_dir  = OUTPUT_DIR / ptype
        out_dir.mkdir(exist_ok=True)
        out_path = out_dir / f"{img_path.stem}_vto.jpg"

        print(f"  [{ptype}/{category}] {img_path.stem} ... ", end="", flush=True)
        try:
            if category not in masks:
                pre_mask, pose_image = generator.generate_mask(
                    str(person_path), category,
                    offset_top=0, offset_bottom=0, offset_left=0, offset_right=0,
                )
                masks[category] = (pre_mask, pose_image)
            else:
                pre_mask, pose_image = masks[category]

            import numpy as np
            results = generator.process(
                vton_img=str(person_path),
                garm_img=str(img_path),
                pre_mask=pre_mask,
                pose_image=np.array(pose_image) if hasattr(pose_image, '__array__') else pose_image,
                n_steps=STEPS,
                image_scale=SCALE,
                seed=SEED,
                num_images_per_prompt=1,
                resolution=RESOLUTION,
            )
            results[0].save(out_path, quality=92)
            print("ok")
            ok += 1
        except Exception as e:
            import traceback
            print(f"FAIL  {e}")
            traceback.print_exc()
            err += 1

    print(f"\nDone — {ok} ok, {err} failed")
    print(f"Results saved to: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()

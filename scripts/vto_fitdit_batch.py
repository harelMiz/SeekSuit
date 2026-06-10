"""
FitDiT batch VTO — puts JACKETS and VESTS on the model (upper-body only).

The model image should already have pants in the desired color.
Generate one model image per pants color and run this script with each.

For VESTS: the inpainting mask is narrowed to torso-only (outer 25% of
columns zeroed out) so FitDiT never touches the arm area and the original
shirt sleeves are preserved automatically.

Setup (run once):
  python scripts/vto_fitdit_download.py

Usage:
  cd /workspace/SeekSuit
  python scripts/vto_fitdit_batch.py --one          # quick test: 1 garment
  python scripts/vto_fitdit_batch.py --type VESTS   # vests only
  python scripts/vto_fitdit_batch.py                # full batch
"""

import sys
import copy
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


def _paste_vest_onto_original(
    fitdit_result: Image.Image,
    original: Image.Image,
    fitdit,
) -> Image.Image:
    """
    Parse the FitDiT result to find the vest region (ATR class 4),
    then paste only those pixels onto the original model image.
    The original shirt and arms are preserved everywhere else.
    """
    parsing = getattr(fitdit, "parsing_model", None)
    if parsing is None:
        from preprocess.humanparsing.run_parsing import Parsing
        parsing = Parsing(model_root=MODEL_ROOT, device="cpu")

    parse_out, _ = parsing(fitdit_result.convert("RGB").resize((384, 512)))
    vest_pixels = (np.array(parse_out) == 4).astype(np.uint8) * 255
    mask = Image.fromarray(vest_pixels, mode="L")
    mask = mask.filter(ImageFilter.GaussianBlur(radius=2))

    w, h = fitdit_result.size
    mask = mask.resize((w, h), Image.BILINEAR)
    orig = original.convert("RGB").resize((w, h), Image.LANCZOS)
    # Where mask=255: vest pixels from FitDiT result; where mask=0: original
    return Image.composite(fitdit_result, orig, mask)


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

            if ptype == "VESTS":
                result = _paste_vest_onto_original(result, person_pil, fitdit)

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

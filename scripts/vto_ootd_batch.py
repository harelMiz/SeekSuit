"""
OOTDiffusion batch test — runs garments from vto_samples/ through OOTDiffusion.
Designed to run on RunPod (CUDA GPU required).

Setup (run once on RunPod):
  python scripts/vto_ootd_download.py

Usage:
  cd /workspace/SeekSuit
  python scripts/vto_ootd_batch.py --one      # quick test with 1 garment
  python scripts/vto_ootd_batch.py            # run all garments
"""

import sys
import argparse
from pathlib import Path

OOTD_DIR = Path("/workspace/OOTDiffusion")
sys.path.insert(0, str(OOTD_DIR))
sys.path.insert(0, str(OOTD_DIR / "run"))

from PIL import Image
from preprocess.openpose.run_openpose import OpenPose
from preprocess.humanparsing.run_parsing import Parsing
from ootd.inference_ootd_hd import OOTDiffusionHD
from ootd.inference_ootd_dc import OOTDiffusionDC
from utils_ootd import get_mask_location

SCRIPTS_DIR = Path(__file__).parent
SAMPLES_DIR = SCRIPTS_DIR / "vto_samples"
OUTPUT_DIR  = SCRIPTS_DIR / "vto_results_ootd"
MODEL_IMAGE = SCRIPTS_DIR.parent / "Management" / "Architecture" / "model.png"

STEPS    = 20
SCALE    = 2.0
SEED     = 42
N_SAMPLE = 1
GPU_ID   = 0

# hd = upper body only | dc = full body (supports upper + lower)
GARMENT_CONFIG = {
    "JACKETS": {"model_type": "hd", "category": 0, "category_str": "upper_body"},
    "VESTS":   {"model_type": "hd", "category": 0, "category_str": "upper_body"},
    "PANTS":   {"model_type": "dc", "category": 1, "category_str": "lower_body"},
}

CATEGORY_DICT = {0: "upperbody", 1: "lowerbody", 2: "dress"}


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


def run_one(model, openpose_model, parsing_model,
            person: Image.Image, garment: Image.Image,
            model_type: str, category: int, category_str: str) -> Image.Image:

    cloth_img = garment.convert("RGB").resize((768, 1024))
    model_img = person.convert("RGB").resize((768, 1024))

    keypoints    = openpose_model(model_img.resize((384, 512)))
    model_parse, _ = parsing_model(model_img.resize((384, 512)))

    mask, mask_gray = get_mask_location(model_type, category_str, model_parse, keypoints)
    mask       = mask.resize((768, 1024), Image.NEAREST)
    mask_gray  = mask_gray.resize((768, 1024), Image.NEAREST)

    masked_vton = Image.composite(mask_gray, model_img, mask)

    images = model(
        model_type=model_type,
        category=CATEGORY_DICT[category],
        image_garm=cloth_img,
        image_vton=masked_vton,
        mask=mask,
        image_ori=model_img,
        num_samples=N_SAMPLE,
        num_steps=STEPS,
        image_scale=SCALE,
        seed=SEED,
    )
    return images[0]


def process_group(samples, person_img, openpose_model, parsing_model,
                  model_type: str, model_instance, ptype_filter: list):
    ok = err = 0
    for ptype, img_path in samples:
        if ptype not in ptype_filter:
            continue
        cfg = GARMENT_CONFIG[ptype]
        out_dir  = OUTPUT_DIR / ptype
        out_dir.mkdir(exist_ok=True)
        out_path = out_dir / f"{img_path.stem}_vto.jpg"

        print(f"  [{ptype}] {img_path.stem} ... ", end="", flush=True)
        try:
            garment = Image.open(img_path).convert("RGB")
            result  = run_one(
                model_instance, openpose_model, parsing_model,
                person_img, garment,
                cfg["model_type"], cfg["category"], cfg["category_str"],
            )
            result.save(out_path, quality=92)
            print("ok")
            ok += 1
        except Exception as e:
            print(f"FAIL  {e}")
            err += 1
    return ok, err


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--one", action="store_true", help="Run only the first garment")
    args = parser.parse_args()

    person_path = get_person_path()
    samples = collect_samples()
    if not samples:
        print(f"[ERROR] No images found in {SAMPLES_DIR}")
        sys.exit(1)
    if args.one:
        samples = samples[:1]
        print("Quick test — 1 garment.\n")

    OUTPUT_DIR.mkdir(exist_ok=True)

    print("Loading OpenPose and Parsing models...")
    openpose_model = OpenPose(GPU_ID)
    parsing_model  = Parsing(GPU_ID)
    person_img     = Image.open(person_path).convert("RGB")

    total_ok = total_err = 0

    upper_types = [p for p in ["JACKETS", "VESTS"] if any(t == p for t, _ in samples)]
    lower_types = [p for p in ["PANTS"]            if any(t == p for t, _ in samples)]

    if upper_types:
        print("\nLoading OOTDiffusionHD (upper body)...")
        hd_model = OOTDiffusionHD(GPU_ID)
        ok, err = process_group(samples, person_img, openpose_model, parsing_model,
                                "hd", hd_model, upper_types)
        total_ok  += ok
        total_err += err

    if lower_types:
        print("\nLoading OOTDiffusionDC (full body)...")
        dc_model = OOTDiffusionDC(GPU_ID)
        ok, err = process_group(samples, person_img, openpose_model, parsing_model,
                                "dc", dc_model, lower_types)
        total_ok  += ok
        total_err += err

    print(f"\nDone — {total_ok} ok, {total_err} failed")
    print(f"Results saved to: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()

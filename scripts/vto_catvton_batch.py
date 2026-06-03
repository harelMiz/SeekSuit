"""
CatVTON batch test — runs garments from vto_samples/ through CatVTON.
Designed to run on RunPod (CUDA GPU required).

Setup (run once on RunPod):
  pip install torch==2.4.0+cu118 torchvision==0.19.0+cu118 --index-url https://download.pytorch.org/whl/cu118
  pip install diffusers==0.29.2 transformers==4.44.2 accelerate==0.31.0 huggingface-hub==0.24.7 peft

Usage:
  cd /workspace/SeekSuit
  python scripts/vto_catvton_batch.py --one      # test one garment first
  python scripts/vto_catvton_batch.py            # run all garments
"""

import sys
import argparse
from pathlib import Path

CATVTON_DIR = Path("/workspace/CatVTON")
if str(CATVTON_DIR) not in sys.path:
    sys.path.insert(0, str(CATVTON_DIR))

import torch
from PIL import Image
from diffusers.image_processor import VaeImageProcessor
from huggingface_hub import snapshot_download

from model.pipeline import CatVTONPipeline
from model.cloth_masker import AutoMasker
from utils import init_weight_dtype, resize_and_crop, resize_and_padding

REPO_ROOT   = Path(__file__).parent.parent
SCRIPTS_DIR = Path(__file__).parent
SAMPLES_DIR = SCRIPTS_DIR / "vto_samples"
OUTPUT_DIR  = SCRIPTS_DIR / "vto_results"
MODEL_IMAGE = REPO_ROOT / "Management" / "Architecture" / "model.png"

CLOTH_TYPE = {
    "JACKETS": "upper",
    "VESTS":   "upper",
    "PANTS":   "lower",
}

WIDTH  = 768
HEIGHT = 1024
STEPS  = 50
GUIDANCE = 2.5
SEED   = 42


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


def load_models():
    print("Downloading CatVTON weights (first run: ~4 GB)...")
    repo_path = snapshot_download(repo_id="zhengchong/CatVTON")

    print("Loading pipeline...")
    pipeline = CatVTONPipeline(
        base_ckpt="booksforcharlie/stable-diffusion-inpainting",
        attn_ckpt=repo_path,
        attn_ckpt_version="mix",
        weight_dtype=init_weight_dtype("bf16"),
        use_tf32=True,
        device="cuda",
    )

    mask_processor = VaeImageProcessor(
        vae_scale_factor=8,
        do_normalize=False,
        do_binarize=True,
        do_convert_grayscale=True,
    )

    print("Loading AutoMasker (DensePose + SCHP)...")
    automasker = AutoMasker(
        densepose_ckpt=str(Path(repo_path) / "DensePose"),
        schp_ckpt=str(Path(repo_path) / "SCHP"),
        device="cuda",
    )

    return pipeline, mask_processor, automasker


def run_vto(pipeline, mask_processor, automasker,
            person: Image.Image, garment: Image.Image, cloth_type: str) -> Image.Image:
    person  = resize_and_crop(person,  (WIDTH, HEIGHT))
    garment = resize_and_padding(garment, (WIDTH, HEIGHT))

    mask = automasker(person, cloth_type)["mask"]
    mask = mask_processor.blur(mask, blur_factor=9)

    generator = torch.Generator(device="cuda").manual_seed(SEED)
    result = pipeline(
        image=person,
        condition_image=garment,
        mask=mask,
        num_inference_steps=STEPS,
        guidance_scale=GUIDANCE,
        generator=generator,
    )[0]
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--one", action="store_true", help="Run only the first garment as a quick test")
    args = parser.parse_args()

    person_path = get_person_path()
    samples = collect_samples()
    if not samples:
        print(f"[ERROR] No images found in {SAMPLES_DIR}")
        sys.exit(1)

    if args.one:
        samples = samples[:1]
        print("Quick test — 1 garment.\n")

    pipeline, mask_processor, automasker = load_models()

    person_img = Image.open(person_path).convert("RGB")

    OUTPUT_DIR.mkdir(exist_ok=True)
    print(f"\nRunning VTO for {len(samples)} garment(s)...\n")

    ok = err = 0
    for ptype, img_path in samples:
        cloth_type = CLOTH_TYPE.get(ptype, "upper")
        out_dir  = OUTPUT_DIR / ptype
        out_dir.mkdir(exist_ok=True)
        out_path = out_dir / f"{img_path.stem}_vto.jpg"

        print(f"  [{ptype}/{cloth_type}] {img_path.stem} ... ", end="", flush=True)
        try:
            garment = Image.open(img_path).convert("RGB")
            result  = run_vto(pipeline, mask_processor, automasker, person_img, garment, cloth_type)
            result.save(out_path, quality=92)
            print("ok")
            ok += 1
        except Exception as e:
            print(f"FAIL  {e}")
            err += 1

    print(f"\nDone — {ok} ok, {err} failed")
    print(f"Results saved to: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()

"""
VTO Batch Test — runs garments from vto_samples/ through the Kolors VTO model.
Designed to run on RunPod (GPU required).

Folder structure expected:
  vto_samples/
    JACKET/  *.jpg
    VEST/    *.jpg
    PANTS/   *.jpg

Output saved to:
  vto_results/
    JACKET/  <sku>_vto.jpg
    VEST/    <sku>_vto.jpg
    PANTS/   <sku>_vto.jpg

Usage (on RunPod):
  pip install diffusers transformers accelerate huggingface_hub Pillow torch
  python vto_batch_test.py
"""

import sys, shutil, time
from pathlib import Path
import torch
from PIL import Image

SAMPLES_DIR = Path(__file__).parent / "vto_samples"
OUTPUT_DIR  = Path(__file__).parent / "vto_results"
MODEL_IMAGE = Path(__file__).parent / "model.png"
SEED        = 42
STEPS       = 30
GUIDANCE    = 2.0


def load_pipeline():
    from huggingface_hub import snapshot_download
    from diffusers import DiffusionPipeline

    print("Downloading Kolors-VTO weights (first run only, ~15 GB)...")
    snapshot_download("Kwai-Kolors/Kolors-Virtual-Try-On", local_dir="./kolors_vto_weights")

    print("Loading pipeline...")
    pipe = DiffusionPipeline.from_pretrained(
        "./kolors_vto_weights",
        torch_dtype=torch.float16,
        use_safetensors=True,
    ).to("cuda")
    pipe.enable_model_cpu_offload()
    return pipe


def run_vto(pipe, garment: Image.Image, model_person: Image.Image) -> Image.Image:
    generator = torch.Generator("cuda").manual_seed(SEED)
    result = pipe(
        image=model_person.resize((768, 1024)),
        condition_image=garment.resize((768, 1024)),
        num_inference_steps=STEPS,
        guidance_scale=GUIDANCE,
        generator=generator,
    ).images[0]
    return result


def collect_samples() -> list[tuple[str, Path]]:
    """Returns [(product_type, image_path), ...] sorted by type."""
    items = []
    for type_dir in sorted(SAMPLES_DIR.iterdir()):
        if not type_dir.is_dir():
            continue
        for img in sorted(type_dir.glob("*.jpg")):
            items.append((type_dir.name, img))
    return items


def main():
    if not MODEL_IMAGE.exists():
        # Also check .jpg fallback
        jpg = MODEL_IMAGE.with_suffix(".jpg")
        if jpg.exists():
            model_img = Image.open(jpg).convert("RGB")
        else:
            print(f"[ERROR] model.png not found at {MODEL_IMAGE}")
            sys.exit(1)
    else:
        model_img = Image.open(MODEL_IMAGE).convert("RGB")

    samples = collect_samples()
    if not samples:
        print(f"[ERROR] No images found in {SAMPLES_DIR}")
        print("        Run vto_prepare_samples.py first to download garment images.")
        sys.exit(1)

    OUTPUT_DIR.mkdir(exist_ok=True)
    print(f"Found {len(samples)} garments to test\n")

    pipe = load_pipeline()

    ok = err = 0
    for ptype, img_path in samples:
        out_dir = OUTPUT_DIR / ptype
        out_dir.mkdir(exist_ok=True)
        out_path = out_dir / f"{img_path.stem}_vto.jpg"

        print(f"  [{ptype}] {img_path.stem} ... ", end="", flush=True)
        try:
            garment = Image.open(img_path).convert("RGB")
            result  = run_vto(pipe, garment, model_img)
            result.save(out_path, quality=92)
            print("✓")
            ok += 1
        except Exception as e:
            print(f"✗  {e}")
            err += 1

    print(f"\nDone — {ok} succeeded, {err} failed")
    print(f"Results in: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()

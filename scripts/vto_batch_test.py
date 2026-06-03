"""
VTO Batch Test — runs garments from vto_samples/ through the Kolors VTO model.
Designed to run on RunPod (GPU required).

Folder structure expected:
  scripts/vto_samples/
    JACKETS/  *.jpg
    VESTS/    *.jpg
    PANTS/    *.jpg

Output saved to:
  scripts/vto_results/
    JACKETS/  <sku>_vto.jpg
    VESTS/    <sku>_vto.jpg
    PANTS/    <sku>_vto.jpg

Usage (on RunPod):
  Step 1 — discover the model API (run once, share output with Claude):
    pip install huggingface_hub
    python scripts/discover_kolors.py

  Step 2 — run the batch after load_pipeline() is confirmed:
    pip install diffusers transformers accelerate huggingface_hub Pillow torch
    python scripts/vto_batch_test.py
"""

import sys
from pathlib import Path
import torch
from PIL import Image

REPO_ROOT   = Path(__file__).parent.parent
SCRIPTS_DIR = Path(__file__).parent
SAMPLES_DIR = SCRIPTS_DIR / "vto_samples"
OUTPUT_DIR  = SCRIPTS_DIR / "vto_results"
MODEL_IMAGE = REPO_ROOT / "Management" / "Architecture" / "model.png"
WEIGHTS_DIR = Path("./kolors_vto_space")

SEED     = 42
STEPS    = 30
GUIDANCE = 2.0


def load_pipeline():
    """
    Load the Kolors-VTO inference pipeline.

    IMPORTANT: run discover_kolors.py first to confirm the correct
    pipeline class and call signature for this model.  The code below
    is a best-guess placeholder and will be updated once app.py is known.
    """
    if not WEIGHTS_DIR.exists():
        raise FileNotFoundError(
            f"Weights not found at {WEIGHTS_DIR}. "
            "Run scripts/discover_kolors.py first."
        )

    from diffusers import DiffusionPipeline

    print(f"Loading pipeline from {WEIGHTS_DIR}...")
    pipe = DiffusionPipeline.from_pretrained(
        str(WEIGHTS_DIR),
        torch_dtype=torch.float16,
        use_safetensors=True,
    ).to("cuda")
    pipe.enable_model_cpu_offload()
    return pipe


def run_vto(pipe, garment: Image.Image, model_person: Image.Image) -> Image.Image:
    """
    Run one VTO inference pass.

    IMPORTANT: the keyword arguments (image/condition_image) are a
    placeholder.  Update after inspecting app.py from discover_kolors.py.
    """
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
        jpg = MODEL_IMAGE.with_suffix(".jpg")
        if jpg.exists():
            model_img = Image.open(jpg).convert("RGB")
        else:
            print(f"[ERROR] model image not found at {MODEL_IMAGE}")
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

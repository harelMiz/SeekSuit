"""
FitDiT batch VTO — puts JACKETS and VESTS on the model using FitDiT,
then inpaints matching suit trousers on the lower body using SD inpainting.
PANTS are skipped (use the inpainting step instead for a matched pair look).

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

FITDIT_DIR  = Path("/workspace/FitDiT")
INPAINT_DIR = Path("/workspace/sd-inpainting")
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

CLOTH_CATEGORY = {
    "JACKETS": "Upper-body",
    "VESTS":   "Upper-body",
}

_COLORS = [
    ((10, 10, 10),   (60,  60,  70),  "black"),
    ((30, 30, 70),   (90,  90, 150),  "navy blue"),
    ((50, 50, 50),   (115, 115, 115), "dark gray"),
    ((115,115,115),  (190, 190, 190), "gray"),
    ((50, 20, 10),   (120, 65,  40),  "dark brown"),
    ((80, 15, 15),   (150, 65,  65),  "burgundy"),
    ((15, 55, 15),   (60,  110, 60),  "dark green"),
    ((160,120, 60),  (220, 180, 110), "tan"),
]


def get_garment_color(garment_path: Path) -> str:
    from PIL import Image
    arr = np.array(Image.open(garment_path).convert("RGB"))
    non_bg = arr[arr.mean(axis=2) < 210]
    if len(non_bg) == 0:
        return "dark gray"
    r, g, b = non_bg.mean(axis=0).astype(int)
    best, best_d = "dark gray", float("inf")
    for (rlo, glo, blo), (rhi, ghi, bhi), name in _COLORS:
        rc, gc, bc = (rlo + rhi) / 2, (glo + ghi) / 2, (blo + bhi) / 2
        d = (r - rc) ** 2 + (g - gc) ** 2 + (b - bc) ** 2
        if d < best_d:
            best_d, best = d, name
    return best


def create_lower_mask(w: int, h: int, waist_frac: float = 0.40):
    from PIL import Image, ImageDraw
    mask = Image.new("RGB", (w, h), "black")
    ImageDraw.Draw(mask).rectangle([0, int(h * waist_frac), w, h], fill="white")
    return mask


def _fix_inpaint_dir():
    # The runwayml repo ships fp16 weights under non-standard names.
    # Symlink them to the names diffusers expects.
    for subdir, src_name, dst_name in [
        ("unet", "diffusion_pytorch_model.fp16.safetensors", "diffusion_pytorch_model.safetensors"),
        ("unet", "diffusion_pytorch_model.fp16.bin",         "diffusion_pytorch_model.bin"),
    ]:
        src = INPAINT_DIR / subdir / src_name
        dst = INPAINT_DIR / subdir / dst_name
        if src.exists() and not dst.exists():
            dst.symlink_to(src_name)


def load_inpaint_pipe():
    import torch
    from diffusers import StableDiffusionInpaintPipeline
    src = str(INPAINT_DIR) if INPAINT_DIR.exists() else "runwayml/stable-diffusion-inpainting"
    print(f"  source: {src}")
    if INPAINT_DIR.exists():
        _fix_inpaint_dir()
    pipe = StableDiffusionInpaintPipeline.from_pretrained(
        src,
        torch_dtype=torch.float16,
        safety_checker=None,
        feature_extractor=None,
        requires_safety_checker=False,
    )
    pipe.enable_model_cpu_offload()
    return pipe


def inpaint_pants(pipe, vto_img, color: str):
    import torch
    W, H = vto_img.size
    iw, ih = 512, 768
    small = vto_img.resize((iw, ih))
    mask  = create_lower_mask(iw, ih, waist_frac=0.40)

    prompt = (
        f"professional fashion photography, male model wearing formal {color} "
        f"suit trousers, matching jacket, pressed fabric, studio lighting"
    )
    neg = (
        "shorts, jeans, casual pants, bad anatomy, deformed legs, "
        "blurry, low quality, mismatched color"
    )
    gen = torch.Generator(device=DEVICE).manual_seed(SEED)
    out = pipe(
        prompt=prompt,
        negative_prompt=neg,
        image=small,
        mask_image=mask,
        height=ih,
        width=iw,
        num_inference_steps=30,
        guidance_scale=7.5,
        generator=gen,
        strength=1.0,
    ).images[0]
    return out.resize((W, H))


def get_person_path() -> Path:
    for p in [MODEL_IMAGE, MODEL_IMAGE.with_suffix(".jpg")]:
        if p.exists():
            return p
    print(f"[ERROR] model image not found at {MODEL_IMAGE}")
    sys.exit(1)


def collect_samples() -> list:
    items = []
    for d in sorted(SAMPLES_DIR.iterdir()):
        if not d.is_dir() or d.name not in CLOTH_CATEGORY:
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
    print("Loading SD inpainting...")
    inpaint = load_inpaint_pipe()

    print(f"\n{len(samples)} garment(s)...\n")

    cached_masks = {}
    ok = err = 0

    for ptype, img_path in samples:
        cat = CLOTH_CATEGORY[ptype]
        out_dir = OUTPUT_DIR / ptype
        out_dir.mkdir(exist_ok=True)
        out_path = out_dir / f"{img_path.stem}_vto.jpg"

        print(f"  [{ptype}] {img_path.stem} ... ", end="", flush=True)
        try:
            if cat not in cached_masks:
                pre_mask, pose_img = fitdit.generate_mask(
                    str(person_path), cat, 0, 0, 0, 0,
                )
                cached_masks[cat] = (pre_mask, np.array(pose_img))
            pre_mask, pose_arr = cached_masks[cat]

            vto = fitdit.process(
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

            color = get_garment_color(img_path)
            print(f"[{color}] pants... ", end="", flush=True)
            final = inpaint_pants(inpaint, vto, color)
            final.save(out_path, quality=92)
            print("ok")
            ok += 1
        except Exception as e:
            import traceback
            print(f"FAIL  {e}")
            traceback.print_exc()
            err += 1

    print(f"\nDone — {ok} ok, {err} failed")
    print(f"Results: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()

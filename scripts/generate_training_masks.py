#!/usr/bin/env python3
"""
generate_training_masks.py
Run BiRefNet on a folder of product images and save binary masks + composited previews.
Used to prepare annotation data before fine-tuning.

Outputs:
  <output>/masks/       — binary PNG masks (white=foreground, black=background)
  <output>/composited/  — white-background JPEGs for visual inspection

Usage (inside Docker via docker exec):
    python generate_training_masks.py --input /tmp/pants --model portrait --output /tmp/pants_output
"""

import argparse
import sys
from pathlib import Path
from PIL import Image
import torch
from torchvision import transforms
from transformers import AutoModelForImageSegmentation

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}

MODEL_IDS = {
    "portrait": "ZhengPeng7/BiRefNet-portrait",
    "default":  "ZhengPeng7/BiRefNet",
}


def load_model(model_key: str, device: str):
    model_id = MODEL_IDS[model_key]
    print(f"[mask-gen] Loading {model_id} on {device}...")
    model = AutoModelForImageSegmentation.from_pretrained(
        model_id, trust_remote_code=True
    )
    model.to(device).eval()
    print(f"[mask-gen] Model ready.")
    return model


def remove_background(img: Image.Image, model, device) -> Image.Image:
    """Returns RGBA image — alpha channel is the foreground mask."""
    # 512 instead of 1024 to fit in memory alongside the running FastAPI process
    transform = transforms.Compose([
        transforms.Resize((512, 512)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    rgb = img.convert("RGB")
    tensor = transform(rgb).unsqueeze(0).to(device)
    with torch.no_grad():
        preds = model(tensor)[-1].sigmoid()
    mask = transforms.ToPILImage()(preds[0].squeeze()).resize(img.size, Image.LANCZOS)
    rgba = img.convert("RGBA")
    rgba.putalpha(mask)
    # Free GPU/CPU tensor memory between images
    del tensor, preds
    if device == "cuda":
        torch.cuda.empty_cache()
    return rgba


def main():
    parser = argparse.ArgumentParser(description="Batch BiRefNet mask generation for fine-tuning prep")
    parser.add_argument("--input",  required=True,  help="Folder with raw product images")
    parser.add_argument("--model",  default="portrait", choices=list(MODEL_IDS.keys()),
                        help="BiRefNet variant to use (default: portrait)")
    parser.add_argument("--output", default=None,
                        help="Output folder (default: <input_parent>/masks_<model>)")
    args = parser.parse_args()

    input_dir = Path(args.input)
    if not input_dir.is_dir():
        sys.exit(f"[mask-gen] ERROR: input folder not found: {input_dir}")

    output_dir = Path(args.output) if args.output else input_dir.parent / f"masks_{args.model}"
    masks_dir     = output_dir / "masks"
    composed_dir  = output_dir / "composited"
    masks_dir.mkdir(parents=True, exist_ok=True)
    composed_dir.mkdir(parents=True, exist_ok=True)

    images = sorted(p for p in input_dir.iterdir() if p.suffix.lower() in IMAGE_EXTS)
    if not images:
        sys.exit(f"[mask-gen] ERROR: no images found in {input_dir}")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model  = load_model(args.model, device)

    print(f"[mask-gen] Processing {len(images)} images...")
    for i, path in enumerate(images, 1):
        print(f"[mask-gen] [{i}/{len(images)}] {path.name}")
        img  = Image.open(path).convert("RGB")
        rgba = remove_background(img, model, device)

        # Binary mask — white = foreground (pants), black = background
        mask_img = rgba.getchannel("A")
        mask_img.save(masks_dir / (path.stem + ".png"))

        # Composited on white background for visual inspection
        white = Image.new("RGB", rgba.size, (255, 255, 255))
        white.paste(rgba, mask=rgba.getchannel("A"))
        white.save(composed_dir / (path.stem + ".jpg"), "JPEG", quality=92)

    print(f"\n[mask-gen] Done — {len(images)} images processed.")
    print(f"  masks/       → {masks_dir}")
    print(f"  composited/  → {composed_dir}")
    print(f"\nNext step: edit masks/ to remove hanger clips, then use for fine-tuning.")


if __name__ == "__main__":
    main()

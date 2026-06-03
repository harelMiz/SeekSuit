#!/usr/bin/env python3
"""
prepare_finetune_dataset.py
Prepares a BiRefNet fine-tuning dataset from annotated product images.

Output structure:
  <out_dir>/
    im/   <- original images resized to 1024x1024 (JPG)
    gt/   <- binary masks resized to 1024x1024 (PNG, 0=background 255=foreground)
  <out_dir>.zip  <- ready for Google Drive upload

Usage:
  # Pants (default)
  python scripts/prepare_finetune_dataset.py

  # Bow ties (20 training images, skip last 5 for validation)
  python scripts/prepare_finetune_dataset.py --product bow_ties --max-count 20
"""

import argparse
import zipfile
from pathlib import Path
from PIL import Image
import numpy as np

SIZE = 1024
BASE = Path(__file__).parent.parent / "Products-raw-photos"

PRODUCT_DEFAULTS = {
    "pants": {
        "images_dir": BASE / "pants_training",
        "masks_dir":  BASE / "pants_annotation" / "masks",
        "out_dir":    BASE / "pants_dataset",
    },
    "bow_ties": {
        "images_dir": BASE / "bow_ties_training",
        "masks_dir":  BASE / "bow_ties_annotation" / "masks",
        "out_dir":    BASE / "bow_ties_dataset",
    },
}

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def binarize(mask: Image.Image) -> Image.Image:
    """Threshold grayscale mask to pure 0/255 — removes soft edges from neural net output."""
    arr = np.array(mask.convert("L"))
    arr = np.where(arr > 127, 255, 0).astype(np.uint8)
    return Image.fromarray(arr, mode="L")


def main():
    parser = argparse.ArgumentParser(description="Prepare BiRefNet fine-tuning dataset")
    parser.add_argument("--product", default="pants", choices=list(PRODUCT_DEFAULTS.keys()),
                        help="Product type (sets default paths)")
    parser.add_argument("--images-dir", default=None, help="Override images folder path")
    parser.add_argument("--masks-dir",  default=None, help="Override masks folder path")
    parser.add_argument("--out-dir",    default=None, help="Override output folder path")
    parser.add_argument("--max-count",  type=int, default=None,
                        help="Limit to first N image pairs (alphabetical order)")
    args = parser.parse_args()

    defaults = PRODUCT_DEFAULTS[args.product]
    images_dir = Path(args.images_dir) if args.images_dir else defaults["images_dir"]
    masks_dir  = Path(args.masks_dir)  if args.masks_dir  else defaults["masks_dir"]
    out_dir    = Path(args.out_dir)    if args.out_dir    else defaults["out_dir"]
    zip_path   = out_dir.parent / (out_dir.name + ".zip")

    im_dir = out_dir / "im"
    gt_dir = out_dir / "gt"
    im_dir.mkdir(parents=True, exist_ok=True)
    gt_dir.mkdir(parents=True, exist_ok=True)

    images = sorted(p for p in images_dir.iterdir() if p.suffix.lower() in IMAGE_EXTS)
    if args.max_count:
        images = images[:args.max_count]

    ok, skipped = 0, 0

    for img_path in images:
        mask_path = masks_dir / (img_path.stem + ".png")
        if not mask_path.exists():
            print(f"  [SKIP] no mask for {img_path.name}")
            skipped += 1
            continue

        img = Image.open(img_path).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
        img.save(im_dir / (img_path.stem + ".jpg"), "JPEG", quality=95)

        mask = Image.open(mask_path)
        mask = binarize(mask).resize((SIZE, SIZE), Image.NEAREST)
        mask.save(gt_dir / (img_path.stem + ".png"))

        print(f"  [OK] {img_path.name}")
        ok += 1

    print(f"\nProcessed: {ok} images, skipped: {skipped}")
    print(f"Dataset saved to: {out_dir}")

    print(f"Creating zip: {zip_path}")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(out_dir.rglob("*")):
            if f.is_file():
                zf.write(f, f.relative_to(out_dir.parent))
    print(f"Done: {zip_path.name} ({zip_path.stat().st_size / 1024 / 1024:.1f} MB)")
    print("\nNext step: upload to Google Drive, then open Colab.")


if __name__ == "__main__":
    main()

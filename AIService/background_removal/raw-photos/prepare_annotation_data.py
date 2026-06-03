"""
prepare_annotation_data.py — Generate annotation-ready data from raw tie images.

Runs the default BiRefNet model on each image to produce initial masks and
composited images. The results are meant to be imported into an annotation
tool (e.g. CVAT, Label Studio) where masks can be corrected and exported
for fine-tuning.

Output structure:
  annotation_data/
    composited/   — product on white background (for visual reference)
    masks/        — binary mask: white=foreground, black=background (to annotate)

Usage:
    # From raw-photos/:
    python prepare_annotation_data.py --input ties
    python prepare_annotation_data.py --input ties --output annotation_data/ties
    python prepare_annotation_data.py --input ties --dry-run
"""

import argparse
import io
import sys
from pathlib import Path

import torch
from PIL import Image, ImageOps
from torchvision import transforms
from transformers import AutoModelForImageSegmentation

MEAN = [0.485, 0.456, 0.406]
STD  = [0.229, 0.224, 0.225]

MODEL_ID = "ZhengPeng7/BiRefNet"


def load_model():
    print(f"[prepare] Loading {MODEL_ID} ...")
    model = AutoModelForImageSegmentation.from_pretrained(MODEL_ID, trust_remote_code=True)
    model.eval()
    t = transforms.Compose([
        transforms.Resize((512, 512)),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    print("[prepare] Model ready.")
    return model, t


def process(model, transform, img: Image.Image) -> tuple[Image.Image, Image.Image]:
    """
    Returns (composited, mask):
      composited — product on white background (RGB)
      mask       — binary grayscale mask, white=foreground (L mode)
    """
    rgb = ImageOps.exif_transpose(img).convert("RGB")
    tensor = transform(rgb).unsqueeze(0)
    with torch.no_grad():
        preds = model(tensor)[-1].sigmoid().cpu()
    mask = transforms.ToPILImage()(preds[0].squeeze()).resize(rgb.size)

    rgba = rgb.convert("RGBA")
    rgba.putalpha(mask)
    background = Image.new("RGB", rgb.size, (255, 255, 255))
    background.paste(rgba, mask=mask)

    # Binarize mask: threshold at 127 → clean black/white
    binary_mask = mask.point(lambda p: 255 if p > 127 else 0).convert("L")

    return background, binary_mask


def collect_images(src: Path) -> list[Path]:
    exts = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
    return sorted([f for f in src.iterdir() if f.suffix.lower() in exts and f.is_file()])


def main():
    parser = argparse.ArgumentParser(description="Generate annotation data from raw product images.")
    parser.add_argument("--input",  required=True, help="Input folder (relative to raw-photos/ or absolute path)")
    parser.add_argument("--output", default=None,  help="Output folder (default: annotation_data/<input_folder_name>)")
    parser.add_argument("--dry-run", action="store_true", help="Preview — list files without processing")
    args = parser.parse_args()

    root = Path(__file__).parent
    input_dir = Path(args.input) if Path(args.input).is_absolute() else root / args.input
    if not input_dir.exists():
        print(f"[ERROR] Input folder not found: {input_dir}")
        sys.exit(1)

    output_base = Path(args.output) if args.output else root / "annotation_data" / input_dir.name
    composited_dir = output_base / "composited"
    masks_dir      = output_base / "masks"

    images = collect_images(input_dir)
    if not images:
        print(f"[ERROR] No images found in {input_dir}")
        sys.exit(1)

    print(f"Input  : {input_dir}  ({len(images)} images)")
    print(f"Output : {output_base}")
    print(f"  composited/ — {len(images)} files")
    print(f"  masks/      — {len(images)} files")

    if args.dry_run:
        print("\n[dry-run] Files that would be processed:")
        for f in images:
            print(f"  {f.name}")
        print("\nRun without --dry-run to process.")
        return

    composited_dir.mkdir(parents=True, exist_ok=True)
    masks_dir.mkdir(parents=True, exist_ok=True)

    # Register HEIC support if available
    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
    except ImportError:
        pass

    model, transform = load_model()

    for i, src in enumerate(images, 1):
        stem = src.stem
        print(f"  [{i}/{len(images)}] {src.name} ...", end=" ", flush=True)
        try:
            img = Image.open(src)
            composited, mask = process(model, transform, img)
            composited.save(composited_dir / f"{stem}.jpg", format="JPEG", quality=92)
            mask.save(masks_dir / f"{stem}.png", format="PNG")
            print("done")
        except Exception as e:
            print(f"ERROR: {e}")

    print(f"\nDone. Output written to: {output_base}")
    print(f"  composited/ — visual reference (JPG)")
    print(f"  masks/      — binary masks to annotate (PNG)")


if __name__ == "__main__":
    main()

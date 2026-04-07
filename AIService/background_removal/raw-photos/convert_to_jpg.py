"""
convert_to_jpg.py — Convert all HEIC files to JPG across all category subfolders.

Uses pillow + pillow-heif. Install once:
    pip install pillow pillow-heif

Run from inside raw-photos/:
    python convert_to_jpg.py            # live convert + delete originals
    python convert_to_jpg.py --dry-run  # preview only

Already-converted JPG files are skipped silently.
"""

import argparse
import os
from pathlib import Path

import pillow_heif
from PIL import Image

# Register HEIF opener with Pillow
pillow_heif.register_heif_opener()

HEIC_EXTENSIONS = {".heic", ".heif"}
JPG_QUALITY = 85


def convert_file(src: Path, dry_run: bool) -> bool:
    """Convert a single HEIC file to JPG. Returns True if converted (or would convert)."""
    dst = src.with_suffix(".jpg")

    if dst.exists():
        print(f"  skip (already exists): {dst.name}")
        return False

    print(f"  {'(dry-run) ' if dry_run else ''}{src.name}  ->  {dst.name}")

    if not dry_run:
        img = Image.open(src)
        img.convert("RGB").save(dst, format="JPEG", quality=JPG_QUALITY)
        src.unlink()  # delete original HEIC after successful conversion

    return True


def convert_folder(folder: Path, dry_run: bool) -> int:
    heic_files = sorted(
        [f for f in folder.iterdir() if f.is_file() and f.suffix.lower() in HEIC_EXTENSIONS]
    )

    if not heic_files:
        return 0

    print(f"\n[{folder.name}] — {len(heic_files)} HEIC file(s)")
    count = sum(convert_file(f, dry_run) for f in heic_files)
    print(f"  {'Would convert' if dry_run else 'Converted'} {count} file(s).")
    return count


def main():
    parser = argparse.ArgumentParser(description="Convert HEIC photos to JPG.")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without converting.")
    args = parser.parse_args()

    root = Path(__file__).parent
    total = 0

    for entry in sorted(root.iterdir()):
        if entry.is_dir() and not entry.name.startswith("."):
            total += convert_folder(entry, dry_run=args.dry_run)

    print(f"\n{'Preview complete' if args.dry_run else 'Done'}. "
          f"{'Would convert' if args.dry_run else 'Converted'} {total} file(s) total.")
    if args.dry_run:
        print("Run without --dry-run to apply changes.")


if __name__ == "__main__":
    main()

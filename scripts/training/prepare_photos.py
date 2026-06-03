"""
SeekSuit — Photo preparation tool
Usage:
  python prepare_photos.py convert <folder>
      Converts all HEIC files in <folder> to JPG (keeps originals).
      Prints a sorted list of the output files so you can build the mapping.

  python prepare_photos.py rename <folder> <mapping.txt>
      Renames JPG files according to mapping.txt (see format below).

Mapping file format (one line per image, in sorted-filename order):
  suit_001_front
  suit_001_back
  suit_002_front
  suit_002_back
  vest_001_front
  vest_001_back
  ...

Lines starting with # are ignored (use for comments / visual grouping).
Empty lines are also ignored.
"""

import sys
import os
from pathlib import Path
from pillow_heif import register_heif_opener
from PIL import Image

register_heif_opener()


def convert(folder: Path) -> None:
    heic_files = sorted(folder.glob("*.HEIC")) + sorted(folder.glob("*.heic"))

    if not heic_files:
        print(f"No HEIC files found in {folder}")
        return

    print(f"Found {len(heic_files)} HEIC files — converting to JPG...\n")
    converted = []

    for src in heic_files:
        dst = src.with_suffix(".jpg")
        if dst.exists():
            print(f"  [skip]  {src.name} → already exists as {dst.name}")
            converted.append(dst)
            continue

        img = Image.open(src)
        # Preserve orientation from EXIF
        img = img.convert("RGB")
        img.save(dst, format="JPEG", quality=95)
        print(f"  [ok]    {src.name} → {dst.name}")
        converted.append(dst)

    print(f"\nDone. {len(converted)} JPG files ready.\n")
    print("Sorted order (copy this into your mapping.txt, one target name per line):")
    print("-" * 60)
    for i, f in enumerate(sorted(converted), 1):
        print(f"  {i:3}.  {f.name}")
    print("-" * 60)
    print("\nExample mapping.txt:")
    print("  suit_001_front")
    print("  suit_001_back")
    print("  # vest section")
    print("  vest_001_front")
    print("  vest_001_back")


def rename(folder: Path, mapping_file: Path) -> None:
    if not mapping_file.exists():
        print(f"Mapping file not found: {mapping_file}")
        sys.exit(1)

    # Read non-empty, non-comment lines
    names = [
        line.strip()
        for line in mapping_file.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]

    # Sorted JPG files in the folder
    jpgs = sorted(folder.glob("*.jpg")) + sorted(folder.glob("*.JPG"))
    # Exclude files that already have a meaningful name (not IMG_xxxx pattern)
    source_files = [f for f in jpgs if f.stem.upper().startswith("IMG_") or f.stem.isdigit()]

    if len(source_files) != len(names):
        print(f"Mismatch: {len(source_files)} source JPGs but {len(names)} names in mapping.")
        print("\nSource files found:")
        for f in source_files:
            print(f"  {f.name}")
        print("\nNames in mapping:")
        for n in names:
            print(f"  {n}")
        sys.exit(1)

    print(f"Renaming {len(source_files)} files...\n")
    for src, name in zip(sorted(source_files), names):
        dst = folder / f"{name}.jpg"
        if dst.exists():
            print(f"  [skip]  {src.name} → {dst.name} (already exists)")
            continue
        src.rename(dst)
        print(f"  [ok]    {src.name} → {dst.name}")

    print(f"\nDone.")


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    folder = Path(sys.argv[2])

    if not folder.exists():
        print(f"Folder not found: {folder}")
        sys.exit(1)

    if command == "convert":
        convert(folder)
    elif command == "rename":
        if len(sys.argv) < 4:
            print("Usage: python prepare_photos.py rename <folder> <mapping.txt>")
            sys.exit(1)
        rename(folder, Path(sys.argv[3]))
    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()

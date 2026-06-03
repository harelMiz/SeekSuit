"""
SeekSuit - Auto-rename new suit and vest photos.

Converts HEIC -> JPG and renames according to the agreed pattern:

  Suits  (suits_training/):
      Every 3 images sorted by number: front, back, tag
      Output: suit_001_front.jpg, suit_001_back.jpg, suit_001_tag.jpg, suit_002_front.jpg ...

  Vests  (vests_traning/):
      Up to and including IMG_3488 (last tag): groups of 3 -> front, back, tag
      After IMG_3488: groups of 2 -> front, back  (no tag photos)
      Output: vest_001_front.jpg, vest_001_back.jpg, vest_001_tag.jpg, vest_002_front.jpg ...

Usage:
  python scripts/rename_new_photos.py [--dry-run]

  --dry-run   Print what would happen without changing any files.
"""

import re
import sys
from pathlib import Path

from PIL import Image
from pillow_heif import register_heif_opener

register_heif_opener()

ROOT = Path(__file__).parent.parent / "Products-raw-photos"
SUITS_DIR = ROOT / "suits_training"
VESTS_DIR = ROOT / "vests_traning"       # folder name has a typo - kept as-is
VEST_LAST_TAG_NUM = 3488                 # IMG_3488.HEIC is the last vest tag photo

DRY_RUN = "--dry-run" in sys.argv


def extract_number(path: Path) -> int:
    m = re.search(r"(\d+)", path.stem)
    return int(m.group(1)) if m else 0


SUPPORTED_EXTENSIONS = {".heic", ".png", ".jpg", ".jpeg"}

def get_source_files(folder: Path) -> list[Path]:
    """Return all source image files (HEIC/PNG/JPG) sorted by their IMG number."""
    files = [f for f in folder.iterdir() if f.suffix.lower() in SUPPORTED_EXTENSIONS]
    # Deduplicate: if both IMG_1234.HEIC and IMG_1234.jpg exist, keep HEIC (prefer original)
    by_stem: dict[str, Path] = {}
    for f in files:
        stem = f.stem.upper()
        existing = by_stem.get(stem)
        if existing is None or f.suffix.lower() != ".jpg":
            by_stem[stem] = f
    return sorted(by_stem.values(), key=extract_number)


def convert_and_get_jpg(src: Path) -> Path:
    """Convert HEIC/PNG to JPG if needed. Returns the JPG path."""
    dst = src.with_suffix(".jpg")
    if DRY_RUN:
        return dst   # just return the expected path, don't touch anything
    if src.suffix.lower() == ".jpg":
        return src   # already a JPG, rename in place
    if not dst.exists():
        img = Image.open(src).convert("RGB")
        img.save(dst, format="JPEG", quality=95)
        print(f"  convert  {src.name} -> {dst.name}")
    return dst


def do_rename(src: Path, new_stem: str) -> None:
    dst = src.parent / f"{new_stem}.jpg"
    if DRY_RUN:
        print(f"  {src.name} -> {dst.name}")
        return
    if dst.exists():
        print(f"  [skip]   {src.name} -> {dst.name}  (already exists)")
        return
    src.rename(dst)
    print(f"  rename   {src.name} -> {dst.name}")


def process_suits() -> None:
    print("\n--- Suits -------------------------------------------")
    heic_files = get_source_files(SUITS_DIR)
    n = len(heic_files)
    print(f"Found {n} HEIC files")

    if n == 0:
        print("  No HEIC files found. Check the folder path.")
        return
    if n % 3 != 0:
        print(f"  WARNING: {n} is not divisible by 3.")
        print("  Expected groups of (front, back, tag). Please check the files.")
        return

    num_suits = n // 3
    print(f"  -> {num_suits} suits  (each: front + back + tag)")
    if DRY_RUN:
        print()

    labels = ["front", "back", "tag"]
    suit_num = 1
    for i, heic in enumerate(heic_files):
        label = labels[i % 3]
        if i % 3 == 0 and i > 0:
            suit_num += 1
        jpg = convert_and_get_jpg(heic)
        do_rename(jpg, f"suit_{suit_num:03d}_{label}")

    if not DRY_RUN:
        print(f"\n  Done: {num_suits} suits renamed.")


def process_vests() -> None:
    print("\n--- Vests -------------------------------------------")
    heic_files = get_source_files(VESTS_DIR)
    n = len(heic_files)
    print(f"Found {n} HEIC files")

    if n == 0:
        print("  No HEIC files found. Check the folder path.")
        return

    nums = [extract_number(f) for f in heic_files]
    if VEST_LAST_TAG_NUM not in nums:
        print(f"  ERROR: IMG_{VEST_LAST_TAG_NUM} not found in vests folder.")
        print(f"  First 5 numbers: {nums[:5]}")
        print(f"  Last  5 numbers: {nums[-5:]}")
        return

    split_idx = nums.index(VEST_LAST_TAG_NUM) + 1   # exclusive: up to and including 3488
    triplet_section = heic_files[:split_idx]
    pair_section    = heic_files[split_idx:]

    if len(triplet_section) % 3 != 0:
        print(f"  WARNING: triplet section has {len(triplet_section)} files - not divisible by 3.")
        print(f"  Files up to IMG_{VEST_LAST_TAG_NUM} must be groups of (front, back, tag).")
        return
    if len(pair_section) % 2 != 0:
        print(f"  WARNING: pair section has {len(pair_section)} files - not divisible by 2.")
        print(f"  Files after IMG_{VEST_LAST_TAG_NUM} must be groups of (front, back).")
        return

    vests_with_tag    = len(triplet_section) // 3
    vests_without_tag = len(pair_section) // 2
    print(f"  -> {vests_with_tag} vests with tag  +  {vests_without_tag} vests without tag  =  {vests_with_tag + vests_without_tag} total")
    if DRY_RUN:
        print()

    vest_num = 1
    for i, heic in enumerate(triplet_section):
        label = ["front", "back", "tag"][i % 3]
        if i % 3 == 0 and i > 0:
            vest_num += 1
        jpg = convert_and_get_jpg(heic)
        do_rename(jpg, f"vest_{vest_num:03d}_{label}")

    vest_num += 1
    for i, heic in enumerate(pair_section):
        label = ["front", "back"][i % 2]
        if i % 2 == 0 and i > 0:
            vest_num += 1
        jpg = convert_and_get_jpg(heic)
        do_rename(jpg, f"vest_{vest_num:03d}_{label}")

    if not DRY_RUN:
        total = vests_with_tag + vests_without_tag
        print(f"\n  Done: {total} vests renamed.")


if __name__ == "__main__":
    if DRY_RUN:
        print("DRY RUN - no files will be changed\n")

    process_suits()
    process_vests()

    if DRY_RUN:
        print("\nRe-run without --dry-run to apply changes.")

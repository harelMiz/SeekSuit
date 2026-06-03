"""
Separates training photos from catalog (tag) photos.

Creates two folders inside raw-photos/:
  training/  — front, back, main, inner, outer angles (used for AI training)
  catalog/   — tag photos (used for product catalog only)

Original files are NOT deleted.
"""

import shutil
from pathlib import Path

BASE_DIR = Path(__file__).parent

CATEGORIES = ["suits", "pants", "vests", "shirts", "shoes", "belts", "bow ties", "ties"]

TRAINING_ANGLES = {"front", "back", "main", "inner", "outer"}
CATALOG_ANGLES = {"tag"}

training_dir = BASE_DIR / "training"
catalog_dir = BASE_DIR / "catalog"

training_dir.mkdir(exist_ok=True)
catalog_dir.mkdir(exist_ok=True)

training_count = 0
catalog_count = 0

for category in CATEGORIES:
    src_dir = BASE_DIR / category
    if not src_dir.exists():
        print(f"[SKIP] {category}/ not found")
        continue

    (training_dir / category).mkdir(exist_ok=True)
    (catalog_dir / category).mkdir(exist_ok=True)

    for jpg in sorted(src_dir.glob("*.jpg")):
        # filename format: {prefix}_{001}_{angle}.jpg
        parts = jpg.stem.split("_")
        angle = parts[-1] if parts else ""

        if angle in TRAINING_ANGLES:
            shutil.copy2(jpg, training_dir / category / jpg.name)
            training_count += 1
        elif angle in CATALOG_ANGLES:
            shutil.copy2(jpg, catalog_dir / category / jpg.name)
            catalog_count += 1
        else:
            print(f"[UNKNOWN ANGLE] {jpg.relative_to(BASE_DIR)}")

print(f"\nDone.")
print(f"  Training photos : {training_count}")
print(f"  Catalog (tag)   : {catalog_count}")
print(f"  Output: training/ and catalog/ inside raw-photos/")

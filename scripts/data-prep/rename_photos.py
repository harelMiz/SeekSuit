"""
rename_photos.py — Rename raw product photos to a consistent convention.

Output format: {prefix}_{001}_{angle}.{ext}
Example:       suit_001_front.heic

Run from inside raw-photos/:
    python rename_photos.py            # live rename
    python rename_photos.py --dry-run  # preview only

Folder → angle assignment is done by sorting files alphabetically
(iPhone numbers photos sequentially, so sort order = shoot order).

Vest special case: first 15 items get 3 angles (front/back/tag),
last 5 items get 2 angles (front/back) — 15×3 + 5×2 = 55 total.
"""

import argparse
import os
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Category configuration
# Each entry: folder_name -> list of (item_count, [angles])
# Groups are consumed in order from the top of the sorted file list.
# ---------------------------------------------------------------------------
CATEGORIES = {
    "suits": {
        "prefix": "suit",
        "groups": [(50, ["front", "back", "tag"])],
    },
    "pants": {
        "prefix": "pant",
        "groups": [(20, ["main", "tag"])],
    },
    "vests": {
        "prefix": "vest",
        # 15 vests photographed front/back/tag, 5 vests photographed front/back only
        "groups": [
            (15, ["front", "back", "tag"]),
            (5,  ["front", "back"]),
        ],
    },
    "shirts": {
        "prefix": "shirt",
        "groups": [(20, ["main", "tag"])],
    },
    "shoes": {
        "prefix": "shoe",
        "groups": [(29, ["inner", "front", "outer", "tag"])],
    },
    "belts": {
        "prefix": "belt",
        "groups": [(20, ["main"])],
    },
    "bow ties": {
        "prefix": "bow_tie",
        "groups": [(25, ["main"])],
    },
    "ties": {
        "prefix": "tie",
        "groups": [(20, ["main"])],
    },
}


def build_rename_plan(folder: Path, prefix: str, groups: list) -> list[tuple[Path, Path]]:
    """
    Sort all files in folder, then assign names sequentially based on groups.
    Returns a list of (src_path, dst_path) pairs.
    """
    files = sorted(
        [f for f in folder.iterdir() if f.is_file() and not f.name.startswith(".")],
        key=lambda f: f.name.lower(),
    )

    # Expand groups into a flat sequence of (item_number, angle) for each file
    sequence: list[tuple[int, str]] = []
    item_num = 1
    for item_count, angles in groups:
        for _ in range(item_count):
            for angle in angles:
                sequence.append((item_num, angle))
            item_num += 1

    if len(files) != len(sequence):
        print(
            f"  ERROR: {folder.name} has {len(files)} files "
            f"but config expects {len(sequence)} — skipping."
        )
        return []

    plan = []
    for file, (num, angle) in zip(files, sequence):
        new_name = f"{prefix}_{num:03d}_{angle}{file.suffix.lower()}"
        dst = folder / new_name
        if file.name != new_name:
            plan.append((file, dst))

    return plan


def rename_category(folder: Path, config: dict, dry_run: bool) -> int:
    prefix = config["prefix"]
    groups = config["groups"]

    print(f"\n[{folder.name}]")
    plan = build_rename_plan(folder, prefix, groups)
    if not plan:
        return 0

    for src, dst in plan:
        print(f"  {'(dry-run) ' if dry_run else ''}{src.name}  ->  {dst.name}")
        if not dry_run:
            src.rename(dst)

    print(f"  {'Would rename' if dry_run else 'Renamed'} {len(plan)} file(s).")
    return len(plan)


def main():
    parser = argparse.ArgumentParser(description="Rename raw product photos to a consistent convention.")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without renaming.")
    args = parser.parse_args()

    root = Path(__file__).parent
    total = 0

    for folder_name, config in CATEGORIES.items():
        folder = root / folder_name
        if not folder.exists():
            print(f"\n[{folder_name}] — folder not found, skipping.")
            continue
        total += rename_category(folder, config, dry_run=args.dry_run)

    print(f"\n{'Preview complete' if args.dry_run else 'Done'}. "
          f"{'Would rename' if args.dry_run else 'Renamed'} {total} file(s) total.")
    if args.dry_run:
        print("Run without --dry-run to apply changes.")


if __name__ == "__main__":
    main()

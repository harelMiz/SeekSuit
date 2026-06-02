"""
build_ties_dataset.py — Build the ties fine-tuning dataset for Colab.

Steps:
  1. Re-run BiRefNet on the 5 images whose composited files are missing
  2. Convert .jpg masks to proper binary PNG
  3. Copy the 18 training pairs (im/ + gt/) — excluding tie_014 and tie_020
  4. Print a summary

Run inside Docker (all deps available):
  docker run --rm \
    -v <script>:/app/build_ties_dataset.py \
    -v <annotation_dir>:/annotation \
    -v <raw_training>:/raw \
    -v <output>:/dataset \
    seeksuit-aiservice python /app/build_ties_dataset.py
"""

import io, shutil
from pathlib import Path
from PIL import Image, ImageOps
import torch
from torchvision import transforms
from transformers import AutoModelForImageSegmentation

ANNOTATION_DIR = Path('/annotation')
RAW_DIR        = Path('/raw')
DATASET_DIR    = Path('/dataset')

COMPOSITED_DIR = ANNOTATION_DIR / 'composited'
MASKS_DIR      = ANNOTATION_DIR / 'masks'
IM_DIR         = DATASET_DIR / 'im'
GT_DIR         = DATASET_DIR / 'gt'

# Held-out test set — excluded from training
HOLDOUT = {'tie_014_main', 'tie_020_main'}

MEAN = [0.485, 0.456, 0.406]
STD  = [0.229, 0.224, 0.225]


def load_model():
    print('[build] Loading BiRefNet ...')
    model = AutoModelForImageSegmentation.from_pretrained(
        'ZhengPeng7/BiRefNet', trust_remote_code=True
    )
    model.eval()
    t = transforms.Compose([
        transforms.Resize((512, 512)),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    print('[build] Model ready.')
    return model, t


def generate_composited(model, transform, raw_path: Path, out_path: Path):
    img = ImageOps.exif_transpose(Image.open(raw_path)).convert('RGB')
    tensor = transform(img).unsqueeze(0)
    with torch.no_grad():
        preds = model(tensor)[-1].sigmoid().cpu()
    mask = transforms.ToPILImage()(preds[0].squeeze()).resize(img.size)
    rgba = img.convert('RGBA')
    rgba.putalpha(mask)
    bg = Image.new('RGB', img.size, (255, 255, 255))
    bg.paste(rgba, mask=mask)
    bg.save(out_path, format='JPEG', quality=92)


def jpg_mask_to_binary_png(jpg_path: Path, png_path: Path):
    mask = Image.open(jpg_path).convert('L')
    binary = mask.point(lambda p: 255 if p > 127 else 0)
    binary.save(png_path, format='PNG')


def main():
    IM_DIR.mkdir(parents=True, exist_ok=True)
    GT_DIR.mkdir(parents=True, exist_ok=True)

    # All stems present in masks (these are all 20 annotations)
    all_mask_stems = set()
    for f in MASKS_DIR.iterdir():
        if f.suffix.lower() in ('.png', '.jpg', '.jpeg'):
            all_mask_stems.add(f.stem)

    training_stems = sorted(all_mask_stems - HOLDOUT)
    print(f'\nTraining set: {len(training_stems)} images')
    print(f'Holdout (test): {sorted(HOLDOUT)}\n')

    # Step 1 — find which composited images are missing
    missing_composited = [
        stem for stem in training_stems
        if not (COMPOSITED_DIR / f'{stem}.jpg').exists()
    ]

    if missing_composited:
        print(f'Step 1 — Regenerating {len(missing_composited)} composited images ...')
        model, transform = load_model()
        for stem in missing_composited:
            raw = RAW_DIR / f'{stem}.jpg'
            if not raw.exists():
                print(f'  [SKIP] raw file not found: {raw}')
                continue
            out = COMPOSITED_DIR / f'{stem}.jpg'
            print(f'  {stem} ...', end=' ', flush=True)
            generate_composited(model, transform, raw, out)
            print('done')
    else:
        print('Step 1 — All composited images present, skipping model run.')

    # Step 2 — convert .jpg masks to binary PNG
    print('\nStep 2 — Converting .jpg masks to binary PNG ...')
    for stem in training_stems:
        jpg_mask = MASKS_DIR / f'{stem}.jpg'
        png_mask = MASKS_DIR / f'{stem}.png'
        if jpg_mask.exists() and not png_mask.exists():
            print(f'  {stem}.jpg → {stem}.png')
            jpg_mask_to_binary_png(jpg_mask, png_mask)

    # Step 3 — copy pairs to dataset
    print('\nStep 3 — Building dataset ...')
    copied = 0
    for stem in training_stems:
        src_im = COMPOSITED_DIR / f'{stem}.jpg'
        src_gt = MASKS_DIR      / f'{stem}.png'
        if not src_im.exists():
            print(f'  [MISSING composited] {stem} — skipping')
            continue
        if not src_gt.exists():
            print(f'  [MISSING mask PNG] {stem} — skipping')
            continue
        shutil.copy2(src_im, IM_DIR / f'{stem}.jpg')
        shutil.copy2(src_gt, GT_DIR / f'{stem}.png')
        copied += 1
        print(f'  ✓ {stem}')

    print(f'\n{"="*40}')
    print(f'Dataset built: {copied} pairs')
    print(f'  im/ → {IM_DIR}')
    print(f'  gt/ → {GT_DIR}')
    print(f'\nHoldout (for Cell 9 in Colab):')
    for s in sorted(HOLDOUT):
        print(f'  {s}')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
Background removal model comparison — Stage 3A testing.
Memory-efficient: loads one model at a time, processes one image at a time.

Usage:
    python /tmp/test_bg_removal.py <image1> [image2] ...

Results saved to /tmp/test_results/
"""

import gc
import io
import os
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw
import torch
import torch.nn.functional as F
from torchvision import transforms
from transformers import (
    AutoModelForImageSegmentation,
    SegformerForSemanticSegmentation,
    SegformerImageProcessor,
)

RESULTS_DIR = Path("/tmp/test_results")

MODELS = [
    {"id": "ZhengPeng7/BiRefNet",              "name": "BiRefNet (current)", "size": 512,  "type": "birefnet"},
    {"id": "ZhengPeng7/BiRefNet-portrait",     "name": "BiRefNet-portrait",  "size": 512,  "type": "birefnet"},
    {"id": "briaai/RMBG-1.4",                  "name": "RMBG-1.4",           "size": 1024, "type": "birefnet"},
    {"id": "briaai/RMBG-2.0",                  "name": "RMBG-2.0",           "size": 1024, "type": "birefnet"},
    # Segformer: semantic segmentation — extracts specific clothing classes
    # classes: 4=Upper-clothes, 6=Pants  (full label list: mattmdjaga/segformer_b2_clothes)
    {"id": "mattmdjaga/segformer_b2_clothes",  "name": "Segformer-clothes",  "size": 512,  "type": "segformer", "classes": [4, 6]},
]

MEAN = [0.485, 0.456, 0.406]
STD  = [0.229, 0.224, 0.225]
MAX_INPUT_DIM = 1200   # downscale large phone photos before feeding to PIL
THUMB_W, THUMB_H = 280, 380
LABEL_H = 24
PAD = 8


def load_image(src: str) -> Image.Image:
    """Load from path or URL, downsample very large images to save memory."""
    if src.startswith(("http://", "https://")):
        with urllib.request.urlopen(src) as r:
            data = r.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
    else:
        img = Image.open(src).convert("RGB")
    # Downsample large phone photos — doesn't affect model quality (model uses 512px anyway)
    if max(img.size) > MAX_INPUT_DIM:
        img.thumbnail((MAX_INPUT_DIM, MAX_INPUT_DIM), Image.LANCZOS)
    return img


def extract_pred(output) -> torch.Tensor:
    """Pull the prediction tensor out of whatever structure the model returns.
    BiRefNet  → tuple of tensors,  take [-1]
    RMBG-1.4  → nested lists,      unwrap until we reach a tensor
    RMBG-2.0  → similar to RMBG-1.4
    """
    pred = output[-1]
    # Unwrap any list/tuple wrappers until we reach a plain tensor
    while isinstance(pred, (list, tuple)):
        pred = pred[0]
    return pred.float()


def run_model(model, img: Image.Image, input_size: int) -> Image.Image:
    """Run segmentation, composite result on white background."""
    t = transforms.Compose([
        transforms.Resize((input_size, input_size)),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    with torch.no_grad():
        pred = extract_pred(model(t(img).unsqueeze(0))).cpu()

    # Convert logits → probabilities (sigmoid) or normalise if already in [0,1]
    p_min, p_max = pred.min(), pred.max()
    if p_min >= 0 and p_max <= 1:
        mask_t = pred.squeeze()               # already a probability map
    else:
        mask_t = pred.squeeze().sigmoid()     # logits → probabilities

    mask = transforms.ToPILImage()(mask_t).resize(img.size, Image.LANCZOS)
    rgba = img.convert("RGBA")
    rgba.putalpha(mask)
    bg = Image.new("RGB", img.size, (255, 255, 255))
    bg.paste(rgba, mask=mask)
    return bg


def run_segformer(processor, model, img: Image.Image, classes: list[int]) -> Image.Image:
    """Segformer semantic segmentation — mask = union of requested clothing classes."""
    model.eval()
    with torch.no_grad():
        inputs = processor(images=img, return_tensors="pt")
        logits = model(**inputs).logits  # (1, num_classes, H/4, W/4)

    upsampled = F.interpolate(logits, size=(img.height, img.width), mode="bilinear", align_corners=False)
    pred_seg = upsampled.argmax(dim=1)[0]  # (H, W)

    mask_t = torch.zeros_like(pred_seg, dtype=torch.float32)
    for c in classes:
        mask_t += (pred_seg == c).float()
    mask_t = mask_t.clamp(0, 1)

    mask = transforms.ToPILImage()(mask_t).resize(img.size, Image.LANCZOS)
    rgba = img.convert("RGBA")
    rgba.putalpha(mask)
    bg = Image.new("RGB", img.size, (255, 255, 255))
    bg.paste(rgba, mask=mask)
    return bg


def fit(img: Image.Image, w: int, h: int) -> Image.Image:
    copy = img.copy()
    copy.thumbnail((w, h), Image.LANCZOS)
    canvas = Image.new("RGB", (w, h), (235, 235, 235))
    canvas.paste(copy, ((w - copy.width) // 2, (h - copy.height) // 2))
    return canvas


def build_comparison(stem: str, sources: list[str], model_names: list[str]) -> None:
    """Load saved results from disk and build a side-by-side comparison strip."""
    original = load_image(next(s for s in sources if Path(s).stem == stem))

    results = []
    for m in MODELS:
        if m["name"] not in model_names:
            continue
        p = RESULTS_DIR / f"{stem}__{m['id'].replace('/', '_')}.jpg"
        if p.exists():
            results.append((m["name"], Image.open(p).convert("RGB")))

    if not results:
        return

    cols = [("Original", original)] + results
    total_w = PAD + len(cols) * (THUMB_W + PAD)
    total_h = PAD + LABEL_H + THUMB_H + PAD
    canvas = Image.new("RGB", (total_w, total_h), (200, 200, 200))
    draw = ImageDraw.Draw(canvas)
    for i, (name, img) in enumerate(cols):
        x = PAD + i * (THUMB_W + PAD)
        canvas.paste(fit(img, THUMB_W, THUMB_H), (x, PAD + LABEL_H))
        draw.text((x + 4, PAD + 4), name, fill=(20, 20, 20))

    comp_path = RESULTS_DIR / f"{stem}__comparison.jpg"
    canvas.save(comp_path, "JPEG", quality=92)
    print(f"  comparison → {comp_path.name}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    sources = sys.argv[1:]
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    succeeded_models: list[str] = []

    for m in MODELS:
        print(f"\n{'─'*55}")
        print(f"Model: {m['name']}  ({m['id']})")
        print(f"  Loading ...", end=" ", flush=True)
        try:
            hf_token = os.environ.get("HF_TOKEN") or None
            if m.get("type") == "segformer":
                processor = SegformerImageProcessor.from_pretrained(m["id"], token=hf_token)
                model = SegformerForSemanticSegmentation.from_pretrained(m["id"], token=hf_token)
            else:
                processor = None
                model = AutoModelForImageSegmentation.from_pretrained(
                    m["id"], trust_remote_code=True, token=hf_token
                )
            model.eval()
            print("ready")
        except Exception as e:
            print(f"FAILED ({e}) — skipping")
            continue

        model_ok = True
        for src in sources:
            stem = Path(src).stem
            print(f"  {stem} ...", end=" ", flush=True)
            try:
                img = load_image(src)
                if m.get("type") == "segformer":
                    result = run_segformer(processor, model, img, m["classes"])
                else:
                    result = run_model(model, img, m["size"])
                out_path = RESULTS_DIR / f"{stem}__{m['id'].replace('/', '_')}.jpg"
                result.save(out_path, "JPEG", quality=92)
                del img, result
                gc.collect()
                print(f"saved")
            except Exception as e:
                print(f"FAILED: {e}")
                model_ok = False

        del model, processor
        gc.collect()
        if model_ok:
            succeeded_models.append(m["name"])
        print(f"  Memory freed.")

    # Build comparison strips from saved files
    print("\nBuilding comparisons ...")
    stems = [Path(s).stem for s in sources]
    for stem in stems:
        build_comparison(stem, sources, succeeded_models)

    print(f"\n✓ Done — results in {RESULTS_DIR}")


if __name__ == "__main__":
    main()

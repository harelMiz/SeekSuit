import importlib
import io
import re
import sys
from pathlib import Path
from PIL import Image, ImageEnhance, ImageOps
from transformers import AutoModelForImageSegmentation
import numpy as np
import torch
from torchvision import transforms

MEAN = [0.485, 0.456, 0.406]
STD  = [0.229, 0.224, 0.225]

# Output canvas — portrait format standard for e-commerce product shots
_CANVAS_W    = 1200
_CANVAS_H    = 1600
_PADDING_RATIO = 0.08  # 8% whitespace on each side relative to the larger content dimension

# Local fine-tuned models live here (mounted as a volume in Docker)
_FINETUNED_DIR = Path('/app/finetuned_models')

# Registered models — HuggingFace repo ID or absolute local path
_MODEL_IDS: dict[str, str] = {
    'default':             'ZhengPeng7/BiRefNet',
    'portrait':            'ZhengPeng7/BiRefNet-portrait',
    'pants_finetuned':     str(_FINETUNED_DIR / 'pants'),
    'bow_ties_finetuned':  str(_FINETUNED_DIR / 'bow_ties'),
    'ties_finetuned':      str(_FINETUNED_DIR / 'ties'),
}

# Which model key to use per product type
_TYPE_ROUTING: dict[str, str] = {
    'JACKET':  'portrait',
    'VEST':    'portrait',
    'PANTS':   'pants_finetuned',
    'BOW_TIE': 'bow_ties_finetuned',
    'TIE':     'ties_finetuned',
    # SHIRT, BELT, SHOES → fallback to 'default'
}

# Filename prefix → product type (used when productId is unknown in bulk-upload flow)
_FILENAME_PREFIXES: list[tuple[str, str]] = [
    ('bow_tie', 'BOW_TIE'),
    ('bowtie',  'BOW_TIE'),
    ('jacket',  'JACKET'),
    ('suit',    'JACKET'),
    ('vest',    'VEST'),
    ('pant',    'PANTS'),
    ('trouser', 'PANTS'),
    ('shirt',   'SHIRT'),
    ('shoe',    'SHOES'),
    ('belt',    'BELT'),
    ('tie',     'TIE'),
]

# Lazy model cache — loaded on first use, then kept warm
_model_cache: dict[str, tuple] = {}


def _load_model(key: str) -> tuple:
    """Load and cache a BiRefNet-family model by registry key."""
    model_id = _MODEL_IDS[key]
    local = Path(model_id)
    print(f"[pipeline] Loading model: {key} ({model_id})")

    if local.is_absolute():
        if not (local / 'config.json').exists():
            print(f"[pipeline] Fine-tuned model not found at {model_id}, falling back to default")
            model = AutoModelForImageSegmentation.from_pretrained(
                _MODEL_IDS['default'], trust_remote_code=True
            )
        else:
            # Treat model directory as a Python package so relative imports work
            finetuned_parent = str(local.parent)
            if finetuned_parent not in sys.path:
                sys.path.insert(0, finetuned_parent)
            pkg = local.name  # e.g. "pants" or "bow_ties"
            birefnet_mod = importlib.import_module(f"{pkg}.birefnet")
            model = birefnet_mod.BiRefNet.from_pretrained(str(local))
    else:
        model = AutoModelForImageSegmentation.from_pretrained(model_id, trust_remote_code=True)

    model.eval()
    t = transforms.Compose([
        transforms.Resize((512, 512)),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    return model, t


def _get_model(key: str) -> tuple:
    if key not in _model_cache:
        _model_cache[key] = _load_model(key)
    return _model_cache[key]


def _infer_type_from_filename(filename: str) -> str | None:
    """Derive product type from filename prefix (e.g. 'suit_001_front.jpg' → 'JACKET')."""
    name = filename.lower()
    # Strip path and extension
    base = re.split(r'[/\\]', name)[-1]
    base = base.rsplit('.', 1)[0]
    for prefix, product_type in _FILENAME_PREFIXES:
        if base.startswith(prefix):
            return product_type
    return None


def _select_model_key(product_type: str | None, filename: str) -> str:
    """Return the model registry key for the given product type, with filename fallback."""
    if not product_type:
        product_type = _infer_type_from_filename(filename)
    return _TYPE_ROUTING.get(product_type or '', 'default')


def _normalize_canvas(img_rgba: Image.Image) -> Image.Image:
    """
    Standardize framing regardless of how the photo was taken:
    1. Crop to the bounding box of non-transparent pixels
    2. Scale to fit a standard canvas, reserving padding on each side
    3. Center on a white background
    Returns an RGB image ready to save.
    """
    bbox = img_rgba.getbbox()
    if bbox:
        img_rgba = img_rgba.crop(bbox)

    cw, ch = img_rgba.size
    pad = int(max(cw, ch) * _PADDING_RATIO)

    # Scale content so that content + padding fills the canvas
    scale = min(_CANVAS_W / (cw + 2 * pad), _CANVAS_H / (ch + 2 * pad))
    new_cw = max(1, int(cw * scale))
    new_ch = max(1, int(ch * scale))
    img_rgba = img_rgba.resize((new_cw, new_ch), Image.LANCZOS)

    canvas = Image.new("RGB", (_CANVAS_W, _CANVAS_H), (255, 255, 255))
    x = (_CANVAS_W - new_cw) // 2
    y = (_CANVAS_H - new_ch) // 2
    canvas.paste(img_rgba, (x, y), mask=img_rgba.split()[3])
    return canvas


def _remove_stand_protrusion(mask: Image.Image) -> Image.Image:
    """
    Cut the mannequin stand from the bottom of the mask.
    Stand = narrow vertical protrusion: rows in the bottom 40% of the image
    where foreground width is < 15% of the global max mask width.
    """
    arr = np.array(mask)
    h, w = arr.shape
    row_widths = np.array([np.sum(arr[r] > 127) for r in range(h)], dtype=float)
    global_max = row_widths.max()
    if global_max == 0:
        return mask
    stand_threshold = global_max * 0.15
    search_start = int(h * 0.60)
    bottom_widths = row_widths[search_start:]
    stand_rows = np.where((bottom_widths > 0) & (bottom_widths < stand_threshold))[0]
    if len(stand_rows) == 0:
        return mask
    cut_row = search_start + int(stand_rows[0])
    result = arr.copy()
    result[cut_row:] = 0
    return Image.fromarray(result, mode='L')


def _remove_background(model, transform, pil_image: Image.Image, product_type: str | None = None) -> Image.Image:
    """Remove background with the given model; returns RGBA image."""
    tensor = transform(pil_image.convert("RGB")).unsqueeze(0)
    with torch.no_grad():
        preds = model(tensor)[-1].sigmoid().cpu()
    mask = transforms.ToPILImage()(preds[0].squeeze()).resize(pil_image.size)
    if product_type in ('JACKET', 'VEST', 'SHIRT'):
        mask = _remove_stand_protrusion(mask)
    result = pil_image.convert("RGBA")
    result.putalpha(mask)
    return result


def process_image(image_bytes: bytes, filename: str = "image.jpg", product_type: str | None = None) -> bytes:
    """
    Full processing pipeline for a raw product photo:
    1. Select model based on product_type (or filename inference if unknown)
    2. Remove background with chosen BiRefNet variant
    3. Enhance sharpness, contrast, and color saturation
    4. Composite onto a clean white background
    5. Return as high-quality JPEG bytes
    """
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(image_bytes))).convert("RGB")

    model_key = _select_model_key(product_type, filename)
    model, transform = _get_model(model_key)

    img_rgba = _remove_background(model, transform, img, product_type)
    r, g, b, a = img_rgba.split()
    rgb = Image.merge("RGB", (r, g, b))

    rgb = ImageEnhance.Sharpness(rgb).enhance(1.4)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.1)
    rgb = ImageEnhance.Color(rgb).enhance(1.15)

    r2, g2, b2 = rgb.split()
    img_rgba = Image.merge("RGBA", (r2, g2, b2, a))

    background = _normalize_canvas(img_rgba)

    out = io.BytesIO()
    background.save(out, format="JPEG", quality=92)
    return out.getvalue()

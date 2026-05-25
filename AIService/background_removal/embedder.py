"""
CLIP image embedder — produces a normalized 512-dim vector for any PIL image.
Model is lazy-loaded on first call and cached for the lifetime of the process.
"""
import io
import torch
import numpy as np
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

_CLIP_MODEL_ID = "openai/clip-vit-base-patch32"

_model: CLIPModel | None = None
_processor: CLIPProcessor | None = None


def _get_clip() -> tuple[CLIPModel, CLIPProcessor]:
    global _model, _processor
    if _model is None:
        print("[embedder] Loading CLIP model...")
        _model = CLIPModel.from_pretrained(_CLIP_MODEL_ID)
        _processor = CLIPProcessor.from_pretrained(_CLIP_MODEL_ID)
        _model.eval()
        print("[embedder] CLIP model ready")
    return _model, _processor


# Base color reference points in RGB space — one entry per base color (English key).
# Variants (LIGHT_, DARK_, _DOTTED, _STRIPED) are handled by prefix extraction in the backend.
# RGB values calibrated for center-cropped garment photos.
_COLOR_REFS: dict[str, tuple[int, int, int]] = {
    "BLACK":      (20,  20,  20),
    "WHITE":      (245, 245, 245),
    "BROWN":      (110, 70,  35),
    "RED":        (180, 30,  30),
    "GRAY":       (128, 128, 128),
    "SKY_BLUE":   (80,  170, 220),
    "YELLOW":     (230, 200, 50),
    "CREAM":      (235, 215, 175),
    "IVORY":      (245, 235, 210),
    "PURPLE":     (100, 50,  150),
    "NAVY":       (25,  50,  130),
    "ORANGE":     (220, 110, 30),
    "GREEN":      (40,  120, 40),
    "OLIVE":      (90,  110, 50),
    "PINK":       (220, 140, 160),
    "BURGUNDY":   (110, 20,  35),
    "TURQUOISE":  (40,  180, 170),
    "BEIGE":      (185, 158, 120),
}


def detect_dominant_color(image_bytes: bytes) -> str | None:
    """
    Returns the dominant color name for a garment image using HSV classification.

    Uses HSV instead of RGB L2 distance so that dark colors (NAVY, BURGUNDY) are
    not collapsed into BLACK — the hue channel is brightness-invariant, meaning a
    dark navy pixel and a bright navy pixel share the same hue even though their
    RGB values are far apart in Euclidean space.

    The old near-black RGB filter has been removed: it incorrectly discarded dark
    garment pixels (e.g. very dark burgundy with all channels < 35), leaving only
    neutral gray pixels which then matched BLACK.
    """
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = image.size
    # Crop to center — where the main garment sits in AI-processed portrait images
    image = image.crop((int(w * 0.2), int(h * 0.17), int(w * 0.8), int(h * 0.82)))

    pixels = np.array(image).reshape(-1, 3).astype(np.float32)

    # Only exclude the white background added by the AI pipeline
    is_white = (pixels[:, 0] > 225) & (pixels[:, 1] > 225) & (pixels[:, 2] > 225)
    foreground = pixels[~is_white]

    if len(foreground) < 100:
        return None

    # Histogram mode: find the most common 16-value color bin
    quantized = np.clip((foreground / 16).astype(int), 0, 15)
    keys = quantized[:, 0] * 256 + quantized[:, 1] * 16 + quantized[:, 2]
    unique_keys, counts = np.unique(keys, return_counts=True)
    dominant_key = int(unique_keys[np.argmax(counts)])

    r_bin = dominant_key // 256
    g_bin = (dominant_key // 16) % 16
    b_bin = dominant_key % 16
    # Normalize bin center to [0, 1]
    r = float(r_bin * 16 + 8) / 255.0
    g = float(g_bin * 16 + 8) / 255.0
    b = float(b_bin * 16 + 8) / 255.0

    # RGB → HSV
    cmax = max(r, g, b)
    cmin = min(r, g, b)
    delta = cmax - cmin

    val = cmax
    sat = (delta / cmax) if cmax > 0 else 0.0

    if delta > 0:
        if cmax == r:
            hue = (60.0 * ((g - b) / delta)) % 360.0
        elif cmax == g:
            hue = (60.0 * ((b - r) / delta)) + 120.0
        else:
            hue = (60.0 * ((r - g) / delta)) + 240.0
        if hue < 0:
            hue += 360.0
    else:
        hue = 0.0

    # Warm neutrals: IVORY / CREAM / BEIGE
    # Checked before the achromatic path so that very-low-sat warm items
    # (e.g. ivory ties) aren't collapsed into WHITE.
    if 20.0 <= hue <= 65.0:
        # Bright warm neutrals — covers ivory/cream/beige
        if val > 0.70 and sat < 0.55:
            if sat < 0.18:
                return "IVORY"
            return "CREAM" if val > 0.85 else "BEIGE"
        # Medium-brightness tan/camel — require real saturation (≥ 0.20) so that
        # slightly-warm grays (sat ≈ 0.15) don't land here.
        if val > 0.45 and 0.20 <= sat < 0.55:
            return "BEIGE"

    # Achromatic: BLACK / GRAY / WHITE
    if sat < 0.15:
        if val < 0.25:
            return "BLACK"
        if val < 0.65:
            return "GRAY"
        return "WHITE"

    # Chromatic colors — hue decides, brightness refines within families

    # Red / Burgundy / Pink  (wraps around 0°)
    if hue < 18.0 or hue >= 325.0:
        if val > 0.68:
            return "PINK"
        return "BURGUNDY" if val < 0.45 else "RED"

    # Orange / Brown  (warm, low-medium hue)
    if hue < 45.0:
        # Barely-chromatic warm pixels (sat just above achromatic threshold) are
        # warm grays, not brown — brown requires real saturation.
        if sat < 0.25:
            return "GRAY"
        return "BROWN" if (val < 0.58 or sat < 0.65) else "ORANGE"

    # Yellow
    if hue < 75.0:
        return "YELLOW"

    # Green / Olive  (yellow-green through pure green)
    if hue < 165.0:
        # Olive: more yellow-green (hue < 105°) or darker/less saturated greens
        if hue < 105.0 or val < 0.45 or sat < 0.50:
            return "OLIVE"
        return "GREEN"

    # Turquoise / Teal
    if hue < 200.0:
        return "TURQUOISE"

    # Blue: NAVY (dark) vs SKY_BLUE (bright)
    if hue < 252.0:
        return "NAVY" if val < 0.55 else "SKY_BLUE"

    # Purple / Violet
    if hue < 295.0:
        return "PURPLE"

    # Magenta / Pink (high hue, warm side)
    return "PINK"


def _contains_hebrew(text: str) -> bool:
    return any('֐' <= c <= '׿' or 'יִ' <= c <= 'ﭏ' for c in text)


# Words that GoogleTranslate gets wrong in isolation without garment context.
# Applied word-by-word before the full query is sent for translation.
_HEBREW_WORD_FIXES: dict[str, str] = {
    'חום':   'brown',
    'חומה':  'brown',
    'חומים': 'brown',
    'חומות': 'brown',
    "בז'":   'beige',
    'בז':    'beige',
}


def _apply_word_fixes(text: str) -> str:
    return ' '.join(_HEBREW_WORD_FIXES.get(w, w) for w in text.split())


def embed_text(text: str) -> list[float]:
    """
    Embed a text query with CLIP's text encoder.
    CLIP is trained on English text — Hebrew queries are auto-translated to English
    via GoogleTranslator before embedding so cross-lingual search works correctly.
    Returns a unit-normalized list of 512 floats compatible with image embeddings.
    """
    query = text
    if _contains_hebrew(text):
        try:
            from deep_translator import GoogleTranslator
            fixed = _apply_word_fixes(text)
            translated = GoogleTranslator(source="iw", target="en").translate(fixed)
            if translated:
                print(f"[embedder] Translated query: '{text}' → '{translated}'")
                query = translated
        except Exception as e:
            print(f"[embedder] Translation failed, using original text: {e}")

    model, processor = _get_clip()
    inputs = processor(text=[query], return_tensors="pt", padding=True, truncation=True)
    with torch.no_grad():
        features = model.get_text_features(**inputs)
        features = features / features.norm(dim=-1, keepdim=True)
    return features[0].tolist()


def embed_image(image_bytes: bytes) -> list[float]:
    """
    Embed raw image bytes with CLIP.
    Returns a unit-normalized list of 512 floats suitable for cosine similarity.
    """
    model, processor = _get_clip()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        features = model.get_image_features(**inputs)
        features = features / features.norm(dim=-1, keepdim=True)

    return features[0].tolist()

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
    return any('א' <= c <= 'ת' for c in text)


# ── Hebrew fashion vocabulary ─────────────────────────────────────────────────
#
# Maps Hebrew words → list of English synonyms (CLIP-friendly phrases).
# First entry is the primary translation; extras enable prompt ensembling.
# Prompt ensembling averages multiple CLIP embeddings to produce a more robust
# query vector — shown in the original CLIP paper to improve zero-shot accuracy.
FASHION_SYNONYMS: dict[str, list[str]] = {
    # Jackets / Suits
    'חליפה':    ['suit jacket', "men's blazer", 'formal jacket'],
    'חליפות':   ['suit jackets', "men's blazers", 'formal jackets'],
    "ג'קט":     ['jacket', 'blazer', 'suit jacket'],
    "ז'קט":     ['jacket', 'blazer', 'suit jacket'],
    "ג'קטים":   ['jackets', 'blazers'],
    "ז'קטים":   ['jackets', 'blazers'],
    # Vests
    'ווסט':     ['suit vest', 'waistcoat', "men's vest"],
    'וסט':      ['suit vest', 'waistcoat', "men's vest"],
    'ווסטים':   ['suit vests', 'waistcoats'],
    'וסטים':    ['suit vests', 'waistcoats'],
    # Pants
    'מכנסיים':  ['dress trousers', 'formal pants', "men's trousers"],
    'מכנס':     ['trousers', 'dress pants'],
    # Shirts
    'חולצה':    ['dress shirt', 'formal shirt', 'button-down shirt'],
    'חולצות':   ['dress shirts', 'formal shirts'],
    # Ties
    'עניבה':    ['necktie', 'tie', "men's dress tie"],
    'עניבות':   ['neckties', 'ties'],
    # Bow ties (single-word forms; two-word phrase handled by _PHRASE_SUBS)
    'פרפרית':   ['bow tie', 'bowtie'],
    # Belts
    'חגורה':    ['belt', 'dress belt', 'leather belt'],
    'חגורות':   ['belts', 'dress belts'],
    # Shoes
    'נעליים':   ['dress shoes', 'formal shoes', 'leather shoes'],
    'נעל':      ['dress shoe', 'formal shoe'],
    # Colors — single synonym each (no ensembling needed; colors are precise)
    'שחור':     ['black'],   'שחורה':   ['black'],
    'שחורים':   ['black'],   'שחורות':  ['black'],
    'לבן':      ['white'],   'לבנה':    ['white'],
    'לבנים':    ['white'],   'לבנות':   ['white'],
    'חום':      ['brown'],   'חומה':    ['brown'],
    'חומים':    ['brown'],   'חומות':   ['brown'],
    'אפור':     ['gray'],    'אפורה':   ['gray'],
    'אפורים':   ['gray'],    'אפורות':  ['gray'],
    'כחול':     ['navy blue'],  'כחולה':    ['navy blue'],
    'כחולים':   ['navy blue'],  'כחולות':   ['navy blue'],
    'נייבי':    ['navy blue'],
    'תכלת':     ['sky blue', 'light blue'],
    'אדום':     ['red'],     'אדומה':   ['red'],
    'אדומים':   ['red'],     'אדומות':  ['red'],
    'ירוק':     ['green'],   'ירוקה':   ['green'],
    'ירוקים':   ['green'],   'ירוקות':  ['green'],
    'ורוד':     ['pink'],    'ורודה':   ['pink'],
    'ורודים':   ['pink'],    'ורודות':  ['pink'],
    'סגול':     ['purple'],  'סגולה':   ['purple'],
    'סגולים':   ['purple'],  'סגולות':  ['purple'],
    'כתום':     ['orange'],  'כתומה':   ['orange'],
    'צהוב':     ['yellow'],  'צהובה':   ['yellow'],
    "בז'":      ['beige'],   'בז':      ['beige'],
    "בז׳":      ['beige'],
    'קרם':      ['cream'],
    'שמנת':     ['ivory'],
    'בורדו':    ['burgundy'],
    'טורקיז':   ['turquoise'],
    'זית':      ['olive'],
    # Patterns — single synonym each
    'מפוספס':   ['striped'],  'מפוספסת':  ['striped'],
    'מפוספסים': ['striped'],  'מפוספסות': ['striped'],
    'פסים':     ['striped'],  'פס':       ['striped'],
    'מנוקד':    ['dotted'],   'מנוקדת':   ['dotted'],
    'מנוקדים':  ['dotted'],   'מנוקדות':  ['dotted'],
    'נקודות':   ['polka dot', 'dotted'],
}

# Multi-word Hebrew phrases to substitute before word-level processing.
_PHRASE_SUBS: dict[str, list[str]] = {
    'עניבת פרפר': ['bow tie', 'bowtie', "men's bow tie"],
}

# Words that GoogleTranslate gets wrong — used in the fallback path.
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


def _encode_texts_averaged(phrases: list[str]) -> list[float]:
    """Encode phrases with CLIP and return their averaged, renormalized embedding."""
    model, processor = _get_clip()
    inputs = processor(text=phrases, return_tensors="pt", padding=True, truncation=True)
    with torch.no_grad():
        features = model.get_text_features(**inputs)
        features = features / features.norm(dim=-1, keepdim=True)
        avg = features.mean(dim=0)
        avg = avg / avg.norm()
    return avg.tolist()


def embed_text(text: str) -> list[float]:
    """
    Embed a text query with CLIP's text encoder.
    For Hebrew queries, attempts word-by-word translation using FASHION_SYNONYMS
    and builds multiple phrase variants (prompt ensembling) to produce a more
    robust embedding. Falls back to GoogleTranslator for unknown Hebrew words.
    Returns a unit-normalized list of 512 floats compatible with image embeddings.
    """
    query = text.strip()

    if not _contains_hebrew(query):
        return _encode_texts_averaged([query])

    # Sub known multi-word phrases before word-level processing
    phrase_synonym_sets: list[list[str]] = []
    for phrase, synonyms in _PHRASE_SUBS.items():
        if phrase in query:
            query = query.replace(phrase, synonyms[0])
            if len(synonyms) > 1:
                phrase_synonym_sets.append(synonyms)

    words = query.split()
    translated: list[str] = []
    # Track positions with multiple synonyms for ensembling (only the first type-word)
    ensemble_pos: tuple[int, list[str]] | None = None

    for word in words:
        if word in FASHION_SYNONYMS:
            syns = FASHION_SYNONYMS[word]
            translated.append(syns[0])
            if ensemble_pos is None and len(syns) > 1:
                ensemble_pos = (len(translated) - 1, syns)
        elif _contains_hebrew(word):
            # Unknown Hebrew word — fall back to Google Translate
            try:
                from deep_translator import GoogleTranslator
                fixed = _apply_word_fixes(text)
                result = GoogleTranslator(source="iw", target="en").translate(fixed)
                if result:
                    print(f"[embedder] Translated (fallback): '{text}' → '{result}'")
                    return _encode_texts_averaged([result])
            except Exception as e:
                print(f"[embedder] Translation failed, using original: {e}")
            return _encode_texts_averaged([text])
        else:
            translated.append(word)

    # Build variant phrases for prompt ensembling
    base = ' '.join(translated)
    variants: list[str] = [base]

    if ensemble_pos is not None:
        pos, syns = ensemble_pos
        for syn in syns[1:]:
            v = translated.copy()
            v[pos] = syn
            variants.append(' '.join(v))
    elif phrase_synonym_sets:
        # Phrase-level ensembling (e.g. "עניבת פרפר")
        for extra_syn in phrase_synonym_sets[0][1:]:
            variants.append(base.replace(phrase_synonym_sets[0][0], extra_syn))

    print(f"[embedder] Word-dict query: '{text}' → {variants}")
    return _encode_texts_averaged(variants)


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

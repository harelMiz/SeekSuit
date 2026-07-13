"""
detector.py
Multi-item clothing detection using YOLOS fine-tuned on Fashionpedia.
Detects multiple garment types in a single fashion photo and returns
bounding boxes + cropped previews so the user can pick which item to search for.
"""

import io
import base64
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForObjectDetection

_MODEL_ID = "valentinafeve/yolos-fashionpedia"

_model: AutoModelForObjectDetection | None = None
_processor: AutoImageProcessor | None = None

# Map Fashionpedia label substrings to our ProductType enum.
# Checked as lowercase substring so "shirt, blouse" matches "shirt".
LABEL_TO_TYPE: dict[str, str] = {
    "jacket":  "JACKET",
    "vest":    "VEST",
    "pants":   "PANTS",
    "shorts":  "PANTS",
    "shirt":   "SHIRT",
    "tie":     "TIE",
    "shoe":    "SHOES",
    "belt":    "BELT",
    "bow":     "BOW_TIE",
}

CROP_PADDING = 12

# Small accessories occupy much less of the frame than jackets/pants.
# Run post_process at the smaller threshold so they aren't dropped early,
# then apply per-type minimums in the loop.
SMALL_TYPES = {"BOW_TIE", "SHOES", "TIE", "BELT"}
SCORE_THRESHOLD = 0.40         # global floor for post_process (catches small accessories)
SCORE_THRESHOLD_LARGE = 0.50   # stricter floor for large garments (jacket, pants, shirt, vest)
MIN_AREA_FRACTION_LARGE = 0.03 # 3 % of image area — large garments
MIN_AREA_FRACTION_SMALL = 0.008 # 0.8 % — accessories visible only as small regions
# Ties/bow-ties are small enough that their tightest, most accurate candidate
# box often falls below MIN_AREA_FRACTION_SMALL — which then lets a looser,
# less accurate (but bigger) box win instead. Give them their own, lower floor.
MIN_AREA_FRACTION_TIE = 0.003
# A full suit/blazer is sometimes labeled "shirt, blouse" by the model with
# high confidence while its own "jacket" label never clears SCORE_THRESHOLD_LARGE.
# "lapel" is a much lower bar to treat as jacket evidence — lapels don't exist
# on a plain shirt, so any reasonably confident lapel detection is a reliable
# proxy signal even when the model won't commit to labeling the jacket itself.
LAPEL_CONFIDENCE_THRESHOLD = 0.35


def _get_model() -> tuple[AutoModelForObjectDetection, AutoImageProcessor]:
    global _model, _processor
    if _model is None:
        print("[detector] Loading YOLOS-Fashionpedia model...")
        _processor = AutoImageProcessor.from_pretrained(_MODEL_ID)
        _model = AutoModelForObjectDetection.from_pretrained(_MODEL_ID)
        _model.eval()
        print("[detector] YOLOS-Fashionpedia model ready")
    return _model, _processor


def _resolve_type(label: str) -> str | None:
    label_lower = label.lower()
    for key, product_type in LABEL_TO_TYPE.items():
        if key in label_lower:
            return product_type
    return None


def _crop_to_data_url(image: Image.Image, bbox: list[int]) -> str:
    """Crop image to bbox (with padding) and return as JPEG data URL."""
    x1, y1, x2, y2 = bbox
    x1 = max(0, x1 - CROP_PADDING)
    y1 = max(0, y1 - CROP_PADDING)
    x2 = min(image.width,  x2 + CROP_PADDING)
    y2 = min(image.height, y2 + CROP_PADDING)
    crop = image.crop((x1, y1, x2, y2))
    buf = io.BytesIO()
    crop.save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/jpeg;base64,{b64}"


def detect_items(image_bytes: bytes) -> list[dict]:
    """
    Detect multiple clothing items in an image using YOLOS-Fashionpedia.
    Returns at most one item per ProductType (highest confidence per type),
    sorted by confidence descending.
    Each item dict: { type, label, confidence, bbox, cropDataUrl }
    """
    model, processor = _get_model()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_area = image.width * image.height

    inputs = processor(images=image, return_tensors="pt")

    with torch.no_grad():
        outputs = model(**inputs)

    target_sizes = torch.tensor([[image.height, image.width]])
    results = processor.post_process_object_detection(
        outputs,
        threshold=SCORE_THRESHOLD,
        target_sizes=target_sizes,
    )[0]

    best_per_type: dict[str, dict] = {}
    # Neckwear (ties/bow-ties): track only the single highest-confidence candidate
    # across TIE and BOW_TIE together, checked against the area floor *after*
    # picking it (fail-closed). A tie's tightest, correct box is often tiny, and
    # its next-best alternative is usually a looser box that grabbed nearby
    # collar/shirt fabric rather than a better detection of the tie itself — so
    # falling back to it just trades one wrong box for another. Better to show
    # no tie/bow-tie than a mislocated one. They compete in one shared bucket
    # (not one per type) so the same physical item can't surface twice as both
    # a "tie" and a "bow tie" candidate.
    neckwear_top_candidate: dict | None = None
    best_lapel_confidence = 0.0

    for score, label_id, box in zip(results["scores"], results["labels"], results["boxes"]):
        label = model.config.id2label[int(label_id)]
        if "lapel" in label.lower():
            best_lapel_confidence = max(best_lapel_confidence, float(score))

        product_type = _resolve_type(label)
        if product_type is None:
            continue

        confidence = float(score)
        bbox = [int(v) for v in box.tolist()]

        is_small = product_type in SMALL_TYPES
        min_conf = SCORE_THRESHOLD if is_small else SCORE_THRESHOLD_LARGE
        if confidence < min_conf:
            continue

        box_area = max(0, bbox[2] - bbox[0]) * max(0, bbox[3] - bbox[1])

        if product_type == "TIE" or product_type == "BOW_TIE":
            if neckwear_top_candidate is None or confidence > neckwear_top_candidate["confidence"]:
                neckwear_top_candidate = {
                    "type":       product_type,
                    "label":      label,
                    "confidence": round(confidence, 3),
                    "bbox":       bbox,
                    "box_area":   box_area,
                }
            continue

        min_area = MIN_AREA_FRACTION_SMALL if is_small else MIN_AREA_FRACTION_LARGE
        if box_area < img_area * min_area:
            continue

        if product_type not in best_per_type or confidence > best_per_type[product_type]["confidence"]:
            best_per_type[product_type] = {
                "type":       product_type,
                "label":      label,
                "confidence": round(confidence, 3),
                "bbox":       bbox,
            }

    if neckwear_top_candidate is not None and neckwear_top_candidate.pop("box_area") >= img_area * MIN_AREA_FRACTION_TIE:
        # Fashionpedia has no real "bow tie" neckwear class (its "bow" label is a
        # decorative-bow embellishment, unrelated to neckwear) — every bow tie is
        # detected as "TIE". Tell them apart by the winning box's own shape: a
        # necktie hangs down the chest (tall/narrow), a bow tie sits at the
        # collar (wide/short).
        if neckwear_top_candidate["type"] == "TIE":
            x1, y1, x2, y2 = neckwear_top_candidate["bbox"]
            if (x2 - x1) > (y2 - y1):
                neckwear_top_candidate["type"] = "BOW_TIE"
        best_per_type[neckwear_top_candidate["type"]] = neckwear_top_candidate

    # A shirt's bbox typically spans the whole visible torso, so when a jacket or
    # vest is also detected in the same photo, the shirt crop is mostly covered by
    # that outer garment and its color/embedding can't be trusted — drop it. A
    # confident lapel detection counts as jacket evidence too, since lapels only
    # exist on jackets/blazers/suits, never on a plain shirt.
    has_jacket_evidence = (
        "JACKET" in best_per_type
        or "VEST" in best_per_type
        or best_lapel_confidence >= LAPEL_CONFIDENCE_THRESHOLD
    )
    if "SHIRT" in best_per_type and has_jacket_evidence:
        del best_per_type["SHIRT"]

    # Attach crop previews and sort by confidence
    detected = []
    for item in sorted(best_per_type.values(), key=lambda x: -x["confidence"]):
        item["cropDataUrl"] = _crop_to_data_url(image, item["bbox"])
        detected.append(item)

    return detected

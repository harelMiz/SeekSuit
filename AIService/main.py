import os
import time
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from supabase import create_client

from bg_removal import process_image
from image_search import embed_image, embed_text, detect_dominant_color
from clothing_detector import detect_items

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PROCESSED_BUCKET = "processed-images"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

app = FastAPI(title="SeekSuit AI Service")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/process")
async def process(
    file: UploadFile = File(...),
    product_type: str | None = Form(None),
):
    """
    Accepts a raw product image, runs the AI pipeline, uploads the result
    to Supabase, and returns the signed URL + CLIP embedding.

    Optional form field:
      product_type — Prisma ProductType enum value (e.g. JACKET, PANTS).
                     If omitted, the pipeline infers type from the filename.
    """
    image_bytes = await file.read()

    try:
        result_bytes = process_image(image_bytes, filename=file.filename or "image.jpg", product_type=product_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {e}")

    # Upload processed image to Supabase Storage
    filename = f"products/{int(time.time() * 1000)}_{file.filename}"
    response = supabase.storage.from_(PROCESSED_BUCKET).upload(
        filename,
        result_bytes,
        {"content-type": "image/jpeg", "upsert": "false"},
    )

    if hasattr(response, "error") and response.error:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {response.error}")

    signed = supabase.storage.from_(PROCESSED_BUCKET).create_signed_url(
        filename, 60 * 60 * 24 * 365 * 10
    )
    signed_url = signed.get("signedURL") or signed.get("signedUrl")
    if not signed_url:
        raise HTTPException(status_code=500, detail="Failed to create signed URL")

    # Generate CLIP embedding and detect dominant color from the processed image
    try:
        embedding = embed_image(result_bytes)
        dominant_color = detect_dominant_color(result_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {e}")

    return {"processedImageUrl": signed_url, "embedding": embedding, "dominantColor": dominant_color}


@app.post("/process-preview")
async def process_preview(
    file: UploadFile = File(...),
    product_type: str | None = Form(None),
):
    """
    Same pipeline as /process (background removal + enhancement) but returns
    the processed JPEG bytes directly instead of uploading to Supabase.
    Used for local batch testing (e.g. VTO sample preparation).
    """
    image_bytes = await file.read()
    try:
        result_bytes = process_image(image_bytes, filename=file.filename or "image.jpg", product_type=product_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {e}")
    return Response(content=result_bytes, media_type="image/jpeg")


@app.post("/embed")
async def embed(file: UploadFile = File(...)):
    """
    Accepts any image (e.g. a customer query photo) and returns its CLIP embedding
    plus the detected dominant color category (e.g. "BEIGE", "BLACK").
    Used by the backend for visual similarity search — no background removal applied.
    """
    image_bytes = await file.read()
    try:
        embedding = embed_image(image_bytes)
        dominant_color = detect_dominant_color(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {e}")
    return {"embedding": embedding, "dominantColor": dominant_color}


@app.post("/detect")
async def detect_endpoint(file: UploadFile = File(...)):
    """
    Detect multiple clothing items in an image using OWL-ViT.
    Returns a list of detected items with type, bounding box, confidence,
    and a cropped preview image (base64 data URL) for each item.
    Used by the frontend to let users select which garment to search for
    when an uploaded photo contains more than one item.
    """
    image_bytes = await file.read()
    try:
        items = detect_items(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection failed: {e}")
    return {"items": items, "multipleFound": len(items) > 1}


@app.post("/front-detect")
async def front_detect(
    file: UploadFile = File(...),
    garment_type: str | None = Form(None),
):
    """
    Detects whether an image shows the front view of a jacket or vest.
    Uses CLIP zero-shot classification against front/back/side prompts.
    Returns { isFront: bool, confidence: float (0-1) }.
    """
    image_bytes = await file.read()

    gtype = (garment_type or "jacket").lower()
    label = "vest" if "vest" in gtype else "jacket"

    candidates = [
        f"front view of a {label}",
        f"back view of a {label}",
        f"side view of a {label}",
        f"close-up detail of {label} fabric",
    ]

    try:
        from image_search import _get_clip
        from PIL import Image as PILImage
        import io as _io
        import torch as _torch
        model, processor = _get_clip()
        image = PILImage.open(_io.BytesIO(image_bytes)).convert("RGB")
        inputs = processor(text=candidates, images=image, return_tensors="pt", padding=True)
        with _torch.no_grad():
            outputs = model(**inputs)
        probs = outputs.logits_per_image.softmax(dim=1)[0].tolist()
        front_score = float(probs[0])
        return {"isFront": front_score >= 0.40, "confidence": round(front_score, 4)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Front detection failed: {e}")


@app.post("/embed-text")
async def embed_text_endpoint(text: str = Form(...)):
    """
    Accepts a text query and returns its CLIP text embedding.
    The resulting 512-dim vector is compatible with image embeddings for cross-modal search.
    """
    if not text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    try:
        embedding = embed_text(text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text embedding failed: {e}")
    return {"embedding": embedding}

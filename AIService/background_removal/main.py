import os
import time
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from supabase import create_client

from pipeline import process_image
from embedder import embed_image, embed_text, detect_dominant_color

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

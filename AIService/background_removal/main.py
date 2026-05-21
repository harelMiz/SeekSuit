import os
import time
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from supabase import create_client

from pipeline import process_image

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
    Accepts a raw product image, runs the AI pipeline,
    uploads the result to Supabase processed-images bucket,
    and returns the public signed URL.

    Optional form field:
      product_type — Prisma ProductType enum value (e.g. JACKET, PANTS).
                     If omitted, the pipeline infers type from the filename,
                     falling back to the default BiRefNet model.
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

    # Generate a long-lived signed URL (10 years) for storing in the DB
    signed = supabase.storage.from_(PROCESSED_BUCKET).create_signed_url(
        filename, 60 * 60 * 24 * 365 * 10
    )
    signed_url = signed.get("signedURL") or signed.get("signedUrl")
    if not signed_url:
        raise HTTPException(status_code=500, detail="Failed to create signed URL")

    return {"processedImageUrl": signed_url}

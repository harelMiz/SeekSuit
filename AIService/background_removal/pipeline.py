import io
from rembg import remove
from PIL import Image, ImageEnhance


def process_image(image_bytes: bytes) -> bytes:
    """
    Full processing pipeline for a raw product photo:
    1. Remove background using rembg (pre-trained U-2-Net)
    2. Enhance sharpness, contrast, and color saturation
    3. Composite onto a clean white background
    4. Return as high-quality JPEG bytes
    """
    # Step 1: Background removal — outputs RGBA PNG with transparent background
    removed_bytes = remove(image_bytes)

    # Step 2: Load into PIL and split channels
    img = Image.open(io.BytesIO(removed_bytes)).convert("RGBA")
    r, g, b, a = img.split()
    rgb = Image.merge("RGB", (r, g, b))

    # Step 3: Enhancement (applied only to the garment, not the background)
    rgb = ImageEnhance.Sharpness(rgb).enhance(1.4)   # crisper fabric details
    rgb = ImageEnhance.Contrast(rgb).enhance(1.1)    # mild contrast boost
    rgb = ImageEnhance.Color(rgb).enhance(1.15)      # more accurate color

    # Step 4: Recombine with original alpha mask
    r2, g2, b2 = rgb.split()
    result = Image.merge("RGBA", (r2, g2, b2, a))

    # Step 5: Paste onto white background for clean catalog look
    background = Image.new("RGB", result.size, (255, 255, 255))
    background.paste(result, mask=a)

    # Step 6: Output as high-quality JPEG
    out = io.BytesIO()
    background.save(out, format="JPEG", quality=92)
    return out.getvalue()

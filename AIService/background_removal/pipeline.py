import io
from PIL import Image, ImageEnhance
from transformers import AutoModelForImageSegmentation
import torch
from torchvision import transforms

# Load RMBG-2.0 model once at startup (singleton — avoids reloading on every request)
_model = AutoModelForImageSegmentation.from_pretrained("ZhengPeng7/BiRefNet", trust_remote_code=True)
_model.eval()

_transform = transforms.Compose([
    transforms.Resize((512, 512)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])


def _remove_background(pil_image: Image.Image) -> Image.Image:
    """Remove background using RMBG-2.0, returns RGBA image with transparent background."""
    input_tensor = _transform(pil_image.convert("RGB")).unsqueeze(0)
    with torch.no_grad():
        preds = _model(input_tensor)[-1].sigmoid().cpu()
    mask = transforms.ToPILImage()(preds[0].squeeze()).resize(pil_image.size)
    result = pil_image.convert("RGBA")
    result.putalpha(mask)
    return result


def process_image(image_bytes: bytes) -> bytes:
    """
    Full processing pipeline for a raw product photo:
    1. Remove background using BiRefNet (state-of-the-art background removal)
    2. Enhance sharpness, contrast, and color saturation
    3. Composite onto a clean white background
    4. Return as high-quality JPEG bytes
    """
    # Step 1: Load image
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # Step 2: Background removal — returns RGBA with transparent background
    img_rgba = _remove_background(img)
    r, g, b, a = img_rgba.split()
    rgb = Image.merge("RGB", (r, g, b))

    # Step 3: Enhancement (applied to the garment only, not the background)
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

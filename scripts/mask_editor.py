"""
Local Gradio tool for editing VTO masks per model photo.

Draw in WHITE over the area where you want the garment to appear.
The mask is saved as {photo_stem}_mask.png next to the photo.
The batch script will use it automatically on the next run.

Usage:
    pip install gradio pillow
    python scripts/mask_editor.py
    Open http://localhost:7860
"""

import gradio as gr
from pathlib import Path
from PIL import Image
import numpy as np

SCRIPTS_DIR = Path(__file__).parent
MODELS_DIR  = SCRIPTS_DIR / "vto_models"

MAX_DISPLAY_W = 700   # max width in the editor (pixels)


def _photo_choices() -> list[str]:
    choices = []
    for model_dir in sorted(MODELS_DIR.iterdir()):
        if not model_dir.is_dir():
            continue
        for photo in sorted(list(model_dir.glob("*.png")) + list(model_dir.glob("*.jpg"))):
            if not photo.stem.endswith("_mask"):
                choices.append(str(photo))
    return choices


def _display_size(orig_w: int, orig_h: int) -> tuple[int, int]:
    scale = min(1.0, MAX_DISPLAY_W / orig_w)
    return int(orig_w * scale), int(orig_h * scale)


def load_for_editor(photo_path: str):
    if not photo_path:
        return None, "בחר תמונה"

    p = Path(photo_path)
    photo = Image.open(p).convert("RGB")
    orig_w, orig_h = photo.size
    dw, dh = _display_size(orig_w, orig_h)
    photo_display = np.array(photo.resize((dw, dh), Image.LANCZOS))

    mask_path = p.parent / f"{p.stem}_mask.png"
    if mask_path.exists():
        existing = np.array(Image.open(mask_path).convert("L").resize((dw, dh), Image.NEAREST))
        layer = np.zeros((dh, dw, 4), dtype=np.uint8)
        layer[:, :, 0] = 255
        layer[:, :, 1] = 255
        layer[:, :, 2] = 255
        layer[:, :, 3] = existing
        layers = [layer]
        status = f"נטענה מסכה קיימת: {mask_path.name}"
    else:
        layers = [np.zeros((dh, dw, 4), dtype=np.uint8)]
        status = "אין מסכה — צייר עם לבן את אזור החליפה"

    return {
        "background": photo_display,
        "layers": layers,
        "composite": photo_display,
    }, status


def save_mask(photo_path: str, editor_value):
    if not photo_path:
        return "בחר תמונה תחילה"
    if editor_value is None:
        return "אין מסכה לשמירה"

    layers = editor_value.get("layers", [])
    if not layers or layers[0] is None:
        return "צייר מסכה תחילה"

    layer = np.asarray(layers[0], dtype=np.uint8)
    mask_display = layer[:, :, 3] if layer.ndim == 3 and layer.shape[2] == 4 else layer[:, :, 0]

    p = Path(photo_path)
    orig_w, orig_h = Image.open(p).size
    mask_path = p.parent / f"{p.stem}_mask.png"
    Image.fromarray(mask_display, "L").resize((orig_w, orig_h), Image.NEAREST).save(str(mask_path))

    coverage = mask_display.mean() / 255 * 100
    return f"נשמר: {mask_path.name}  (כיסוי {coverage:.1f}%)"


def clear_mask(photo_path: str, editor_value):
    if not editor_value:
        return editor_value, "אין מה לנקות"

    bg = editor_value.get("background")
    h, w = (bg.shape[0], bg.shape[1]) if bg is not None else (512, 384)
    new_value = {
        "background": bg,
        "layers": [np.zeros((h, w, 4), dtype=np.uint8)],
        "composite": bg,
    }

    if photo_path:
        mask_path = Path(photo_path).parent / f"{Path(photo_path).stem}_mask.png"
        if mask_path.exists():
            mask_path.unlink()

    return new_value, "מסכה נוקתה"


def refresh_choices():
    return gr.Dropdown(choices=_photo_choices())


with gr.Blocks(title="VTO Mask Editor", theme=gr.themes.Soft()) as demo:
    gr.Markdown("## VTO Mask Editor\nצייר **לבן** על אזור החליפה/הווסט. שחור = FitDiT לא יגע שם.")

    with gr.Row():
        photo_dd  = gr.Dropdown(choices=_photo_choices(), label="תמונת דוגמן", scale=4)
        refresh_btn = gr.Button("רענן", scale=0, size="sm")

    status_box = gr.Textbox(label="סטטוס", interactive=False)

    editor = gr.ImageEditor(
        label="ערוך מסכה",
        type="numpy",
        height=750,
        brush=gr.Brush(default_size=30, colors=["#ffffff"], default_color="#ffffff"),
    )

    with gr.Row():
        save_btn  = gr.Button("שמור מסכה", variant="primary")
        clear_btn = gr.Button("נקה מסכה", variant="secondary")

    photo_dd.change(load_for_editor, photo_dd, [editor, status_box])
    refresh_btn.click(refresh_choices, outputs=photo_dd)
    save_btn.click(save_mask,  [photo_dd, editor], status_box)
    clear_btn.click(clear_mask, [photo_dd, editor], [editor, status_box])


if __name__ == "__main__":
    demo.launch()

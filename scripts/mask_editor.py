"""
Local mask editor — adjust FitDiT's auto-generated mask per model photo.

Workflow:
  1. RunPod: run vto_fitdit_batch.py --export-masks  → saves *_auto_mask.png
  2. RunPod: git push
  3. Local:  git pull
  4. Local:  python scripts/mask_editor.py
  5. Local:  adjust sliders → Save  → git push
  6. RunPod: git pull → run batch (will use *_mask.png automatically)

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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _photo_choices() -> list[str]:
    choices = []
    for model_dir in sorted(MODELS_DIR.iterdir()):
        if not model_dir.is_dir():
            continue
        for photo in sorted(
            list(model_dir.glob("*.png")) + list(model_dir.glob("*.jpg"))
        ):
            if not photo.stem.endswith(("_mask", "_auto_mask")):
                choices.append(str(photo))
    return choices


def _load_mask(photo_path: Path) -> np.ndarray | None:
    """Load custom mask if it exists, else auto mask, else None."""
    for stem_suffix in ("_mask", "_auto_mask"):
        p = photo_path.parent / f"{photo_path.stem}{stem_suffix}.png"
        if p.exists():
            return np.array(Image.open(p).convert("L"))
    return None


def _apply_wrist_strip(mask: np.ndarray, strip_pct: float) -> np.ndarray:
    """Zero out the bottom strip_pct% of sleeve columns (left + right thirds)."""
    if strip_pct <= 0:
        return mask
    result = mask.copy()
    h, w = result.shape
    strip_px = max(1, int(h * strip_pct / 100))
    side_w = w // 3
    for cols in [range(0, side_w), range(w - side_w, w)]:
        for col in cols:
            white_rows = np.where(result[:, col] > 128)[0]
            if len(white_rows) == 0:
                continue
            bottom = white_rows.max()
            top = max(0, bottom - strip_px)
            result[top:bottom + 1, col] = 0
    return result


def _build_preview(photo: Image.Image, mask: np.ndarray) -> Image.Image:
    """Return photo with mask overlaid as a red tint."""
    rgb = np.array(photo.convert("RGB"), dtype=np.float32)
    region = mask > 128
    rgb[region, 0] = np.clip(rgb[region, 0] * 0.4 + 180, 0, 255)
    rgb[region, 1] = np.clip(rgb[region, 1] * 0.4,       0, 255)
    rgb[region, 2] = np.clip(rgb[region, 2] * 0.4,       0, 255)
    return Image.fromarray(rgb.astype(np.uint8))


# ---------------------------------------------------------------------------
# Gradio callbacks
# ---------------------------------------------------------------------------

def on_photo_change(photo_path: str, wrist_strip: float):
    if not photo_path:
        return None, "בחר תמונה"

    p = Path(photo_path)
    photo = Image.open(p).convert("RGB")
    mask = _load_mask(p)

    if mask is None:
        return np.array(photo), "אין auto mask — הרץ קודם בפוד עם --export-masks"

    has_custom = (p.parent / f"{p.stem}_mask.png").exists()
    has_auto   = (p.parent / f"{p.stem}_auto_mask.png").exists()

    source = "מותאמת אישית" if has_custom else "אוטומטית (FitDiT)"
    status = f"מסכה {source} נטענה  |  כיסוי {mask.mean()/255*100:.1f}%"

    adjusted = _apply_wrist_strip(mask, wrist_strip)
    preview  = _build_preview(photo, adjusted)
    return np.array(preview), status


def on_slider_change(photo_path: str, wrist_strip: float):
    return on_photo_change(photo_path, wrist_strip)


def on_save(photo_path: str, wrist_strip: float):
    if not photo_path:
        return "בחר תמונה תחילה"

    p = Path(photo_path)
    mask = _load_mask(p)
    if mask is None:
        return "אין מסכה — הרץ קודם בפוד עם --export-masks"

    adjusted  = _apply_wrist_strip(mask, wrist_strip)
    mask_path = p.parent / f"{p.stem}_mask.png"
    Image.fromarray(adjusted, "L").save(str(mask_path))

    coverage = adjusted.mean() / 255 * 100
    return f"נשמר: {mask_path.name}  (כיסוי {coverage:.1f}%)"


def on_reset(photo_path: str):
    if not photo_path:
        return "בחר תמונה תחילה"
    p = Path(photo_path)
    mask_path = p.parent / f"{p.stem}_mask.png"
    if mask_path.exists():
        mask_path.unlink()
        return "המסכה המותאמת נמחקה — יחזור לאוטומטי"
    return "אין מסכה מותאמת למחיקה"


# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------

with gr.Blocks(title="VTO Mask Editor") as demo:
    gr.Markdown(
        "## VTO Mask Editor\n"
        "האזור **האדום** הוא מה שFitDiT ישנה. "
        "שנה את הסליידר כדי לכוונן ולחץ **שמור**."
    )

    with gr.Row():
        photo_dd    = gr.Dropdown(choices=_photo_choices(), label="תמונת דוגמן", scale=4)
        refresh_btn = gr.Button("רענן", scale=0, size="sm")

    status_box = gr.Textbox(label="סטטוס", interactive=False)

    preview_img = gr.Image(label="תצוגה מקדימה", type="numpy", height=700)

    wrist_slider = gr.Slider(
        minimum=0, maximum=20, value=0, step=0.5,
        label="חיתוך שרוול תחתון — wrist strip (%)",
        info="הגדל כדי לגרום לFitDiT לא לגעת בשורש כף היד",
    )

    with gr.Row():
        save_btn  = gr.Button("שמור מסכה", variant="primary")
        reset_btn = gr.Button("אפס למסכה אוטומטית", variant="secondary")

    photo_dd.change(on_photo_change,  [photo_dd, wrist_slider], [preview_img, status_box])
    refresh_btn.click(lambda: gr.Dropdown(choices=_photo_choices()), outputs=photo_dd)
    wrist_slider.change(on_slider_change, [photo_dd, wrist_slider], [preview_img, status_box])
    save_btn.click(on_save,  [photo_dd, wrist_slider], status_box)
    reset_btn.click(on_reset, photo_dd, status_box)


if __name__ == "__main__":
    demo.launch(theme=gr.themes.Soft())

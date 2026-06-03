"""
VTO via HuggingFace Gradio Client.
Sends images to the Kolors-Virtual-Try-On Space and gets results back.
No local GPU weights needed — inference runs on HuggingFace servers.

Usage:
  pip install gradio-client Pillow

  # Step 1: discover the exact API endpoint name:
  python scripts/vto_gradio_test.py --discover

  # Step 2: run a single test first:
  python scripts/vto_gradio_test.py --one

  # Step 3: run the full batch:
  python scripts/vto_gradio_test.py
"""

import sys
import argparse
from pathlib import Path
from PIL import Image

REPO_ROOT   = Path(__file__).parent.parent
SCRIPTS_DIR = Path(__file__).parent
SAMPLES_DIR = SCRIPTS_DIR / "vto_samples"
OUTPUT_DIR  = SCRIPTS_DIR / "vto_results"
MODEL_IMAGE = REPO_ROOT / "Management" / "Architecture" / "model.png"

SPACE_ID = "Kwai-Kolors/Kolors-Virtual-Try-On"


def get_person_path() -> Path:
    for p in [MODEL_IMAGE, MODEL_IMAGE.with_suffix(".jpg")]:
        if p.exists():
            return p
    print(f"[ERROR] model image not found at {MODEL_IMAGE}")
    sys.exit(1)


def collect_samples() -> list[tuple[str, Path]]:
    items = []
    for type_dir in sorted(SAMPLES_DIR.iterdir()):
        if not type_dir.is_dir():
            continue
        for img in sorted(type_dir.glob("*.jpg")):
            items.append((type_dir.name, img))
    return items


def discover_api():
    from gradio_client import Client
    print(f"Connecting to {SPACE_ID} ...")
    client = Client(SPACE_ID)
    print("\n--- Available API endpoints ---")
    client.view_api()
    print("\nUse the fn_index or api_name shown above in run_vto_single().")


def run_vto_single(client, garment_path: Path, person_path: Path, out_path: Path):
    from gradio_client import handle_file

    result = client.predict(
        vton_img=handle_file(str(person_path)),
        garm_img=handle_file(str(garment_path)),
        n_samples=1,
        n_steps=20,
        image_scale=2.0,
        seed=42,
        api_name="/tryon",
    )

    # result is [filepath, seed] or just a filepath
    result_path = result[0] if isinstance(result, (list, tuple)) else result
    img = Image.open(result_path).convert("RGB")
    img.save(out_path, quality=92)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--discover", action="store_true", help="Show API endpoints and exit")
    parser.add_argument("--one",      action="store_true", help="Run only the first garment as a quick test")
    args = parser.parse_args()

    if args.discover:
        discover_api()
        return

    person_path = get_person_path()
    samples = collect_samples()
    if not samples:
        print(f"[ERROR] No images found in {SAMPLES_DIR}")
        sys.exit(1)

    if args.one:
        samples = samples[:1]
        print(f"Quick test — running 1 garment only.\n")

    from gradio_client import Client
    print(f"Connecting to {SPACE_ID} ...")
    client = Client(SPACE_ID)

    OUTPUT_DIR.mkdir(exist_ok=True)
    print(f"Running VTO for {len(samples)} garment(s) ...\n")

    ok = err = 0
    for ptype, img_path in samples:
        out_dir = OUTPUT_DIR / ptype
        out_dir.mkdir(exist_ok=True)
        out_path = out_dir / f"{img_path.stem}_vto.jpg"

        print(f"  [{ptype}] {img_path.stem} ... ", end="", flush=True)
        try:
            run_vto_single(client, img_path, person_path, out_path)
            print("ok")
            ok += 1
        except Exception as e:
            print(f"FAIL  {e}")
            err += 1

    print(f"\nDone — {ok} ok, {err} failed")
    print(f"Results: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()

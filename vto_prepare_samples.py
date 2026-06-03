"""
Picks 7 random garment images per type from local training folders,
runs them through the BiRefNet AI service (Docker on port 8001),
and saves the processed output to vto_samples/<TYPE>/.

This output folder is the input for vto_batch_test.py (RunPod VTO step).

Usage:
  python vto_prepare_samples.py

Requirements:
  pip install requests
  AI service Docker container must be running (dev.bat or docker start seeksuit-aiservice)
"""

import random
import requests
from pathlib import Path

ROOT       = Path(__file__).parent
PHOTOS_DIR = ROOT / "Products-raw-photos"
OUTPUT_DIR = ROOT / "vto_samples"
AI_URL     = "http://localhost:8001"
SAMPLE_N   = 7

SOURCES = {
    "JACKET": (PHOTOS_DIR / "suits_training",       "*_front.jpg", "JACKET"),
    "VEST":   (PHOTOS_DIR / "vests_traning",         "*_front.jpg", "VEST"),
    "PANTS":  (PHOTOS_DIR / "pants_dataset" / "im",  "*_main.jpg",  "PANTS"),
}


def process_image(img_path: Path, product_type: str) -> bytes:
    with open(img_path, "rb") as f:
        resp = requests.post(
            f"{AI_URL}/process-preview",
            files={"file": (img_path.name, f, "image/jpeg")},
            data={"product_type": product_type},
            timeout=120,
        )
    resp.raise_for_status()
    return resp.content


def main():
    # Quick health check
    try:
        requests.get(f"{AI_URL}/health", timeout=5).raise_for_status()
    except Exception:
        print(f"[ERROR] AI service not reachable at {AI_URL}")
        print("        Start it with: dev.bat  (or docker start seeksuit-aiservice)")
        return

    OUTPUT_DIR.mkdir(exist_ok=True)
    total_ok = total_err = 0

    for ptype, (folder, pattern, api_type) in SOURCES.items():
        candidates = sorted(folder.glob(pattern))
        if not candidates:
            print(f"[WARN] No images found for {ptype} in {folder}")
            continue

        sample = random.sample(candidates, min(SAMPLE_N, len(candidates)))
        out_dir = OUTPUT_DIR / ptype
        out_dir.mkdir(exist_ok=True)

        print(f"\n[{ptype}] Processing {len(sample)} images...")
        for img_path in sample:
            out_path = out_dir / img_path.name
            print(f"  {img_path.name} ... ", end="", flush=True)
            try:
                result = process_image(img_path, api_type)
                out_path.write_bytes(result)
                print("done")
                total_ok += 1
            except Exception as e:
                print(f"FAILED: {e}")
                total_err += 1

    print(f"\nFinished: {total_ok} processed, {total_err} failed")
    print(f"Output: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()

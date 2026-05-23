"""
Pipeline test — runs sample images through the AI service and saves results locally.
Output: test_output/{TYPE}/{filename}
"""
import os
import sys
import time
import requests

AI_URL = "http://localhost:8001/process"
BASE   = r"C:\Users\HAREL\Desktop\Final Project\SeekSuit\Products-raw-photos"
OUT    = r"C:\Users\HAREL\Desktop\Final Project\SeekSuit\test_output"

# (source_dir, product_type, [filenames])
TEST_IMAGES = [
    ("suits_training",      "JACKET",  ["suit_001_front.jpg",    "suit_001_back.jpg",
                                        "suit_002_front.jpg",    "suit_002_back.jpg"]),
    ("vests_traning",       "VEST",    ["vest_001_front.jpg",    "vest_001_back.jpg",
                                        "vest_002_front.jpg",    "vest_002_back.jpg"]),
    ("pants_training",      "PANTS",   ["pant_001_main.jpg",     "pant_002_main.jpg"]),
    ("bow_ties_training",   "BOW_TIE", ["bow_tie_001_main.jpg",  "bow_tie_002_main.jpg"]),
    ("ties_training",       "TIE",     ["tie_001_main.jpg",      "tie_002_main.jpg"]),
    ("belts_training",      "BELT",    ["belt_001_main.jpg",     "belt_002_main.jpg"]),
    ("shirts_training",     "SHIRT",   ["shirt_001_main.jpg",    "shirt_002_main.jpg"]),
    ("shoes_training",      "SHOES",   ["shoe_001_front.jpg",    "shoe_001_inner.jpg",
                                        "shoe_001_outer.jpg",    "shoe_002_front.jpg",
                                        "shoe_002_inner.jpg",    "shoe_002_outer.jpg"]),
]

TYPE_LABELS = {
    "JACKET":  "01_JACKET",
    "VEST":    "02_VEST",
    "PANTS":   "03_PANTS",
    "BOW_TIE": "04_BOW_TIE",
    "TIE":     "05_TIE",
    "BELT":    "06_BELT",
    "SHIRT":   "07_SHIRT",
    "SHOES":   "08_SHOES",
}


def process(src_path: str, filename: str, product_type: str, out_dir: str) -> bool:
    with open(src_path, "rb") as f:
        resp = requests.post(
            AI_URL,
            files={"file": (filename, f, "image/jpeg")},
            data={"product_type": product_type},
            timeout=600,
        )

    if resp.status_code != 200:
        print(f"  ERROR {resp.status_code}: {resp.text[:200]}")
        return False

    signed_url = resp.json().get("processedImageUrl")
    if not signed_url:
        print(f"  ERROR: no processedImageUrl in response")
        return False

    img_resp = requests.get(signed_url, timeout=30)
    if img_resp.status_code != 200:
        print(f"  ERROR downloading result: {img_resp.status_code}")
        return False

    out_path = os.path.join(out_dir, filename)
    with open(out_path, "wb") as f:
        f.write(img_resp.content)
    return True


def main():
    total = sum(len(imgs) for _, _, imgs in TEST_IMAGES)
    done = 0
    errors = 0

    print(f"Starting pipeline test — {total} images\n")

    for src_dir, product_type, filenames in TEST_IMAGES:
        label = TYPE_LABELS[product_type]
        out_dir = os.path.join(OUT, label)
        os.makedirs(out_dir, exist_ok=True)

        print(f"[{label}]")
        for filename in filenames:
            src_path = os.path.join(BASE, src_dir, filename)
            if not os.path.exists(src_path):
                print(f"  SKIP {filename} (file not found)")
                continue

            t0 = time.time()
            sys.stdout.write(f"  {filename} ... ")
            sys.stdout.flush()

            ok = process(src_path, filename, product_type, out_dir)
            elapsed = time.time() - t0

            if ok:
                print(f"done ({elapsed:.1f}s)")
                done += 1
            else:
                errors += 1
        print()

    print(f"Done: {done}/{total} succeeded, {errors} errors")
    print(f"Results in: {OUT}")


if __name__ == "__main__":
    main()

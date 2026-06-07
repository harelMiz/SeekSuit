"""
Downloads FitDiT model weights and the SD inpainting model from HuggingFace.
Run this once on RunPod before running vto_fitdit_batch.py.

Total download: ~14 GB  (FitDiT ~10 GB + SD inpainting ~4 GB)

Usage:
  cd /workspace/SeekSuit
  python scripts/vto_fitdit_download.py
"""

from pathlib import Path
from huggingface_hub import snapshot_download

FITDIT_DIR  = Path("/workspace/FitDiT")
INPAINT_DIR = Path("/workspace/sd-inpainting")


def download_fitdit():
    if FITDIT_DIR.exists():
        print("FitDiT directory already exists, skipping clone.")
    else:
        import subprocess
        print("Cloning FitDiT repo from GitHub...")
        subprocess.run(
            ["git", "clone", "https://github.com/BoyuanJiang/FitDiT", str(FITDIT_DIR)],
            check=True,
        )
        print("Repo cloned.\n")

    print("Downloading BoyuanJiang/FitDiT weights (~10 GB)...")
    snapshot_download(
        repo_id="BoyuanJiang/FitDiT",
        local_dir=str(FITDIT_DIR),
        local_dir_use_symlinks=False,
    )
    print("FitDiT done.\n")


def download_inpainting():
    if INPAINT_DIR.exists():
        print("SD inpainting already downloaded, skipping.")
        return
    print("Downloading runwayml/stable-diffusion-inpainting (~4 GB)...")
    snapshot_download(
        repo_id="runwayml/stable-diffusion-inpainting",
        local_dir=str(INPAINT_DIR),
        local_dir_use_symlinks=False,
    )
    print("SD inpainting done.\n")


def main():
    download_fitdit()
    download_inpainting()
    print("All downloads complete.")
    print("Next: python scripts/vto_fitdit_batch.py --one")


if __name__ == "__main__":
    main()

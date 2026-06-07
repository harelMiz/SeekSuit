"""
Downloads FitDiT model weights from HuggingFace.
Run this once on RunPod before running vto_fitdit_batch.py.

NOTE: Delete /workspace/OOTDiffusion first to free ~13 GB of disk space:
  rm -rf /workspace/OOTDiffusion

Total download: ~10 GB

Usage:
  cd /workspace/SeekSuit
  python scripts/vto_fitdit_download.py
"""

from pathlib import Path
from huggingface_hub import snapshot_download

FITDIT_DIR = Path("/workspace/FitDiT")


def main():
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
    print("Done.\n")
    print("All downloads complete.")
    print("Next: python scripts/vto_fitdit_batch.py --one")


if __name__ == "__main__":
    main()

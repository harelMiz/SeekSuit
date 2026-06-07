"""
Downloads all weights needed for OOTDiffusion inference.
Run this once on RunPod before running vto_ootd_batch.py.

Downloads:
  - OOTDiffusion repo from GitHub to /workspace/OOTDiffusion
  - levihsu/OOTDiffusion model weights to checkpoints/ootd/
  - openai/clip-vit-large-patch14 to checkpoints/clip-vit-large-patch14/
  - humanparsing ONNX files (copied from IDM-VTON if available, else downloaded)

Usage:
  cd /workspace/SeekSuit
  python scripts/vto_ootd_download.py
"""

import shutil
import subprocess
from pathlib import Path
from huggingface_hub import snapshot_download

OOTD_DIR        = Path("/workspace/OOTDiffusion")
CHECKPOINTS_DIR = OOTD_DIR / "checkpoints"
IDMVTON_PARSING = Path("/workspace/IDM-VTON/gradio_demo/ckpt/humanparsing")


def clone_repo():
    if OOTD_DIR.exists():
        print("OOTDiffusion repo already exists, skipping clone.")
        return
    print("Cloning OOTDiffusion from GitHub...")
    subprocess.run(
        ["git", "clone", "https://github.com/levihsu/OOTDiffusion", str(OOTD_DIR)],
        check=True,
    )
    print("Repo cloned.\n")


def download_model():
    print("Downloading levihsu/OOTDiffusion weights (~5 GB)...")
    snapshot_download(
        repo_id="levihsu/OOTDiffusion",
        local_dir=str(CHECKPOINTS_DIR / "ootd"),
        local_dir_use_symlinks=False,
    )
    print("OOTDiffusion weights saved.\n")


def download_clip():
    print("Downloading openai/clip-vit-large-patch14 (~1.7 GB)...")
    snapshot_download(
        repo_id="openai/clip-vit-large-patch14",
        local_dir=str(CHECKPOINTS_DIR / "clip-vit-large-patch14"),
        local_dir_use_symlinks=False,
    )
    print("CLIP saved.\n")


def get_humanparsing():
    dst = CHECKPOINTS_DIR / "humanparsing"
    dst.mkdir(parents=True, exist_ok=True)

    atr = dst / "parsing_atr.onnx"
    lip = dst / "parsing_lip.onnx"

    if atr.exists() and lip.exists():
        print("Human parsing models already present, skipping.")
        return

    if IDMVTON_PARSING.exists():
        print("Copying humanparsing ONNX files from IDM-VTON ckpt...")
        for f in ["parsing_atr.onnx", "parsing_lip.onnx"]:
            src = IDMVTON_PARSING / f
            if src.exists():
                shutil.copy2(src, dst / f)
        print("Copied.\n")
        return

    print("Downloading humanparsing ONNX files from HuggingFace...")
    snapshot_download(
        repo_id="levihsu/GarmentSegmentation",
        allow_patterns=["*.onnx"],
        local_dir=str(dst),
        local_dir_use_symlinks=False,
    )
    print("Human parsing models saved.\n")


def main():
    clone_repo()
    download_model()
    download_clip()
    get_humanparsing()

    print("All downloads complete.")
    print("Next: python scripts/vto_ootd_batch.py --one")


if __name__ == "__main__":
    main()

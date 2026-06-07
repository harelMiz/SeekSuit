"""
Downloads all weights needed for IDM-VTON inference.
Run this once on RunPod before running vto_idmvton_batch.py.

Downloads:
  - yisol/IDM-VTON model weights (~8 GB) to HuggingFace cache
  - Preprocessing ckpt files (human parsing, densepose, openpose) to gradio_demo/ckpt/

Usage:
  cd /workspace/SeekSuit
  python scripts/vto_idmvton_download.py
"""

from pathlib import Path
from huggingface_hub import snapshot_download

IDMVTON_DEMO = Path("/workspace/IDM-VTON/gradio_demo")


def main():
    print("Step 1/2 — Downloading yisol/IDM-VTON model weights (~8 GB)...")
    snapshot_download(repo_id="yisol/IDM-VTON")
    print("Main model cached.\n")

    print("Step 2/2 — Downloading preprocessing ckpt files from IDM-VTON Space...")
    snapshot_download(
        repo_id="yisol/IDM-VTON",
        repo_type="space",
        allow_patterns=["ckpt/**"],
        local_dir=str(IDMVTON_DEMO),
        local_dir_use_symlinks=False,
    )
    print("Preprocessing ckpt files saved to gradio_demo/ckpt/\n")

    print("All downloads complete.")
    print("Next: python scripts/vto_idmvton_batch.py --one")


if __name__ == "__main__":
    main()

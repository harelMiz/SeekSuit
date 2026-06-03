"""
Kolors-VTO discovery script — run this FIRST on RunPod.

Downloads the Kolors-Virtual-Try-On repo (code only, skips large weights),
prints the file tree, shows app.py, and identifies the correct model to load.
This output lets us update load_pipeline() in vto_batch_test.py before
running the full batch.

Usage:
  pip install huggingface_hub
  python scripts/discover_kolors.py

  # If the repo is gated, log in first:
  huggingface-cli login
  python scripts/discover_kolors.py
"""

from pathlib import Path
from huggingface_hub import HfApi, snapshot_download

REPO_ID  = "Kwai-Kolors/Kolors-Virtual-Try-On"
OUT_DIR  = Path("./kolors_vto_space")

SKIP_PATTERNS = ["*.bin", "*.safetensors", "*.pt", "*.pth", "*.ckpt", "*.onnx"]


def list_repo_files():
    api = HfApi()
    print(f"Fetching file list for: {REPO_ID}")

    for repo_type in ("space", "model"):
        try:
            files = list(api.list_repo_files(repo_id=REPO_ID, repo_type=repo_type))
            print(f"  Found as repo_type='{repo_type}' — {len(files)} file(s)\n")
            for f in sorted(files):
                print(f"    {f}")
            return repo_type, files
        except Exception as e:
            print(f"  Not found as repo_type='{repo_type}': {e}")

    return None, []


def download_code(repo_type: str):
    print(f"\nDownloading code (skipping large weights) to {OUT_DIR}/...")
    snapshot_download(
        repo_id=REPO_ID,
        repo_type=repo_type,
        local_dir=str(OUT_DIR),
        ignore_patterns=SKIP_PATTERNS,
    )
    print("Download complete.")


def print_tree():
    print("\nDirectory structure:")
    for p in sorted(OUT_DIR.rglob("*")):
        rel = p.relative_to(OUT_DIR)
        if any(part.startswith(".") for part in rel.parts):
            continue
        indent = "  " + "  " * (len(rel.parts) - 1)
        print(f"{indent}{rel.name}{'/' if p.is_dir() else ''}")


def show_file(name: str, max_chars: int = 6000):
    path = OUT_DIR / name
    if not path.exists():
        print(f"\n[{name} not found]")
        return
    print(f"\n{'='*60}")
    print(f"  {name}")
    print(f"{'='*60}")
    content = path.read_text(errors="replace")
    print(content[:max_chars])
    if len(content) > max_chars:
        print(f"\n... (truncated, {len(content) - max_chars} chars omitted)")


def main():
    repo_type, _ = list_repo_files()
    if repo_type is None:
        print("\n[ERROR] Repo not accessible. Try: huggingface-cli login")
        return

    download_code(repo_type)
    print_tree()

    for candidate in ["app.py", "pipeline.py", "infer.py", "inference.py", "model.py"]:
        show_file(candidate)

    for candidate in ["requirements.txt", "packages.txt"]:
        show_file(candidate, max_chars=2000)

    print("\n\nNext step:")
    print("  Share the output above with Claude so we can update load_pipeline()")
    print("  in scripts/vto_batch_test.py before running the full batch.\n")


if __name__ == "__main__":
    main()

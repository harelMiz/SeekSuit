FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /workspace

# Install git-lfs (needed for HuggingFace model files)
RUN apt-get update -qq && apt-get install -y git git-lfs && git lfs install && rm -rf /var/lib/apt/lists/*

# Clone FitDiT source code
RUN git clone https://github.com/BoyuanJiang/FitDiT.git /workspace/FitDiT

# Download FitDiT model weights into image (~10 GB)
RUN pip install -q huggingface_hub && python -c "\
from huggingface_hub import snapshot_download; \
snapshot_download('BoyuanJiang/FitDiT', local_dir='/workspace/FitDiT/ckpt', max_workers=1); \
print('FitDiT weights downloaded successfully')"

# Install FitDiT's own dependencies
RUN pip install --no-cache-dir -r /workspace/FitDiT/requirements.txt

# FitDiT pins torch==2.4.0 with no CUDA variant, so pip grabs the default PyPI
# build (cu121's bundled nvidia-* runtime libs). Some RunPod hosts run an older
# driver that can't satisfy that. Force the cu118 build instead — it matches
# this base image's CUDA toolkit and works on virtually any datacenter driver.
# --no-deps + a single --index-url avoids pip silently picking the non-cu118
# wheel when a second index is also in play. Assert it took effect so a wrong
# build fails at image-build time instead of at runtime on a RunPod worker.
RUN pip install --no-cache-dir --force-reinstall --no-deps \
    --index-url https://download.pytorch.org/whl/cu118 \
    torch==2.4.0+cu118 torchvision==0.19.0+cu118 && \
    python -c "import torch; v=torch.version.cuda; print('torch cuda:', v); assert v.startswith('11.8'), f'expected cu118, got {v}'"

# Install our handler dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Force a clean NumPy 1.x reinstall as the final step: FitDiT's chain (matplotlib,
# opencv, etc.) breaks under NumPy 2.x ABI, and earlier installs (FitDiT's own
# pinned numpy==1.23.0, then sam2's own resolution) can leave inconsistent binary
# wheels installed in between. Reinstalling last guarantees the final state is clean.
RUN pip install --no-cache-dir --force-reinstall --no-deps "numpy<2"

COPY scripts/ /workspace/scripts/
COPY handler.py .

ENV FITDIT_DIR=/workspace/FitDiT

CMD ["python", "handler.py"]

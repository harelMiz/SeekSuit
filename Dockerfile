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
# build (cu121, depending on separate nvidia-*-cu12 pip packages for its
# runtime libs, including cuDNN 9). Some RunPod hosts run an older driver
# that can't satisfy cu121. Force the cu118 build instead — it matches this
# base image's CUDA toolkit and works on virtually any datacenter driver.
#
# torch's +cu118 wheel still depends on cuDNN 9 (libcudnn.so.9) at import
# time but does not bundle it, so it needs a real nvidia-cudnn package
# installed (--no-deps would skip that and crash on import). First wipe the
# old torch/torchvision and any leftover nvidia-*-cu12 packages from the
# install above, then reinstall cleanly: --extra-index-url (not --index-url)
# keeps PyPI available so pip can resolve cudnn/etc. from there while
# pulling the +cu118 torch/torchvision wheels specifically from PyTorch's
# index. Assert the CUDA variant took effect so a wrong build fails at
# image-build time instead of at runtime on a RunPod worker.
RUN pip uninstall -y torch torchvision 2>/dev/null; \
    pip list --format=freeze | awk -F= '/^nvidia-/{print $1}' | xargs -r pip uninstall -y; \
    pip install --no-cache-dir --force-reinstall \
    --extra-index-url https://download.pytorch.org/whl/cu118 \
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

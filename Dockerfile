FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /workspace

# Install git-lfs (needed for HuggingFace model files)
RUN apt-get update -qq && apt-get install -y git git-lfs && git lfs install && rm -rf /var/lib/apt/lists/*

# Clone FitDiT source code
RUN git clone https://github.com/BoyuanJiang/FitDiT.git /workspace/FitDiT

# Download all model weights into image — BoyuanJiang/FitDiT + CLIP used at runtime
RUN pip install -q huggingface_hub && python -c "\
from huggingface_hub import snapshot_download; \
snapshot_download('BoyuanJiang/FitDiT', local_dir='/workspace/FitDiT/ckpt', max_workers=1); \
snapshot_download('laion/CLIP-ViT-bigG-14-laion2B-39B-b160k', max_workers=1); \
print('All models downloaded successfully')"

# Install FitDiT's own dependencies
RUN pip install --no-cache-dir -r /workspace/FitDiT/requirements.txt

# Install our handler dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY scripts/ /workspace/scripts/
COPY handler.py .

ENV FITDIT_DIR=/workspace/FitDiT

CMD ["python", "handler.py"]

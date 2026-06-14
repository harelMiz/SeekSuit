FROM runpod/pytorch:2.2.0-py3.11-cuda12.1.1-devel-ubuntu22.04

WORKDIR /workspace

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY scripts/ /workspace/scripts/

ENV FITDIT_DIR=/workspace/FitDiT

CMD ["python", "scripts/runpod_handler.py"]

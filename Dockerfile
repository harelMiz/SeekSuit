FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /workspace

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY scripts/ /workspace/scripts/

ENV FITDIT_DIR=/workspace/FitDiT

CMD ["python", "scripts/runpod_handler.py"]

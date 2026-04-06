FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required by rembg and OpenCV
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the rembg U-2-Net model weights at build time (~170MB)
# This prevents a 30-60s delay on the first real request
RUN python -c "from rembg import remove; remove(b'warmup')" || true

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

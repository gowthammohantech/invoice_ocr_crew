FROM python:3.11-slim

# System deps for PaddleOCR, pdf2image, Pillow, Tesseract
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-eng \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Data directories are mounted as volumes; pre-create them so the app starts cleanly
RUN mkdir -p invoices invoice_raw_data invoice_data/pass invoice_data/failed \
              invoice_traces logs reference data

EXPOSE 8080

# CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
# Dockerfile example for FastAPI
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]

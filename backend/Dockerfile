# IFMS Payroll API — production image: FastAPI + Celery worker/beat (same Dockerfile).
# WeasyPrint needs Cairo/Pango stack from Debian.
FROM python:3.12-slim

WORKDIR /app

# WeasyPrint system dependencies
# libgdk-pixbuf-2.0-0 (Debian Trixie+) — old name libgdk-pixbuf2.0-0 was removed
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangoft2-1.0-0 libgdk-pixbuf-2.0-0 \
    libffi-dev libcairo2 libpangocairo-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create upload and report directories
RUN mkdir -p /app/uploads /app/reports

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

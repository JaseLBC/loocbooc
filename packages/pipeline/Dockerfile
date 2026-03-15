FROM python:3.11-slim

# Minimal system dependencies for pipeline worker (MVP/mock mode — no COLMAP required)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies from requirements file (fast, no poetry overhead)
COPY requirements-docker.txt ./
RUN pip install --no-cache-dir -r requirements-docker.txt

# Copy pipeline source
COPY pipeline/ ./pipeline/

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV REDIS_URL=redis://redis:6379/0

# Start Celery worker + Redis list poller (see celery_worker.py)
CMD ["celery", "-A", "pipeline.workers.celery_worker", "worker", \
     "-Q", "pipeline", \
     "-c", "1", \
     "--loglevel=info", \
     "--without-heartbeat", \
     "--without-mingle"]

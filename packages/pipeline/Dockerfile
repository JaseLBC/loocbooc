FROM python:3.11-slim

# System dependencies for CV and 3D processing
RUN apt-get update && apt-get install -y \
    # Build tools
    gcc g++ cmake make \
    # Image processing
    libglib2.0-0 libsm6 libxext6 libxrender-dev libgl1-mesa-glx \
    # COLMAP dependencies (runtime)
    libboost-program-options1.74.0 \
    libboost-filesystem1.74.0 \
    libboost-graph1.74.0 \
    libcgal-dev \
    libflann-dev \
    libfreeimage-dev \
    libsqlite3-dev \
    # Open3D dependencies
    libgomp1 \
    # Video processing
    ffmpeg \
    # Blender for simulation/export (optional)
    # blender \
    && rm -rf /var/lib/apt/lists/*

# Install COLMAP
# In production, build from source for GPU support
# RUN apt-get install -y colmap
# OR build from source with GPU:
# See: https://colmap.github.io/install.html

WORKDIR /app

# Install Python dependencies
COPY pyproject.toml ./
RUN pip install poetry && \
    poetry config virtualenvs.create false && \
    poetry install --no-dev --no-interaction

COPY pipeline/ ./pipeline/

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV REDIS_URL=redis://redis:6379/0

CMD ["celery", "-A", "pipeline.workers.celery_worker", "worker", \
     "-Q", "pipeline", \
     "-c", "2", \
     "--loglevel=info", \
     "--without-heartbeat"]

FROM python:3.12-slim

# System dependencies
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
ENV POETRY_VERSION=1.8.2
ENV POETRY_HOME=/opt/poetry
ENV POETRY_VENV=/opt/poetry-venv
ENV POETRY_CACHE_DIR=/opt/.cache

RUN python3 -m venv $POETRY_VENV \
    && $POETRY_VENV/bin/pip install -U pip setuptools \
    && $POETRY_VENV/bin/pip install poetry==${POETRY_VERSION}

ENV PATH="${POETRY_VENV}/bin:${PATH}"

WORKDIR /app

# Copy dependency files
COPY pyproject.toml poetry.lock* ./

# Install dependencies (no dev dependencies in production)
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --no-root --without dev

# Copy application code
COPY . .

# Install the app package
RUN poetry install --no-interaction --no-ansi --without dev

# Create storage directory for local dev
RUN mkdir -p /tmp/loocbooc-storage

# Non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app /tmp/loocbooc-storage
USER appuser

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

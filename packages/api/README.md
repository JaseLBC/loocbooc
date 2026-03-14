# Loocbooc API

Production-grade FastAPI backend for the Loocbooc platform.

## Quick Start

```bash
docker-compose up
```

API will be available at http://localhost:8000
Docs at http://localhost:8000/docs

## Architecture

- **FastAPI** — async Python API framework
- **PostgreSQL** — primary data store (via asyncpg)
- **Redis** — caching + job queue
- **Alembic** — database migrations
- **Claude claude-haiku-4-5** — care label OCR

## Universal Garment Identifier (UGI)

Every garment gets a UGI on creation:

```
LB-CHAR-TO-K9F3M2A1-X7Q
│   │    │  │         └── 3-char checksum
│   │    │  └── 8-char base-36 timestamp (ms since Loocbooc epoch)
│   │    └── 2-char category code
│   └── 4-char brand code
└── Loocbooc prefix
```

## Authentication

**API Key** (for brands):
```
X-API-Key: lb_live_xxxxx
```

**JWT** (for consumers):
```
Authorization: Bearer <token>
```

## Key Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/garments | API Key | Create garment, get UGI |
| GET | /api/v1/garments/{ugi} | Optional | Get garment by UGI |
| POST | /api/v1/garments/{ugi}/files | API Key | Upload files |
| POST | /api/v1/scan/label | None | OCR care label |
| POST | /api/v1/avatars | None | Create avatar |
| POST | /api/v1/garments/{ugi}/try-on | Optional | Try-on |
| GET | /health | None | Health check |

## Development

```bash
# Install dependencies
poetry install

# Run migrations
alembic upgrade head

# Start dev server
uvicorn app.main:app --reload

# Run tests
pytest

# Run tests with coverage
pytest --cov=app --cov-report=html
```

## Environment Variables

See `.env.example` for all configuration options.
The only required external key is `ANTHROPIC_API_KEY` for OCR.
All other defaults work for local development.

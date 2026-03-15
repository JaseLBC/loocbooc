# Loocbooc

The operating system for the global fashion industry.

---

## 🚀 Getting Started (Local Dev — One Command)

### Prerequisites
- Docker Desktop (or Docker + Docker Compose v2)
- `curl` and `jq` (for the test script)

### Start Everything

```bash
cd loocbooc
docker-compose up --build
```

This starts 6 services:
- **postgres** — PostgreSQL 16 (port 5432)
- **redis** — Redis 7 (port 6379)
- **minio** — MinIO object storage (API: 9000, Console: 9001)
- **api** — FastAPI backend (port 8000)
- **web** — Next.js brand portal (port 3000)
- **pipeline-worker** — Celery worker (no extra port)

First startup takes ~2 minutes to build images and run migrations.

### Access Points

| Service | URL |
|---------|-----|
| Brand Portal | http://localhost:3000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| API Health | http://localhost:8000/health |
| MinIO Console | http://localhost:9001 (minioadmin / minioadmin) |

### Test Credentials

After startup, the seed script creates:

```
Brand:    Charcoal Clothing (CHAR)
API Key:  lb_live_testkey_charcoal
```

### Create a Garment via API

```bash
curl -X POST http://localhost:8000/api/v1/garments \
  -H "X-API-Key: lb_live_testkey_charcoal" \
  -H "Content-Type: application/json" \
  -d '{"name":"Silk Slip Dress","category":"dresses","description":"Summer collection"}'
```

Returns a UGI like: `LB-CHAR-DR-K9F3M2A1-X7Q`

### Run the End-to-End Test

```bash
./scripts/test-e2e.sh
```

### Re-run Seed Data

```bash
docker-compose exec api python /app/scripts/seed.py
```

---

## Monorepo Structure

```
loocbooc/
├── packages/
│   ├── api/          # FastAPI backend — garment UUID, data model, REST API
│   ├── web/          # Next.js 14 — brand portal + consumer try-on
│   ├── pipeline/     # Python 3D reconstruction pipeline
│   ├── physics/      # Fabric physics simulation engine
│   └── mobile/       # React Native iOS scanning app
├── shared/           # Shared types, constants, utilities
├── docs/             # Architecture, API specs, decisions
└── infra/            # Docker, CI/CD, deployment
```

## Stack
- **API**: Python / FastAPI / PostgreSQL / Redis / S3
- **Web**: Next.js 14 / TypeScript / Three.js
- **Pipeline**: Python / Open3D / COLMAP / Trimesh
- **Physics**: Python (custom cloth simulation engine)
- **Mobile**: React Native / iOS (LiDAR + camera pipeline)
- **Infra**: Docker / GCP / GitHub Actions

# Loocbooc

The operating system for the global fashion industry.

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

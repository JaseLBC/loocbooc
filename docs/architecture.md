# Loocbooc — System Architecture
*Version 1.0 | March 2026 | Chief Architect Document*
*This is the document the engineering team builds from. Treat it as the ground truth.*

---

## 1. System Overview

### 1.1 Architecture Philosophy

Loocbooc starts as a **well-structured monolith** deployed on Cloud Run. This is not a compromise — it is the right architecture for MVP. The monolith is internally partitioned into bounded domains that map 1:1 to future microservices when load demands splitting. The one exception is the 3D pipeline, which is isolated from day one because it is the highest-risk component: GPU-intensive, long-running, and failure-prone in ways that must not affect API availability.

**Guiding constraints, in priority order:**
1. Speed to MVP (boring proven tech, no yak shaving)
2. Cost efficiency (lean until scale demands otherwise)
3. Correctness (especially the physics and UUID systems — these compound)
4. Scalability (architecture that doesn't require rewrites, only horizontal expansion)

---

### 1.2 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │   Web (Next.js)  │  │ Mobile (RN + iOS) │  │  External APIs / B2B    │  │
│  │  Brand Portal    │  │  Avatar Scan      │  │  PLM/ERP Integrations   │  │
│  │  Consumer Try-On │  │  Garment Scan     │  │  Retailer Webhooks      │  │
│  └────────┬─────────┘  └────────┬──────────┘  └──────────┬──────────────┘  │
└───────────┼─────────────────────┼─────────────────────────┼─────────────────┘
            │                     │                         │
            ▼                     ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GCP LOAD BALANCER / CDN                              │
│                    (Cloud Armor WAF + Cloud CDN)                             │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      API MONOLITH (Cloud Run)                                │
│                    FastAPI / Python 3.12 / Uvicorn                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Auth Domain │  │Garment Domain│  │ Avatar Domain │  │  Retail Domain│  │
│  │  JWT / OAuth │  │  UGI System  │  │ Body Scanning │  │  Try-On / Fit │  │
│  │  API Keys    │  │  Tech Packs  │  │ Measurements  │  │  DPP Records  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘  └──────┬────────┘  │
│         │                 │                  │                   │          │
│  ┌──────┴─────────────────┴──────────────────┴───────────────────┘          │
│  │              Shared Services Layer                                        │
│  │  Event Bus  │  File Manager  │  Notification  │  Webhook Dispatcher     │
│  └─────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                         ▼
┌─────────────────────┐  ┌────────────────────────┐  ┌──────────────────────┐
│  PostgreSQL 16      │  │     Redis 7             │  │  GCS Object Storage  │
│  (Cloud SQL)        │  │  (Memorystore)          │  │  (Cloud Storage)     │
│  Primary data store │  │  Cache / Queue / PubSub │  │  Garment files       │
│  DPP records        │  │  Session store          │  │  3D models (.lgmt)   │
│  Audit logs         │  │  Rate limiting          │  │  GLB / USDZ          │
│  EU region for DPP  │  │  Real-time updates      │  │  Fabric scans        │
└─────────────────────┘  └────────────────────────┘  │  Avatar meshes       │
                                                       │  Pattern files       │
                                                       └──────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    3D PIPELINE (Cloud Run Jobs — Isolated)                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Queue: Redis Stream (pipeline:jobs)                                 │   │
│  │  Workers: Cloud Run Jobs (scales 0→N, GPU-capable)                  │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
│                                     │                                        │
│  ┌──────────────┐  ┌──────────────┐ │ ┌──────────────┐  ┌───────────────┐  │
│  │  Ingestion   │  │ 3D Recon     │ │ │ Physics Sim  │  │  Output Gen   │  │
│  │  COLMAP      │──▶ Open3D      │─┘─▶ ARCSim-insp. │──▶ .lgmt + GLB  │  │
│  │  Format norm │  │ Mesh clean   │   │ Cloth drape   │  │ + USDZ        │  │
│  └──────────────┘  └──────────────┘   └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GCP ML SERVICES                                      │
│  ┌──────────────────┐  ┌────────────────────┐  ┌───────────────────────┐   │
│  │  Vertex AI       │  │  Cloud Vision API  │  │  Document AI          │   │
│  │  Fit prediction  │  │  Care label OCR    │  │  Tech pack extraction │   │
│  │  Style matching  │  │  Fabric detection  │  │  Spec sheet parsing   │   │
│  └──────────────────┘  └────────────────────┘  └───────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.3 Component Map

| Component | Technology | Responsibility | Connects To |
|---|---|---|---|
| API Monolith | FastAPI + Python 3.12 | All business logic, REST API, domain orchestration | PostgreSQL, Redis, GCS, Pipeline Queue |
| Auth Domain | JWT + OAuth2 + API Keys | Authentication, session management, key rotation | PostgreSQL (api_keys), Redis (sessions) |
| Garment Domain | FastAPI routers | UGI generation, garment CRUD, version management | PostgreSQL, GCS, Pipeline Queue |
| Avatar Domain | FastAPI routers | Avatar creation, body measurement, scan session mgmt | PostgreSQL, GCS, ARKit (mobile) |
| Retail Domain | FastAPI routers | Try-on orchestration, fit scoring, DPP records | PostgreSQL, Redis, 3D Pipeline |
| 3D Pipeline | Cloud Run Jobs | Async 3D reconstruction, physics simulation, output generation | Redis (queue), GCS (files), PostgreSQL (status) |
| Physics Engine | Python (custom) | Cloth simulation, fabric property lookup | PostgreSQL (fabric_physics), GCS |
| Web Frontend | Next.js 14 App Router | Brand portal, consumer try-on UI, real-time updates | API over HTTPS, WebSocket for live updates |
| Mobile App | React Native + iOS Vision | AR scanning, avatar creation, try-on viewer | API over HTTPS, ARKit native modules |
| CDN / WAF | Cloud CDN + Cloud Armor | Static asset delivery, DDoS protection, geo-routing | GCS (static), API (dynamic) |
| Monitoring | Cloud Monitoring + Sentry | Error tracking, performance metrics, pipeline health | All services |

---

## 2. Data Flow Diagrams

### 2.1 Critical Path A: Brand Uploads Garment → 3D Model → UGI Issued

```
Brand (Web Portal)
      │
      │ POST /api/v1/garments
      │ {name, category, brand_id, input_type}
      │
      ▼
API Monolith
  1. Validate auth (JWT / API key)
  2. Generate UGI (see §6)
  3. Create garment record (status: DRAFT)
  4. Return presigned GCS upload URLs
      │
      │ Returns: {ugi, upload_urls[]}
      ▼
Brand uploads files directly to GCS
  - Pattern files (DXF / .zprj / images)
  - Care label photo (optional)
  - Fabric composition (optional)
      │
      │ POST /api/v1/garments/{ugi}/submit
      ▼
API Monolith
  1. Validate all required files present
  2. Run care label OCR (if photo uploaded)
     → Cloud Vision API → fabric composition extracted
  3. Look up fabric physics from composition
     → fabric_physics table → simulation params set
  4. Publish job to Redis Stream: pipeline:jobs
     {job_id, ugi, input_type, file_refs[], priority}
  5. Update garment status: PROCESSING
  6. Return: {status: "processing", job_id, estimated_seconds}
      │
      ▼
3D Pipeline Worker (Cloud Run Job — triggered by queue)
  Phase 1 — Ingestion (30–120s)
  - Pull files from GCS
  - Detect input type (pattern / photo / video / CLO3D)
  - Normalize to internal format
  - Run COLMAP if photogrammetry path

  Phase 2 — 3D Reconstruction (60–300s)
  - For pattern input: mathematical unfolding via Trimesh
  - For photo/video: COLMAP point cloud → Open3D mesh
  - Mesh cleaning: remove noise, fill holes, normalize scale
  - UV unwrapping for texture baking

  Phase 3 — Physics Simulation (30–180s)
  - Load fabric parameters from GCS (set in Phase 1)
  - ARCSim-inspired cloth sim: gravity + collision at rest pose
  - Generate drape for product display pose
  - Generate physics metadata (stiffness, drape vectors)

  Phase 4 — Output Generation (30–60s)
  - Write .lgmt (proprietary: JSON envelope + binary mesh + physics)
  - Export GLB r2.0 (Three.js compatible)
  - Export USDZ (iOS AR Quick Look compatible)
  - Generate thumbnail (512×512 + 1024×1024)
  - Upload all outputs to GCS under {ugi}/

  Phase 5 — Finalize
  - Update garment record: status=ACTIVE, model_urls set
  - Publish completion event to Redis PubSub: garment:{ugi}:ready
  - POST webhook to brand if registered
      │
      ▼
API Monolith (webhook / polling)
  - Garment status: ACTIVE
  - UGI now resolves to fully simulated 3D garment
  - Available for: try-on, DPP record, retailer embedding

Brand receives notification (email + webhook)
  → "Your garment {UGI} is live. Try-on enabled."
```

**Total time estimates by input type:**
| Input Type | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Total |
|---|---|---|---|---|---|
| CLO3D / Marvelous Designer | 15s | 30s | 60s | 30s | ~2.5 min |
| Cut patterns (DXF) | 30s | 90s | 90s | 30s | ~4 min |
| 12 photos | 60s | 180s | 120s | 30s | ~6.5 min |
| Video scan (60s) | 90s | 300s | 120s | 30s | ~9 min |
| Measurements only | 20s | 60s | 90s | 30s | ~3.5 min |

---

### 2.2 Critical Path B: Consumer Creates Avatar → Tries On Garment → Fit Score

```
Consumer (Mobile App)
      │
      │ POST /api/v1/avatars
      │ {display_name, height_cm, weight_kg}
      ▼
API Monolith
  1. Create avatar record (status: PENDING_SCAN)
  2. Return: {avatar_id, scan_session_token}
      │
      ▼
Mobile App — Body Scan (iOS ARKit + Vision framework)
  Scan mode captures over ~30 seconds:
  - LiDAR depth map frames at 30fps
  - RGB video (face and body excluded for privacy)
  - IMU accelerometer + gyroscope (camera position)
  - Turntable prompts: front, side, back, 45° angles

  On-device processing:
  - ARKit body tracking → 3D joint positions
  - Vision framework → body segmentation mask
  - Depth + RGB + IMU fusion → point cloud

  Upload to API:
  POST /api/v1/avatars/{avatar_id}/scan
  {scan_session_token, point_cloud_b64, joint_positions, height_cm, weight_kg}
      │
      ▼
API Monolith
  1. Validate scan token (Redis, 15-min TTL)
  2. Queue scan processing job: pipeline:avatar_jobs
  3. Return: {status: "processing", estimated_seconds: 45}
      │
      ▼
Avatar Pipeline Worker (Cloud Run Job)
  1. Load point cloud from GCS
  2. Open3D: denoise + align to gravity
  3. SMPL-based body model fitting:
     - Fit SMPL parameters to point cloud (shape β, pose θ)
     - Extract body measurements: chest, waist, hips, inseam, shoulder width, etc.
  4. Generate avatar mesh (neutral A-pose)
  5. Save: avatar.glb, measurements.json → GCS
  6. Update avatar record: status=ACTIVE, measurements_set
      │
      ▼
Consumer initiates Try-On
      │
      │ POST /api/v1/try-ons
      │ {avatar_id, ugi, size}
      ▼
API Monolith
  1. Load avatar mesh + measurements from GCS
  2. Load garment .lgmt file (physics metadata + mesh) from GCS
  3. Check cache: Redis key try-on:{avatar_id}:{ugi}:{size}
     → Cache hit: return cached result immediately
     → Cache miss: queue try-on job
      │
      ▼
Try-On Pipeline Worker (Cloud Run Job)
  1. Load avatar mesh and garment mesh
  2. Cloth simulation: drape garment over avatar
     - Collision detection: garment vs body surface
     - Physics params from garment .lgmt (stiffness, weight, stretch)
     - Gravity + collision resolution (20–50 iterations)
  3. Fit analysis:
     - Measure clearance at key body points
     - Compare garment measurements to avatar measurements
     - Flag: too tight / perfect / loose at each zone
  4. Generate fit_score (0–100 composite)
  5. Render try-on output: GLB + USDZ for AR viewing
  6. Cache result in Redis (TTL: 24h)
  7. Save try_on record to PostgreSQL
  8. Publish: try-on:{try_on_id}:complete
      │
      ▼
Consumer receives:
  - Fit score: 87/100 "Great fit — slight looseness at waist"
  - 3D try-on viewer (Three.js / WebGL on web, ARKit on mobile)
  - Size recommendation: "This brand runs small. Size up."
  - AR Quick Look (USDZ) for real-world placement
```

---

### 2.3 Critical Path C: Manufacturer Receives Tech Pack Update → Real-Time

```
Designer (Web Portal)
      │
      │ PATCH /api/v1/garments/{ugi}/versions
      │ {change_type: "pattern_update", files: [...], notes: "Sleeve length +2cm"}
      ▼
API Monolith
  1. Validate auth (must be brand owner or collaborator)
  2. Create garment_version record (version N+1)
  3. Store file diffs in GCS: {ugi}/versions/{version_id}/
  4. Update garment record: current_version_id, status: UPDATING
  5. Enqueue pipeline job (same as Path A, incremental)
  6. Publish Redis PubSub event:
     Channel: garment:{ugi}:updates
     Payload: {event: "version_created", version_id, changes_summary, timestamp}
      │
      ▼
Real-Time Delivery to Manufacturers

Manufacturer has active WebSocket connection:
  - Authenticated via API key
  - Subscribed to garment channels they have access to

WebSocket Event received by manufacturer portal:
  {
    "event": "garment_updated",
    "ugi": "LB-CHRCO-TOP-K8VZ4P-001",
    "version": 4,
    "changes": ["pattern_sleeve_length"],
    "updated_at": "2026-03-15T09:32:11Z",
    "tech_pack_url": "https://cdn.loocbooc.com/{ugi}/v4/techpack.pdf",
    "diff_url": "https://cdn.loocbooc.com/{ugi}/v4/diff.pdf"
  }

Manufacturer sees in their portal:
  - Red badge: "UPDATED" on garment
  - Change summary inline
  - Side-by-side diff view (old vs new measurements)
  - Download updated tech pack (PDF + DXF)
  - Acknowledge button (creates production_record acknowledgment)
      │
      ▼
3D Pipeline regenerates updated model (async)
  - Same pipeline as Path A
  - Incremental: only re-simulates affected components
  - On completion: publishes garment:{ugi}:model_ready
  - All active try-on caches for this UGI are invalidated
  - Retailers with embedded try-on see updated model automatically
```

---

## 3. Technology Stack — Justified

### 3.1 API Layer: FastAPI (Python 3.12)

**Choice:** FastAPI with Uvicorn ASGI server, Python 3.12.

**Justification:**
- Native async I/O — critical for a platform that spends most time waiting on GCS, PostgreSQL, and pipeline jobs.
- Automatic OpenAPI docs generation — essential for B2B API adoption.
- Pydantic v2 validation is fast (Rust-backed) and gives us schema-as-code.
- Python is the only sane language for a platform that also runs 3D pipelines and ML — same team, same language.
- FastAPI is mature, battle-tested at Uber, Netflix, Microsoft.

**Alternatives considered:**
- **Node.js / Express / Fastify:** Faster cold starts on Cloud Run. Rejected because it splits the team across two languages when the pipeline and physics work is all Python.
- **Go / Gin:** Better performance ceilings. Rejected — team velocity on MVP is the constraint, not raw throughput at this stage.
- **Django REST Framework:** More batteries-included. Rejected — DRF's ORM-coupling and slower async story are anti-patterns for this architecture.
- **gRPC:** Better for service-to-service. Rejected for now — we're starting with a monolith. Add when we split services.

---

### 3.2 Database: PostgreSQL 16 (Cloud SQL)

**Choice:** PostgreSQL 16 on Cloud SQL (managed), primary + read replicas.

**Justification:**
- JSONB columns for flexible spec storage (tech pack fields vary by garment type) without giving up transactional integrity.
- Row-level security for multi-tenant data isolation (brands can only read their own garments).
- `pg_trgm` for full-text search on garment names and fabric compositions without ElasticSearch complexity.
- PostGIS extension ready for future geographic supply chain features.
- Cloud SQL handles backups, failover, and point-in-time recovery — zero ops overhead at MVP.

**Alternatives considered:**
- **MongoDB:** Attractive for flexible document schema. Rejected — DPP compliance requires ACID transactions and audit trails that are painful to guarantee in Mongo.
- **CockroachDB:** Distributed SQL, great for scale. Rejected — Cloud SQL is sufficient to 100K garments/day and the ops simplicity wins.
- **Supabase:** Postgres + realtime + auth. Considered seriously. Rejected — we need custom auth logic and the realtime subsystem would be redundant with our Redis PubSub.

---

### 3.3 Cache / Queue: Redis 7 (Cloud Memorystore)

**Choice:** Redis 7 via Cloud Memorystore, used for three purposes.

**Justification:**
- **Cache:** Try-on results are expensive to compute (2–10s). Caching at `try-on:{avatar_id}:{ugi}:{size}` with 24h TTL gives sub-100ms response on repeat requests.
- **Queue:** Redis Streams (`XADD`/`XREADGROUP`) for the pipeline job queue. Consumer groups give us "at-least-once" delivery and dead-letter behaviour without running a full Kafka cluster.
- **PubSub:** Redis PubSub for real-time manufacturer updates via WebSocket relay in the API.
- **Rate limiting:** Redis atomic increments for sliding window rate limits per API key.
- Single managed service, zero ops.

**Alternatives considered:**
- **Kafka:** Better at high-throughput event streaming. Rejected for MVP — operational complexity and cost are unjustified at our scale. Redis Streams gets us 99% of the way there.
- **Cloud Pub/Sub (GCP native):** Excellent reliability. Rejected because it doesn't serve double duty as cache and rate limiter — we'd need Redis anyway.
- **RabbitMQ:** Classic queue, solid. Rejected — same story as Kafka, Redis Streams is sufficient and simpler.

---

### 3.4 Object Storage: GCS (S3-compatible)

**Choice:** Google Cloud Storage with signed URLs for direct upload/download.

**Justification:**
- GCS bucket lifecycle rules auto-tier cold files to Nearline/Coldline — significant cost savings as the garment archive grows.
- Direct client-to-GCS upload via presigned URLs removes the API server from the upload path entirely (bandwidth savings).
- Strong consistency on all operations (no eventual-consistency surprises).
- EU-region buckets for DPP-compliant EU garment data.

**Storage structure:**
```
gs://loocbooc-prod/
  garments/
    {ugi}/
      v{n}/
        source/          # Original uploaded files
        patterns/        # Normalized pattern files
        model.lgmt       # Proprietary format
        model.glb        # Three.js
        model.usdz       # iOS AR
        thumbnail_512.webp
        thumbnail_1024.webp
        techpack.pdf
  avatars/
    {avatar_id}/
      mesh.glb
      measurements.json
      scan_raw/          # Raw scan data (30-day TTL, then delete)
  pipeline/
    jobs/
      {job_id}/          # Temp working files (7-day TTL)
```

---

### 3.5 3D Pipeline: COLMAP + Open3D + Trimesh

**Choice:** COLMAP for photogrammetry, Open3D for point cloud processing and mesh operations, Trimesh for pattern-to-3D mathematical reconstruction.

**Justification:**

**COLMAP:**
- Best-in-class open-source SfM (Structure-from-Motion). Used in academic and production settings globally.
- Takes our 12-photo or video input and produces a dense point cloud.
- GPU-accelerated feature extraction (SIFT/SuperPoint).
- Well-maintained, Python bindings available (`pycolmap`).
- Alternatives: OpenMVG (less maintained), Meshroom (higher level but less controllable), commercial solutions (cost prohibitive at scale).

**Open3D:**
- Best Python library for point cloud → mesh pipeline.
- Alpha shapes and Poisson reconstruction for garment mesh generation.
- Built-in mesh simplification and cleaning operations.
- GPU support for large meshes.
- Alternatives: PCL (C++ only, no Python), trimesh (better for manipulation, worse for reconstruction).

**Trimesh:**
- For the pattern-to-3D path: mathematical unfolding of 2D cut patterns into 3D garment geometry.
- Handles mesh boolean operations (seam joining), UV manipulation, and format export.
- Complements Open3D — Trimesh handles manipulation, Open3D handles reconstruction.
- Alternatives: None that match the combination of features and Python-native usage.

**The fabric challenge:**
Fabric is deformable, often textureless (solid colours, fine weaves that look homogeneous), and reflective (silk, satin, vinyl). This breaks standard photogrammetry assumptions:
- Textureless surfaces: COLMAP's feature matching fails on solid-colour fabrics. **Mitigation:** Use depth map fusion from LiDAR (mobile scan path) rather than feature matching for textureless garments. For photo path, add pattern/texture watermarking instructions in onboarding.
- Deformable: garment shape changes between photos. **Mitigation:** Strict scan protocol (flat lay on contrasting surface, or dress form), plus physics-based mesh regularisation post-reconstruction.
- Reflective: specular highlights break depth estimation. **Mitigation:** HDR capture mode recommendation, polarisation filter in premium scan kit, and Vertex AI-powered highlight inpainting.

---

### 3.6 Physics: ARCSim-Inspired Cloth Simulation

**Choice:** Custom Python cloth simulation engine, architecturally inspired by ARCSim, simplified for production speed.

**Justification:**
ARCSim (Adaptive Remeshing for Cloth Simulation) is the academic gold standard for physics-accurate cloth. We do not use ARCSim directly because:
- It is not production-ready (C++ research code, no Python bindings, no batch mode)
- Full ARCSim is too slow for our latency targets (minutes per frame vs our need for seconds)

Our simulation is ARCSim-inspired in its treatment of:
- **Mass-spring system:** Each triangle in the mesh is a mass point with spring connections to neighbours (stretch, shear, bend springs)
- **Material properties from composition:** Tensile stiffness, bending stiffness, and damping coefficients derived from fabric lookup table
- **Collision response:** Garment vs. body surface collision handled with penalty forces + position correction
- **Gravity integration:** Implicit Euler integration for stability with large timesteps

The key simplification: we only need the **rest drape** (garment hanging still), not dynamic motion. This reduces the computation from thousands of frames to 20–50 time steps to convergence.

**Fabric properties mapping:**
```
Cotton 100%     → stiffness: 0.8, drape: 0.3, stretch: 0.05
Cotton/Poly 65/35 → stiffness: 0.9, drape: 0.25, stretch: 0.04
Linen 100%      → stiffness: 1.4, drape: 0.15, stretch: 0.02
Silk 100%       → stiffness: 0.2, drape: 0.95, stretch: 0.03
Wool 100%       → stiffness: 0.7, drape: 0.55, stretch: 0.08
Denim 100%      → stiffness: 2.1, drape: 0.1, stretch: 0.01
Spandex blend   → stiffness: 0.3, drape: 0.4, stretch: 0.35
```

These seed values are hand-calibrated on known reference garments. They improve via feedback loop: when a consumer rates fit accuracy, the error propagates back to refine the fabric's physics parameters. After 1M garments, this is a closed-loop learning system.

---

### 3.7 Frontend: Next.js 14 App Router + Three.js r160

**Choice:** Next.js 14 with App Router for server-side rendering and Three.js r160 for 3D rendering.

**Justification:**

**Next.js 14 App Router:**
- Server Components allow garment listing pages to be server-rendered with zero JS bundle cost — critical for SEO (brands need their garment pages indexed).
- Streaming SSR: try-on UI can show the garment immediately while the avatar loads.
- Built-in image optimisation for garment thumbnails.
- API routes for thin BFF (Backend for Frontend) layer if needed.
- TypeScript-first. Vercel hosting optionally available.

**Three.js r160:**
- Industry standard for WebGL 3D rendering. The ecosystem is massive — every Three.js problem has been solved.
- r160 has stable GLB loader, physically-based rendering (PBR), and good performance on mobile browsers.
- React Three Fiber (R3F) wraps Three.js for React ergonomics — component-based 3D scenes.
- WebXR support for in-browser AR on supported devices.

**Alternatives considered:**
- **Babylon.js:** Strong AR/XR support. Slightly worse React integration than R3F. Considered if WebXR becomes primary — currently iOS AR is handled natively.
- **Unity WebGL:** Most powerful. Rejected — 20MB+ download, slow load, too heavy for web consumer experience.
- **model-viewer (Google):** Simple. Rejected — no programmatic control needed for our try-on overlay and measurement annotations.

---

### 3.8 Mobile: React Native + iOS Vision Framework + ARKit

**Choice:** React Native for cross-platform UI, iOS-native modules for ARKit and Vision framework.

**Justification:**

**React Native:**
- Shared codebase with web frontend (components, types, API client).
- Native module bridge allows deep iOS ARKit and Vision integration while keeping the app shell in JS.
- Large talent pool.

**iOS Vision Framework:**
- On-device body pose estimation (`VNDetectHumanBodyPoseRequest`) — no server round trip for initial joint extraction.
- Body segmentation (`VNGeneratePersonSegmentationRequest`) — removes background from scan frames.
- Core ML integration for on-device fabric classification.

**ARKit:**
- Body tracking (`ARBodyTrackingConfiguration`) — accurate skeletal tracking for avatar superimposition.
- Depth API (LiDAR, iPhone Pro 12+) — millimeter-accurate depth for body scanning.
- World tracking for AR try-on placement in real environment.
- Scene Reconstruction (LiDAR) — for brands scanning garments on dress forms.

**Why iOS first:**
- iPhone Pro LiDAR is the best mobile depth sensor available. Android depth sensors (ToF) are inconsistent across OEMs.
- ARKit is years ahead of ARCore in body tracking accuracy.
- Apple's vertical integration means depth + RGB + IMU + focus metadata are reliably fused.
- Android support: roadmap item post-MVP. React Native bridge abstracts the scanner — swapping the native module is the only change.

---

### 3.9 Infrastructure: GCP

**Choice:** Google Cloud Platform — Cloud Run (API + pipeline), Cloud SQL (PostgreSQL), Cloud Memorystore (Redis), Cloud Storage (GCS), Cloud Armor (WAF), Vertex AI (ML).

**Justification:**
- **Cloud Run:** Scales to zero when idle (MVP cost control), scales to thousands of instances under load. Supports GPU instances for pipeline jobs.
- **Vertex AI:** Native integration for fine-tuning and serving the fit prediction model. Best-in-class for our use case vs AWS SageMaker (more complex) or Azure ML.
- **EU data residency:** GCP has comprehensive EU regional infrastructure for DPP compliance. Data processed in `europe-west1` never leaves EU boundary.
- **Single-cloud simplicity at MVP:** Reduces operational complexity. Multi-cloud optionality is irrelevant until we have a team large enough to operate it.

**Alternatives considered:**
- **AWS:** More mature, larger ecosystem. Rejected — GCP's Vertex AI integration and Cloud Run simplicity edge it out for this stack.
- **Azure:** Strong for enterprise customers. Rejected at MVP — no differentiating advantage.
- **Fly.io / Railway:** Simpler, cheaper at small scale. Rejected — GCP gives us GPU-capable jobs and Vertex AI without vendor gymnastics later.

---

## 4. Database Schema

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ============================================================
-- BRANDS
-- ============================================================
CREATE TABLE brands (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug            VARCHAR(64) UNIQUE NOT NULL,        -- URL-safe identifier
    name            VARCHAR(255) NOT NULL,
    brand_code      VARCHAR(8) UNIQUE NOT NULL,         -- Short code for UGI: "CHRCO"
    email           VARCHAR(255) UNIQUE NOT NULL,
    country_code    CHAR(2) NOT NULL,
    tier            VARCHAR(32) NOT NULL DEFAULT 'starter'
                        CHECK (tier IN ('starter', 'growth', 'enterprise')),
    status          VARCHAR(32) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'suspended', 'pending')),
    webhook_url     TEXT,
    webhook_secret  VARCHAR(128),
    settings        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brands_slug ON brands(slug);
CREATE INDEX idx_brands_brand_code ON brands(brand_code);
CREATE INDEX idx_brands_status ON brands(status);

-- ============================================================
-- BRAND_INTEGRATIONS
-- ============================================================
CREATE TABLE brand_integrations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    integration_type VARCHAR(64) NOT NULL
                        CHECK (integration_type IN (
                            'clo3d', 'marvelous_designer', 'gerber_accumark',
                            'lectra_modaris', 'tukatech', 'optitex',
                            'centric_plm', 'infor_fashion', 'shopify',
                            'woocommerce', 'magento', 'custom_webhook'
                        )),
    credentials     JSONB NOT NULL DEFAULT '{}',       -- Encrypted in app layer
    config          JSONB NOT NULL DEFAULT '{}',
    status          VARCHAR(32) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive', 'error')),
    last_sync_at    TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(brand_id, integration_type)
);

CREATE INDEX idx_brand_integrations_brand_id ON brand_integrations(brand_id);
CREATE INDEX idx_brand_integrations_type ON brand_integrations(integration_type);

-- ============================================================
-- API_KEYS
-- ============================================================
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id        UUID REFERENCES brands(id) ON DELETE CASCADE,
    -- null brand_id = system/manufacturer key
    key_hash        VARCHAR(128) UNIQUE NOT NULL,       -- SHA-256 of actual key
    key_prefix      VARCHAR(16) NOT NULL,               -- First 8 chars, for display
    name            VARCHAR(255) NOT NULL,
    scopes          TEXT[] NOT NULL DEFAULT '{}',       -- ['garments:read', 'try_on:write', etc]
    role            VARCHAR(32) NOT NULL DEFAULT 'brand'
                        CHECK (role IN ('brand', 'manufacturer', 'consumer', 'admin', 'system')),
    rate_limit_rpm  INTEGER NOT NULL DEFAULT 60,
    expires_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_brand_id ON api_keys(brand_id);
CREATE INDEX idx_api_keys_role ON api_keys(role);

-- ============================================================
-- FABRIC_COMPOSITIONS
-- ============================================================
CREATE TABLE fabric_compositions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    composition_hash VARCHAR(64) UNIQUE NOT NULL,       -- SHA-256 of normalized composition string
    raw_text        TEXT NOT NULL,                      -- "65% Cotton, 35% Polyester"
    components      JSONB NOT NULL,
    -- [{"fibre": "cotton", "percentage": 65}, {"fibre": "polyester", "percentage": 35}]
    weave_structure VARCHAR(64),                        -- 'plain', 'twill', 'satin', 'knit', etc.
    weight_gsm      NUMERIC(8,2),                       -- grams per square meter
    finish_treatments TEXT[],                           -- ['mercerized', 'anti-wrinkle', etc]
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fabric_compositions_hash ON fabric_compositions(composition_hash);
CREATE INDEX idx_fabric_compositions_components ON fabric_compositions USING gin(components);

-- ============================================================
-- FABRIC_PHYSICS
-- ============================================================
CREATE TABLE fabric_physics (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    composition_id      UUID NOT NULL REFERENCES fabric_compositions(id),
    tensile_stiffness   NUMERIC(8,4) NOT NULL,          -- Young's modulus proxy
    bending_stiffness   NUMERIC(8,4) NOT NULL,          -- Resistance to bending
    shear_stiffness     NUMERIC(8,4) NOT NULL,
    drape_coefficient   NUMERIC(6,4) NOT NULL,          -- 0 (rigid) to 1 (very drapey)
    stretch_x           NUMERIC(6,4) NOT NULL,          -- Warp stretch %
    stretch_y           NUMERIC(6,4) NOT NULL,          -- Weft stretch %
    mass_per_m2         NUMERIC(8,4) NOT NULL,          -- kg/m²
    friction_static     NUMERIC(6,4) NOT NULL DEFAULT 0.5,
    friction_dynamic    NUMERIC(6,4) NOT NULL DEFAULT 0.4,
    damping             NUMERIC(6,4) NOT NULL DEFAULT 0.1,
    source              VARCHAR(32) NOT NULL DEFAULT 'lookup'
                            CHECK (source IN ('lookup', 'measured', 'ml_inferred', 'calibrated')),
    confidence          NUMERIC(4,3) NOT NULL DEFAULT 0.8
                            CHECK (confidence >= 0 AND confidence <= 1),
    sample_count        INTEGER NOT NULL DEFAULT 0,     -- Garments that refined this value
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fabric_physics_composition ON fabric_physics(composition_id);
CREATE UNIQUE INDEX idx_fabric_physics_composition_unique ON fabric_physics(composition_id);

-- ============================================================
-- GARMENTS
-- ============================================================
CREATE TABLE garments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ugi             VARCHAR(64) UNIQUE NOT NULL,        -- LB-CHRCO-TOP-K8VZ4P-001-X7
    brand_id        UUID NOT NULL REFERENCES brands(id),
    current_version_id UUID,                            -- FK set after first version created
    name            VARCHAR(512) NOT NULL,
    category        VARCHAR(64) NOT NULL
                        CHECK (category IN (
                            'top', 'bottom', 'dress', 'outerwear', 'footwear',
                            'accessory', 'underwear', 'swimwear', 'activewear', 'other'
                        )),
    subcategory     VARCHAR(128),
    gender          VARCHAR(32) CHECK (gender IN ('womenswear', 'menswear', 'unisex', 'childrenswear')),
    status          VARCHAR(32) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'processing', 'active', 'updating',
                                         'error', 'archived', 'deleted')),
    input_type      VARCHAR(64) NOT NULL
                        CHECK (input_type IN (
                            'clo3d', 'marvelous_designer', 'dxf_patterns',
                            'photos_12', 'video_scan', 'measurements_only'
                        )),
    composition_id  UUID REFERENCES fabric_compositions(id),
    physics_id      UUID REFERENCES fabric_physics(id),
    dpp_enabled     BOOLEAN NOT NULL DEFAULT false,
    dpp_record_id   UUID,                               -- FK set when DPP record created
    retail_price    NUMERIC(12,2),
    currency        CHAR(3),
    markets         TEXT[],                             -- ['AU', 'US', 'EU']
    tags            TEXT[],
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ                         -- Soft delete
);

CREATE INDEX idx_garments_brand_id ON garments(brand_id);
CREATE INDEX idx_garments_ugi ON garments(ugi);
CREATE INDEX idx_garments_status ON garments(status);
CREATE INDEX idx_garments_category ON garments(category);
CREATE INDEX idx_garments_tags ON garments USING gin(tags);
CREATE INDEX idx_garments_created_at ON garments(created_at DESC);
-- Full-text search
CREATE INDEX idx_garments_name_trgm ON garments USING gin(name gin_trgm_ops);

-- ============================================================
-- GARMENT_VERSIONS
-- ============================================================
CREATE TABLE garment_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    garment_id      UUID NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
    version_number  INTEGER NOT NULL,
    change_type     VARCHAR(64) NOT NULL
                        CHECK (change_type IN (
                            'initial', 'pattern_update', 'fabric_change',
                            'measurement_correction', 'metadata_update', 'full_reprocess'
                        )),
    change_summary  TEXT,
    changed_by      UUID,                               -- user_id or null for system
    spec_snapshot   JSONB NOT NULL DEFAULT '{}',        -- Full spec at this version
    is_current      BOOLEAN NOT NULL DEFAULT false,
    pipeline_job_id VARCHAR(128),                       -- Cloud Run job ID
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(garment_id, version_number)
);

CREATE INDEX idx_garment_versions_garment_id ON garment_versions(garment_id);
CREATE INDEX idx_garment_versions_current ON garment_versions(garment_id, is_current)
    WHERE is_current = true;

-- After garments table created, add FK back-reference
ALTER TABLE garments ADD CONSTRAINT fk_garments_current_version
    FOREIGN KEY (current_version_id) REFERENCES garment_versions(id) DEFERRABLE INITIALLY DEFERRED;

-- ============================================================
-- GARMENT_FILES
-- ============================================================
CREATE TABLE garment_files (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id      UUID NOT NULL REFERENCES garment_versions(id) ON DELETE CASCADE,
    file_type       VARCHAR(64) NOT NULL
                        CHECK (file_type IN (
                            'source_pattern', 'source_photo', 'source_video', 'source_scan',
                            'source_clo3d', 'source_marvelous', 'source_dxf',
                            'care_label_photo', 'tech_pack_pdf',
                            'model_lgmt', 'model_glb', 'model_usdz',
                            'thumbnail_512', 'thumbnail_1024',
                            'physics_params', 'diff_pdf'
                        )),
    gcs_path        TEXT NOT NULL,                      -- gs://loocbooc-prod/...
    cdn_url         TEXT,                               -- https://cdn.loocbooc.com/...
    file_size_bytes BIGINT,
    mime_type       VARCHAR(128),
    checksum_sha256 VARCHAR(64),
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_garment_files_version_id ON garment_files(version_id);
CREATE INDEX idx_garment_files_type ON garment_files(file_type);

-- ============================================================
-- AVATARS
-- ============================================================
CREATE TABLE avatars (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID,                               -- null until user accounts added
    session_token   VARCHAR(256),                       -- For anonymous avatar creation
    display_name    VARCHAR(255),
    status          VARCHAR(32) NOT NULL DEFAULT 'pending_scan'
                        CHECK (status IN ('pending_scan', 'processing', 'active',
                                         'needs_rescan', 'deleted')),
    height_cm       NUMERIC(5,1) NOT NULL,
    weight_kg       NUMERIC(5,1),
    age_range       VARCHAR(16),                        -- '25-34'
    gender_identity VARCHAR(64),
    gcs_mesh_path   TEXT,                               -- gs://loocbooc-prod/avatars/{id}/mesh.glb
    gcs_measurements_path TEXT,
    privacy_level   VARCHAR(32) NOT NULL DEFAULT 'private'
                        CHECK (privacy_level IN ('private', 'shared', 'anonymous')),
    scan_quality    NUMERIC(4,3),                       -- 0-1 confidence score
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_avatars_user_id ON avatars(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_avatars_status ON avatars(status);

-- ============================================================
-- AVATAR_MEASUREMENTS
-- ============================================================
CREATE TABLE avatar_measurements (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    avatar_id           UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
    chest_cm            NUMERIC(5,1),
    waist_cm            NUMERIC(5,1),
    hips_cm             NUMERIC(5,1),
    shoulder_width_cm   NUMERIC(5,1),
    inseam_cm           NUMERIC(5,1),
    outseam_cm          NUMERIC(5,1),
    neck_cm             NUMERIC(5,1),
    arm_length_cm       NUMERIC(5,1),
    thigh_cm            NUMERIC(5,1),
    calf_cm             NUMERIC(5,1),
    ankle_cm            NUMERIC(5,1),
    foot_length_cm      NUMERIC(5,1),
    torso_length_cm     NUMERIC(5,1),
    rise_cm             NUMERIC(5,1),
    -- Body shape descriptors
    body_type           VARCHAR(32),                    -- 'hourglass', 'pear', 'apple', 'rectangle'
    posture_notes       JSONB,
    -- Size recommendations (denormalized for query speed)
    recommended_sizes   JSONB NOT NULL DEFAULT '{}',
    -- {"brand_id": {"tops": "M", "bottoms": "12", "dresses": "M"}}
    measurement_source  VARCHAR(32) NOT NULL DEFAULT 'scan'
                            CHECK (measurement_source IN ('scan', 'manual', 'tape_measure', 'ml_inferred')),
    measured_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_avatar_measurements_avatar_id ON avatar_measurements(avatar_id);

-- ============================================================
-- SCAN_SESSIONS
-- ============================================================
CREATE TABLE scan_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_type    VARCHAR(32) NOT NULL
                        CHECK (session_type IN ('avatar_body', 'garment_photo', 'garment_video')),
    entity_id       UUID NOT NULL,                      -- avatar_id or garment_id
    status          VARCHAR(32) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'uploading', 'processing', 'complete', 'failed')),
    device_type     VARCHAR(64),                        -- 'iPhone 15 Pro'
    has_lidar       BOOLEAN NOT NULL DEFAULT false,
    frames_captured INTEGER,
    upload_token    VARCHAR(256) UNIQUE NOT NULL,
    upload_expires_at TIMESTAMPTZ NOT NULL,
    error_message   TEXT,
    raw_gcs_path    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_sessions_entity_id ON scan_sessions(entity_id);
CREATE INDEX idx_scan_sessions_upload_token ON scan_sessions(upload_token);

-- ============================================================
-- TRY_ONS
-- ============================================================
CREATE TABLE try_ons (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    avatar_id       UUID NOT NULL REFERENCES avatars(id),
    garment_id      UUID NOT NULL REFERENCES garments(id),
    ugi             VARCHAR(64) NOT NULL,               -- Denormalized for audit trail
    size_requested  VARCHAR(16) NOT NULL,               -- 'S', 'M', 'L', 'XL', '10', etc.
    status          VARCHAR(32) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
    gcs_result_path TEXT,                               -- .glb try-on result
    usdz_result_path TEXT,                              -- .usdz for iOS AR
    processing_ms   INTEGER,                            -- Actual processing time
    cached          BOOLEAN NOT NULL DEFAULT false,
    version_number  INTEGER NOT NULL,                   -- Which garment version was tried on
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_try_ons_avatar_id ON try_ons(avatar_id);
CREATE INDEX idx_try_ons_garment_id ON try_ons(garment_id);
CREATE INDEX idx_try_ons_ugi ON try_ons(ugi);
CREATE INDEX idx_try_ons_created_at ON try_ons(created_at DESC);

-- ============================================================
-- FIT_SCORES
-- ============================================================
CREATE TABLE fit_scores (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    try_on_id       UUID UNIQUE NOT NULL REFERENCES try_ons(id) ON DELETE CASCADE,
    overall_score   NUMERIC(5,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
    -- Zone scores
    chest_score     NUMERIC(5,2),
    waist_score     NUMERIC(5,2),
    hips_score      NUMERIC(5,2),
    shoulder_score  NUMERIC(5,2),
    sleeve_score    NUMERIC(5,2),
    length_score    NUMERIC(5,2),
    -- Clearance measurements (negative = too tight)
    chest_clearance_mm      NUMERIC(6,2),
    waist_clearance_mm      NUMERIC(6,2),
    hips_clearance_mm       NUMERIC(6,2),
    shoulder_clearance_mm   NUMERIC(6,2),
    -- Fit verdict
    fit_verdict     VARCHAR(32) NOT NULL
                        CHECK (fit_verdict IN (
                            'too_small', 'slightly_small', 'perfect', 'slightly_large', 'too_large'
                        )),
    size_recommendation VARCHAR(16),                    -- Recommended size
    notes           TEXT[],                             -- ["Loose at waist", "Perfect at shoulders"]
    -- Consumer feedback (filled after purchase/wear)
    consumer_rating INTEGER CHECK (consumer_rating BETWEEN 1 AND 5),
    consumer_notes  TEXT,
    feedback_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fit_scores_try_on_id ON fit_scores(try_on_id);
CREATE INDEX idx_fit_scores_overall ON fit_scores(overall_score);
CREATE INDEX idx_fit_scores_verdict ON fit_scores(fit_verdict);

-- ============================================================
-- PRODUCTION_RECORDS
-- ============================================================
CREATE TABLE production_records (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    garment_id          UUID NOT NULL REFERENCES garments(id),
    version_number      INTEGER NOT NULL,
    manufacturer_name   VARCHAR(512) NOT NULL,
    manufacturer_country CHAR(2) NOT NULL,
    factory_code        VARCHAR(128),
    factory_name        VARCHAR(512),
    batch_id            VARCHAR(256),
    units_ordered       INTEGER,
    units_produced      INTEGER,
    production_start    DATE,
    production_end      DATE,
    certifications      TEXT[],                         -- ['GOTS', 'OEKO-TEX', 'Fair Trade', ...]
    sourcing_chain      JSONB,
    -- Acknowledgment tracking
    manufacturer_notified_at TIMESTAMPTZ,
    manufacturer_acked_at    TIMESTAMPTZ,
    acked_by_name       VARCHAR(255),
    status              VARCHAR(32) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'acknowledged', 'in_production',
                                             'complete', 'cancelled')),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_production_records_garment_id ON production_records(garment_id);
CREATE INDEX idx_production_records_manufacturer ON production_records(manufacturer_name);
CREATE INDEX idx_production_records_status ON production_records(status);

-- ============================================================
-- DPP_RECORDS (EU Digital Product Passport)
-- ============================================================
CREATE TABLE dpp_records (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    garment_id          UUID UNIQUE NOT NULL REFERENCES garments(id),
    ugi                 VARCHAR(64) NOT NULL,
    -- Material traceability
    material_composition JSONB NOT NULL,
    material_origin     JSONB,                          -- Country of origin per fibre
    -- Manufacturing traceability
    manufacturing_chain JSONB NOT NULL DEFAULT '[]',
    -- Sustainability data
    carbon_footprint_kg NUMERIC(10,4),
    water_usage_litres  NUMERIC(10,2),
    certifications      TEXT[],
    -- Repair and recycling
    care_instructions   TEXT[],
    repair_instructions TEXT,
    disassembly_instructions TEXT,
    recyclability_score NUMERIC(4,3),
    recycling_instructions TEXT,
    -- Compliance
    eu_compliant        BOOLEAN NOT NULL DEFAULT false,
    compliance_version  VARCHAR(16) NOT NULL DEFAULT '1.0',
    data_region         VARCHAR(32) NOT NULL DEFAULT 'europe-west1',
    -- Lifecycle
    issued_at           TIMESTAMPTZ,
    last_updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dpp_records_garment_id ON dpp_records(garment_id);
CREATE INDEX idx_dpp_records_ugi ON dpp_records(ugi);
CREATE INDEX idx_dpp_records_compliant ON dpp_records(eu_compliant);
```

---

## 5. API Contract

**Base URL:** `https://api.loocbooc.com/api/v1`
**Auth:** Bearer token (JWT) or `X-API-Key` header
**Content-Type:** `application/json` (multipart for file uploads)
**Rate limits:** Per-key, enforced via Redis sliding window. Limits noted per endpoint.

### 5.1 Authentication

```
POST /auth/token
  Purpose: Exchange email+password for JWT
  Auth: None
  Body: {email: string, password: string}
  Response 200: {access_token: string, token_type: "bearer", expires_in: 3600, refresh_token: string}
  Response 401: {error: "invalid_credentials"}

POST /auth/refresh
  Purpose: Refresh JWT
  Auth: refresh_token in body
  Body: {refresh_token: string}
  Response 200: {access_token: string, expires_in: 3600}

POST /auth/api-keys
  Purpose: Create API key for brand
  Auth: JWT (brand role)
  Rate: 10/hour
  Body: {name: string, scopes: string[], expires_at?: ISO8601}
  Response 201: {id: UUID, key: string, key_prefix: string, scopes: string[]}
  Note: key is returned ONCE — hash stored, never retrievable again

DELETE /auth/api-keys/{key_id}
  Purpose: Revoke API key
  Auth: JWT (brand role, own keys only)
  Response 204: Empty
```

### 5.2 Garments

```
POST /garments
  Purpose: Create new garment, receive UGI and upload URLs
  Auth: JWT or API key (scope: garments:write)
  Rate: 1000/hour per brand
  Body: {
    name: string,                    // "Classic White Tee"
    category: GarmentCategory,       // "top"
    subcategory?: string,            // "t-shirt"
    gender?: GarmentGender,
    input_type: InputType,           // "dxf_patterns" | "photos_12" | ...
    composition_text?: string,       // "100% Cotton" (from care label)
    metadata?: Record<string, any>
  }
  Response 201: {
    ugi: string,                     // "LB-CHRCO-TOP-K8VZ4P-001-X7"
    garment_id: UUID,
    status: "draft",
    upload_urls: {
      patterns?: PresignedUpload[],  // For DXF/pattern input
      photos?: PresignedUpload[],    // Up to 12 photos
      video?: PresignedUpload,
      care_label?: PresignedUpload,
      tech_pack?: PresignedUpload
    },
    expires_at: ISO8601              // Upload URLs expire in 1 hour
  }

GET /garments/{ugi}
  Purpose: Get garment by UGI
  Auth: JWT or API key (scope: garments:read); public for active garments with allow_public
  Rate: 10000/hour
  Response 200: {
    ugi: string,
    name: string,
    category: GarmentCategory,
    status: GarmentStatus,
    brand: {id: UUID, name: string, slug: string},
    current_version: GarmentVersionSummary,
    composition: FabricCompositionSummary,
    models: {
      glb_url?: string,
      usdz_url?: string,
      thumbnail_512?: string,
      thumbnail_1024?: string
    },
    dpp?: DPPSummary,
    created_at: ISO8601,
    updated_at: ISO8601
  }

GET /garments
  Purpose: List garments for authenticated brand
  Auth: JWT or API key (scope: garments:read)
  Rate: 1000/hour
  Query: ?status=active&category=top&page=1&per_page=50&search=tee
  Response 200: {
    items: GarmentSummary[],
    total: number,
    page: number,
    per_page: number,
    has_next: boolean
  }

POST /garments/{ugi}/submit
  Purpose: Trigger 3D processing after files are uploaded
  Auth: JWT or API key (scope: garments:write)
  Rate: 1000/hour
  Body: {}  (files already in GCS from upload_urls)
  Response 202: {
    ugi: string,
    job_id: string,
    status: "processing",
    estimated_seconds: number,
    poll_url: string,           // GET /garments/{ugi}/status
    webhook_url?: string        // If brand has webhook configured
  }

GET /garments/{ugi}/status
  Purpose: Poll processing status
  Auth: JWT or API key (scope: garments:read)
  Rate: 6000/hour (1/10s burst)
  Response 200: {
    ugi: string,
    status: GarmentStatus,
    progress_percent?: number,
    current_phase?: string,     // "photogrammetry" | "mesh_clean" | "physics" | "output"
    error?: string,
    completed_at?: ISO8601
  }

PATCH /garments/{ugi}
  Purpose: Update garment metadata (non-structural)
  Auth: JWT or API key (scope: garments:write)
  Rate: 1000/hour
  Body: {name?, tags?, metadata?, retail_price?, markets?}
  Response 200: GarmentResponse

DELETE /garments/{ugi}
  Purpose: Soft-delete garment
  Auth: JWT (brand role, own garments)
  Rate: 100/hour
  Response 204: Empty

POST /garments/{ugi}/versions
  Purpose: Upload new version of garment (triggers re-processing)
  Auth: JWT or API key (scope: garments:write)
  Rate: 100/hour per garment
  Body: {
    change_type: VersionChangeType,
    change_summary: string,
    input_type: InputType
  }
  Response 201: {
    version_id: UUID,
    version_number: number,
    upload_urls: {...},          // Same structure as POST /garments
    expires_at: ISO8601
  }

GET /garments/{ugi}/versions
  Purpose: Get version history
  Auth: JWT or API key (scope: garments:read)
  Rate: 1000/hour
  Response 200: {items: GarmentVersionSummary[], total: number}
```

### 5.3 Avatars

```
POST /avatars
  Purpose: Create avatar and get scan upload URL
  Auth: JWT or anonymous session token
  Rate: 10/hour per user
  Body: {
    display_name?: string,
    height_cm: number,
    weight_kg?: number,
    gender_identity?: string
  }
  Response 201: {
    avatar_id: UUID,
    status: "pending_scan",
    scan_session: {
      session_id: UUID,
      upload_token: string,       // For mobile scan upload
      upload_url: string,
      expires_at: ISO8601
    }
  }

POST /avatars/{avatar_id}/scan
  Purpose: Upload completed body scan from mobile
  Auth: scan upload_token (one-time use)
  Rate: 5/hour per avatar
  Content-Type: multipart/form-data
  Fields: {
    point_cloud: File (.ply),     // Open3D point cloud
    joint_positions: File (.json), // ARKit body joints
    height_cm: number,
    has_lidar: boolean,
    device_model: string
  }
  Response 202: {
    avatar_id: UUID,
    job_id: string,
    status: "processing",
    estimated_seconds: 45
  }

GET /avatars/{avatar_id}
  Purpose: Get avatar status and measurements
  Auth: JWT (own avatar) or admin
  Rate: 1000/hour
  Response 200: {
    avatar_id: UUID,
    status: AvatarStatus,
    measurements?: AvatarMeasurements,
    mesh_url?: string,           // .glb for 3D display
    scan_quality?: number,
    created_at: ISO8601
  }

POST /avatars/{avatar_id}/measurements
  Purpose: Create avatar with manual measurements (no scan)
  Auth: JWT
  Rate: 10/hour
  Body: AvatarMeasurements   // Full measurement object
  Response 201: {avatar_id: UUID, status: "active", measurements: AvatarMeasurements}
```

### 5.4 Try-On

```
POST /try-ons
  Purpose: Request a try-on simulation
  Auth: JWT or session token
  Rate: 100/hour per avatar
  Body: {
    avatar_id: UUID,
    ugi: string,
    size: string                  // "S" | "M" | "L" | "10" | etc.
  }
  Response 202: {
    try_on_id: UUID,
    status: "processing",         // or "complete" if cache hit
    estimated_seconds?: number,
    result?: TryOnResult          // Included immediately if cache hit
  }

GET /try-ons/{try_on_id}
  Purpose: Get try-on result
  Auth: JWT (own try-on)
  Rate: 6000/hour
  Response 200: {
    try_on_id: UUID,
    status: TryOnStatus,
    result?: {
      glb_url: string,            // Try-on model for Three.js
      usdz_url: string,           // For iOS AR Quick Look
      thumbnail_url: string,
      fit_score: FitScore,
      cached: boolean
    }
  }

POST /try-ons/{try_on_id}/feedback
  Purpose: Submit consumer fit feedback after purchase
  Auth: JWT
  Rate: 100/hour
  Body: {rating: 1|2|3|4|5, notes?: string, actual_size_worn?: string}
  Response 200: {feedback_recorded: true}
```

### 5.5 OCR and Fabric

```
POST /ocr/care-label
  Purpose: Extract fabric composition from care label photo
  Auth: JWT or API key (scope: ocr:read)
  Rate: 500/hour
  Content-Type: multipart/form-data
  Fields: {image: File (JPEG/PNG/WebP, max 10MB)}
  Response 200: {
    raw_text: string,             // "65% Cotton 35% Polyester"
    composition: FibreComponent[],
    confidence: number,           // 0-1
    composition_id?: UUID,        // If matched in database
    physics?: FabricPhysicsSummary
  }

GET /fabric/physics
  Purpose: Get physics parameters for a composition string
  Auth: JWT or API key
  Rate: 1000/hour
  Query: ?composition=65%25+Cotton+35%25+Polyester&weave=twill
  Response 200: {
    composition_id: UUID,
    physics: FabricPhysics,
    source: "lookup" | "ml_inferred",
    confidence: number
  }

GET /fabric/compositions
  Purpose: Search compositions database
  Auth: JWT or API key
  Rate: 1000/hour
  Query: ?q=cotton+polyester&page=1
  Response 200: {items: FabricCompositionSummary[], total: number}
```

### 5.6 DPP (Digital Product Passport)

```
POST /garments/{ugi}/dpp
  Purpose: Create or update DPP record
  Auth: JWT (brand role)
  Rate: 100/hour
  Body: {
    material_composition: JSONB,
    material_origin?: JSONB,
    manufacturing_chain: JSONB,
    certifications?: string[],
    care_instructions?: string[],
    recyclability_score?: number,
    recycling_instructions?: string
  }
  Response 201: {dpp_id: UUID, eu_compliant: boolean, compliance_gaps?: string[]}

GET /garments/{ugi}/dpp
  Purpose: Get DPP record (public endpoint for consumer scanning)
  Auth: None (public)
  Rate: 10000/hour
  Response 200: DPPRecord

GET /garments/{ugi}/dpp/qr
  Purpose: Get QR code image linking to DPP
  Auth: None (public)
  Response: image/png
```

### 5.7 Production & Manufacturer

```
POST /garments/{ugi}/production
  Purpose: Create production record and notify manufacturer
  Auth: JWT (brand role)
  Rate: 100/hour
  Body: {
    manufacturer_name: string,
    manufacturer_country: string,
    factory_code?: string,
    units_ordered?: number,
    production_start?: date,
    certifications?: string[]
  }
  Response 201: {
    production_id: UUID,
    manufacturer_notified_at: ISO8601,
    manufacturer_portal_url: string   // Unique URL for manufacturer to view tech pack
  }

GET /manufacturer/garments
  Purpose: Get garments shared with authenticated manufacturer
  Auth: API key (role: manufacturer)
  Rate: 1000/hour
  Query: ?status=updated&page=1
  Response 200: {items: GarmentSummary[], total: number}

POST /manufacturer/garments/{ugi}/acknowledge
  Purpose: Manufacturer acknowledges receipt of update
  Auth: API key (role: manufacturer)
  Rate: 1000/hour
  Body: {version_number: number, acked_by: string, notes?: string}
  Response 200: {acknowledged: true, timestamp: ISO8601}
```

### 5.8 WebSocket (Real-Time Updates)

```
WSS /ws?token={jwt_or_api_key}

Client subscribe message:
  {action: "subscribe", channels: ["garment:{ugi}", "brand:{brand_id}"]}

Server events:
  {event: "garment_updated", ugi, version, changes_summary, timestamp}
  {event: "garment_processing_complete", ugi, status, model_urls}
  {event: "try_on_complete", try_on_id, fit_score}
  {event: "manufacturer_acked", ugi, version, acked_by, timestamp}
```

---

## 6. Garment UUID (UGI) System Design

### 6.1 Format Specification

```
LB - [BRAND] - [CATEGORY] - [TIMESTAMP_B36] - [VERSION] - [CHK]

Example: LB-CHRCO-TOP-K8VZ4P-001-X7

Components:
  LB          = Loocbooc prefix (fixed)
  CHRCO       = Brand code (5-8 chars, alphanumeric, brand-chosen at registration)
  TOP         = Category code (3-char)
  K8VZ4P      = Timestamp + random in base36 (6 chars = ~2.2 billion values)
  001         = Version (3-digit, zero-padded, increments on structural changes)
  X7          = Luhn-inspired checksum (2 chars)
```

**Category codes:**
```
TOP = tops/shirts/blouses     BOT = bottoms/pants/skirts
DRS = dresses                 OUT = outerwear/jackets/coats
FTW = footwear                ACC = accessories
UND = underwear/lingerie      SWM = swimwear
ACT = activewear              OTH = other
```

### 6.2 Generation Algorithm

```python
import base64
import hashlib
import time
import secrets
import string

BASE36_CHARS = string.digits + string.ascii_uppercase

def encode_base36(n: int, length: int = 6) -> str:
    """Encode integer to base36 string of fixed length."""
    result = []
    while n > 0:
        result.append(BASE36_CHARS[n % 36])
        n //= 36
    return ''.join(reversed(result)).zfill(length)

def compute_checksum(components: list[str]) -> str:
    """
    Luhn-inspired 2-char checksum over the UGI components.
    Detects single-character transcription errors.
    """
    combined = ''.join(components)
    # Map each char to a number (0-35 in base36 space)
    values = [BASE36_CHARS.index(c.upper()) for c in combined if c.upper() in BASE36_CHARS]
    # Double every second value (Luhn variant)
    total = 0
    for i, v in enumerate(reversed(values)):
        if i % 2 == 1:
            v *= 2
            if v >= 36:
                v -= 35
        total += v
    check_val = (36 - (total % 36)) % 36
    # Second check digit (hash-based for additional entropy)
    h = int(hashlib.sha256(combined.encode()).hexdigest()[:4], 16) % 36
    return BASE36_CHARS[check_val] + BASE36_CHARS[h]

def generate_ugi(brand_code: str, category: str) -> str:
    """
    Generate a Universal Garment Identifier.
    Thread-safe. Collision probability: ~1 in 2.8 billion per brand+category combo.
    """
    # Timestamp component: milliseconds since epoch, shifted right by 6 bits for compaction
    ts = int(time.time() * 1000)
    # Add 16 bits of random to prevent collision at same millisecond
    random_component = secrets.randbits(16)
    combined = (ts << 16) | random_component
    # Encode to 8 base36 chars, take first 6
    timestamp_b36 = encode_base36(combined, 8)[:6]

    components = ['LB', brand_code.upper(), category.upper()[:3], timestamp_b36, '001']
    checksum = compute_checksum(components)
    return '-'.join(components) + '-' + checksum

# Example output: LB-CHRCO-TOP-K8VZ4P-001-X7
```

**Collision resistance:** With 6 base36 timestamp+random characters, we have 36^6 = 2,176,782,336 possible values per brand+category combination. Even at 100,000 garments/day, a collision probability of < 1 in 100,000 per year. Collision detection runs at write time against the `garments` table unique index — retry with new random on conflict (< 1 in a billion probability).

### 6.3 Versioning Strategy

The version component (`001`, `002`, etc.) increments when:
- Pattern geometry changes (pattern_update, full_reprocess)
- Fabric composition changes (fabric_change)
- Measurement corrections that affect the 3D model

The version does **not** increment for:
- Metadata updates (name, tags, price, markets)
- Retail information changes
- DPP record updates

This means a consumer can safely cache a try-on result for `LB-CHRCO-TOP-K8VZ4P-001-X7` — if they see the garment is now on version `002`, they know the model has changed and the try-on needs to be re-run.

**Version history is permanent.** Old versions remain accessible at `GET /garments/{ugi}?version=1`. This is required for DPP audit trails.

### 6.4 Physical Encoding

**QR Code:** Generate QR code linking to `https://loocbooc.com/g/{ugi}` — resolves to public DPP page if public, or brand portal if authenticated. QR code spec: ISO 18004, version 3, error correction level M. Minimum print size: 2cm × 2cm.

**Barcode (GS1):** For brands that require 1D barcode compatibility (traditional retail hangtags), encode UGI in Code 128 barcode. Note: UGI is longer than standard EAN-13 — use hangtag with QR primary, barcode secondary.

**NFC (future):** UGI + DPP URL encodable in NFC tag (NDEF format) for premium garments. Architecture supports this — no schema changes required.

---

## 7. 3D Pipeline Architecture

### 7.1 Pipeline Job Structure

```python
# Job payload written to Redis Stream: pipeline:jobs
{
    "job_id": "pjob_01JN7...",
    "job_type": "garment_process" | "garment_update" | "avatar_scan" | "try_on",
    "ugi": "LB-CHRCO-TOP-K8VZ4P-001-X7",
    "version_id": "uuid",
    "input_type": "dxf_patterns" | "photos_12" | "video_scan" | "clo3d" | "measurements_only",
    "input_files": [
        {"type": "pattern_dxf", "gcs_path": "gs://loocbooc-prod/garments/.../source/front.dxf"},
        {"type": "care_label", "gcs_path": "gs://loocbooc-prod/garments/.../source/label.jpg"}
    ],
    "physics_params": {
        "composition_id": "uuid",
        "tensile_stiffness": 0.8,
        "drape_coefficient": 0.3
    },
    "priority": 1,              // 1=normal, 2=high, 3=urgent
    "enqueued_at": "ISO8601",
    "max_retries": 3,
    "retry_count": 0
}
```

### 7.2 Queue Architecture

```
Redis Stream: pipeline:jobs
  Consumer Group: pipeline-workers
  Per-message acknowledgment (XACK)
  Dead Letter: pipeline:jobs:dead (after max_retries)
  Monitoring: pipeline:jobs:metrics (counters)

Worker spawn strategy:
  - Cloud Run Jobs triggered on queue depth > threshold
  - Job concurrency: 1 job per Cloud Run instance (resource isolation)
  - Max instances: 50 at MVP, 500 at scale
  - GPU instances: For photogrammetry-heavy workloads (COLMAP)
  - Auto-scaling: Cloud Run scales based on queue depth metric (Cloud Monitoring custom metric)
```

### 7.3 Processing Steps by Input Type

**Path 1: CLO3D / Marvelous Designer File**
```
Step 1: Parse .zprj / .avt file (custom parser)        [5s]
  - Extract mesh panels + seam definitions
  - Extract fabric assignment + simulation params
Step 2: Validate geometry                               [5s]
  - Check for non-manifold edges, degenerate triangles
Step 3: Apply Loocbooc physics override                 [10s]
  - If fabric params not in file: look up from composition
  - Merge CLO3D physics with Loocbooc physics DB
Step 4: Simulate rest drape                             [30s]
  - Run physics sim with body placeholder
Step 5: Output generation                               [30s]
  - .lgmt, GLB, USDZ, thumbnails
TOTAL: ~80s
```

**Path 2: DXF Cut Patterns**
```
Step 1: Parse DXF files (ezdxf library)                [20s]
  - Extract all pattern pieces
  - Identify grain lines, notches, seam allowances
Step 2: Classify pieces (ML model)                      [10s]
  - "front bodice", "back bodice", "sleeve", etc.
  - Vertex AI model trained on 100K+ pattern pieces
Step 3: Sew in 3D (Trimesh)                            [60s]
  - Project 2D pieces into 3D space using seam matching
  - Join pieces along seam lines
  - Resolve folding and tension
Step 4: Physics simulation                              [90s]
  - Apply fabric params, gravity, drape
Step 5: Mesh cleanup (Open3D)                           [20s]
  - Fill holes, smooth, remesh to target polygon count
Step 6: Output generation                               [30s]
TOTAL: ~4min
```

**Path 3: 12 Photos**
```
Step 1: Validate photos                                 [10s]
  - Check count, resolution, coverage angles
Step 2: COLMAP SfM reconstruction                       [120s] *GPU
  - Feature extraction (SuperPoint)
  - Feature matching across images
  - Sparse reconstruction
  - Dense point cloud (MVS)
Step 3: Open3D mesh reconstruction                      [60s]
  - Alpha shape / Poisson surface reconstruction
  - Hole filling
Step 4: Textureless garment handling                    [30s]
  - If fabric is solid/textureless: apply physics-based
    surface regularisation to prevent lumpy reconstruction
  - Apply material properties from composition
Step 5: Physics simulation                              [120s]
  - Re-drape from flat pose
Step 6: Mesh cleanup + optimisation                     [30s]
Step 7: Output generation                               [30s]
TOTAL: ~7min
```

**Path 4: Video Scan (60–90 seconds)**
```
Step 1: Frame extraction                               [15s]
  - Extract keyframes at 2fps (120-180 frames)
  - Fuse LiDAR depth maps (if iPhone Pro)
Step 2: COLMAP SfM (video mode)                        [180s] *GPU
  - Sequential matching (faster for video)
  - Dense reconstruction with depth map fusion
Step 3: Point cloud processing (Open3D)                [60s]
  - Statistical outlier removal
  - Normal estimation
  - Poisson reconstruction
Step 4: Garment segmentation                            [20s]
  - Vertex AI segment garment from background/hands
Step 5: Physics simulation                              [120s]
Step 6: Output generation                               [30s]
TOTAL: ~7-10min
```

**Path 5: Measurements Only**
```
Step 1: Load silhouette template for category/gender   [5s]
  - Parameterised base mesh for category
Step 2: Deform template to measurements                [20s]
  - Scale key vertices to match input measurements
  - Grading rules applied
Step 3: Physics simulation                              [90s]
Step 4: Output generation                               [30s]
TOTAL: ~2.5min
Note: Lowest quality path. Generates a plausible model, not a
      garment-accurate one. Suitable for fabric testing, not retail.
```

### 7.4 Failure Handling

```
Transient failures (retry):
  - GCS read/write timeout → retry with exponential backoff (3x)
  - COLMAP out of memory → retry on larger instance
  - Physics divergence (NaN/Inf) → retry with lower timestep

Recoverable failures (fallback):
  - COLMAP reconstruction quality too low → downgrade to measurements_only path,
    flag garment as "limited_model", notify brand
  - Textureless fabric → apply physics regularisation, proceed
  - Missing pattern piece → request from brand, pause job

Permanent failures (dead letter):
  - Corrupted input files (non-recoverable parse error)
  - Missing required input for selected input_type
  - Physics params undefined for composition (rare — fallback to defaults)
  
  → Job moves to pipeline:jobs:dead
  → Garment status set to "error"
  → Brand notified with specific error and remediation instructions
  → Support ticket auto-created

Monitoring:
  - Pipeline job SLA: 95th percentile within 2x estimated time
  - Dead letter rate alert: > 5% of jobs in any 1-hour window
  - GPU utilisation alert: > 80% sustained for 15 minutes
```

---

## 8. Security Architecture

### 8.1 Authentication Model

```
Three auth modes:

1. JWT (Bearer token)
   - Used by: Brand portal web app, consumer web app
   - Issued by: POST /auth/token
   - Expiry: 1 hour (access token) + 7 days (refresh token)
   - Algorithm: RS256 (asymmetric — API can verify without secret)
   - Claims: {sub: user_id, brand_id?, role, scopes[], iat, exp}
   - Storage: httpOnly cookie on web (not localStorage — XSS protection)

2. API Keys (X-API-Key header)
   - Used by: Manufacturers, PLM/ERP integrations, B2B partners
   - Format: lb_[role_prefix]_[48-char random base62]
     e.g., lb_brand_xK9mP...
   - Storage: SHA-256 hash in database, never stored in plaintext
   - Rate limits: enforced per-key in Redis
   - Scopes: granular (garments:read, try_on:write, etc.)

3. Session tokens (anonymous)
   - Used by: Consumer try-on without account (for MVP)
   - Format: session_[UUID]
   - Storage: Redis, 7-day TTL
   - Scopes: limited (try_on only, own avatar only)
```

### 8.2 Role-Based Access Control (RBAC)

| Role | Garments | Try-On | DPP | Production | Admin |
|---|---|---|---|---|---|
| **brand** | CRUD own brand | read | CRUD own | CRUD own | — |
| **manufacturer** | read (shared) | — | read | read/ack | — |
| **consumer** | read (active) | CRUD own | read | — | — |
| **admin** | CRUD all | all | all | all | full |
| **system** | CRUD all | all | all | all | full |

Row-level security enforced at PostgreSQL level using RLS policies:
```sql
-- Brands can only see their own garments
ALTER TABLE garments ENABLE ROW LEVEL SECURITY;
CREATE POLICY garments_brand_isolation ON garments
    USING (brand_id = current_setting('app.current_brand_id')::uuid
           OR current_setting('app.current_role') IN ('admin', 'system'));
```

### 8.3 EU Data Residency (DPP Compliance)

```
Data residency strategy:
  - EU consumer avatars: stored in europe-west1 (Belgium)
  - DPP records for EU garments: stored in europe-west1
  - Non-EU data: us-central1 (Iowa) by default

Implementation:
  - Single Cloud SQL instance with europe-west1 read replica
  - DPP records always written to EU replica first
  - GCS buckets: loocbooc-prod-eu (europe-west1), loocbooc-prod (us-central1)
  - API routes DPP writes to EU endpoint automatically based on
    garment's market[] containing EU countries

GDPR compliance:
  - Avatar scan data (raw): 30-day auto-delete (lifecycle rule on GCS)
  - Body measurements: user-deletable on request (soft delete + background scrub)
  - Right to erasure: DELETE /avatars/{id} triggers background job to
    remove measurements, mesh, and all associated try-on results

DPP audit trail:
  - dpp_records table never has rows deleted (compliance requirement)
  - Immutable event log via audit_logs table (append-only)
  - All DPP record changes logged with actor, timestamp, and old/new values
```

### 8.4 General Security Controls

```
Transport: TLS 1.3 minimum, HSTS enforced, HTTPS-only in production
WAF: Cloud Armor rules — OWASP Top 10, SQLi, XSS, rate limiting by IP
Input validation: Pydantic v2 on all inputs, strict type checking
File uploads: MIME type validation, virus scanning (Cloud DLP) before pipeline
Secrets: GCP Secret Manager for all credentials, no env var secrets in production
Audit logging: All write operations logged to audit_logs table
Dependency scanning: Snyk + Dependabot in CI pipeline
Container scanning: Cloud Build + Artifact Registry vulnerability scanning
Penetration testing: Quarterly from MVP+6 months
```

---

## 9. Scalability Plan

### 9.1 MVP: 100 Garments/Day

```
Architecture: Single Cloud Run service (API monolith)
  - 2 vCPU / 4GB RAM minimum instances
  - Min instances: 1 (no cold starts for brand portal)
  - Max instances: 10

Pipeline: 5 Cloud Run Job instances
  - Standard CPU instances: measurements_only, clo3d paths
  - GPU instances (Nvidia T4): photos, video, DXF paths
  - Estimated GPU cost: ~$0.45/garment average

Database: Cloud SQL PostgreSQL
  - db-standard-2 (2 vCPU, 7.5 GB) — sufficient for 100 garments/day
  - Automated backups, PITR enabled

Redis: Memorystore Basic M1 (1GB) — sufficient for queue + cache at MVP

Storage: Cloud Storage — standard class
  - Estimated: ~500MB per garment (all formats + source files)
  - 100 garments/day = 50GB/day = ~1.5TB/month
  - GCS lifecycle: source files to Nearline after 30 days, Coldline after 1 year

Estimated MVP monthly cost (100 garments/day):
  Cloud Run API: ~$50/month
  Cloud Run Jobs (GPU): ~$1,350/month
  Cloud SQL: ~$150/month
  Memorystore: ~$50/month
  Cloud Storage: ~$30/month
  Vertex AI (OCR + fit): ~$200/month
  CDN + networking: ~$50/month
  TOTAL: ~$1,880/month
```

### 9.2 Scale: 100,000 Garments/Day

```
What breaks first (in order):

1. Pipeline GPU capacity — first bottleneck
   FIX: Add GPU instance pool reservation, regional distribution,
        implement speculative execution (start 2 workers, take first result)
   COST: GPU reserved instances are 50% cheaper than on-demand

2. Cloud SQL write throughput (~500 garments/day per instance)
   FIX: Enable Cloud SQL read replicas for reporting queries.
        At 10,000+/day: consider partitioning garments table by brand_id.
        At 100,000/day: PgBouncer connection pooling (already in architecture),
        consider Spanner for garments table only (brand/garment lookups).

3. Redis Streams throughput (~50,000 ops/sec ceiling for Memorystore)
   FIX: Upgrade to Memorystore cluster mode (sharded).
        Alternatively: migrate pipeline queue to Cloud Pub/Sub at this scale.

4. GCS per-object rate limits (5,000 ops/sec per bucket prefix)
   FIX: Shard GCS keys by UGI prefix hash:
        gs://loocbooc-prod/{hash(ugi)[:2]}/garments/{ugi}/...
        This distributes load across 256 prefix buckets.

5. API monolith single-service limits
   FIX: Split the monolith along domain boundaries:
        - Garment service (highest write throughput)
        - Try-On service (stateless, scales independently)
        - Auth service (low throughput, high availability requirement)
        - Notification service (async, can be lossy)

At 100,000/day architecture:
  Cloud Run (multi-service): ~$2,000/month
  Cloud Run Jobs (GPU reserved): ~$45,000/month
  Cloud SQL (HA + read replicas): ~$800/month
  Memorystore cluster: ~$400/month
  Cloud Storage: ~$3,000/month
  Vertex AI: ~$5,000/month
  CDN + networking: ~$2,000/month
  TOTAL: ~$58,000/month ($0.58/garment processed)
```

---

## 10. The .lgmt Format Specification

`.lgmt` (Loocbooc Garment) is the proprietary binary format that is the canonical representation of a processed garment. It is the single file that contains everything needed to render and simulate a garment.

```
File structure:
  Header (64 bytes):
    Magic: 0x4C474D54 ("LGMT")
    Version: uint16 (current: 1)
    Flags: uint16 (has_physics, has_uv, has_grading)
    UGI: 64-byte null-terminated string
    Garment version: uint32
    Created timestamp: uint64 (Unix ms)
    Section count: uint32
    Reserved: 12 bytes

  Section table (variable):
    For each section:
      Type: uint32 (see section types)
      Offset: uint64 (from file start)
      Length: uint64

  Sections:
    MESH (0x01): Binary mesh (vertices, normals, UV, indices)
                 Format: compact float16 vertices, uint32 indices
    PHYS (0x02): Physics metadata JSON
                 {tensile_stiffness, drape_coefficient, mass_per_m2, ...}
    GRAD (0x03): Grading data for all sizes
                 {size_label: {scale_vectors[]}}
    MTRL (0x04): Material properties
                 {base_color, roughness, metalness, normal_map_ref}
    SEAM (0x05): Seam definitions (for re-simulation)
    META (0x06): Full garment metadata JSON (mirrors API response)
    THUM (0x07): Embedded thumbnail (512×512 WebP)

Total size estimate per garment: 2–15 MB depending on mesh complexity
```

---

*Document version 1.0. Update with every significant architectural change.*
*Next review: When MVP is operational or when first architectural constraint is hit.*

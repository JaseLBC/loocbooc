# Loocbooc — Architecture Decision Records (ADRs)
*These are the consequential choices. Each one is permanent until explicitly superseded.*
*Format: ADR-NNN | Date | Status*

---

## ADR-001: Monolith First, Domain-Partitioned

**Status:** Accepted — March 2026
**Decision:** Build Loocbooc as a well-structured monolith with internal domain boundaries, deployable as a single Cloud Run service, with the sole exception of the 3D pipeline which is isolated from day one.

**Context:**
The engineering team is small (< 10 engineers at MVP). The system has ~8 distinct domains (auth, garments, avatars, try-on, pipeline, physics, DPP, notifications). A microservices architecture at this stage would require a platform team before a product team, distributed tracing, service mesh, complex deployment pipelines — none of which produce a single shipped garment.

The counterargument is scale: "what happens when we need to scale try-on separately from garment management?" The answer is: we won't hit that problem before we have the team and revenue to address it properly. Premature distribution is more expensive than a strategic refactor.

**Options Considered:**
1. Full microservices from day one
2. Modular monolith (chosen)
3. Serverless functions (AWS Lambda / Cloud Functions)
4. BFF + multiple backends

**Rationale:**
- Monolith deploys in 1 CI step. Microservices require N CI pipelines, N deployment targets, service discovery.
- Shared database for a monolith means JOIN queries. Microservices require either data duplication or expensive API calls for cross-domain queries (e.g., try-on query needs garment + avatar + physics data simultaneously).
- The internal domain structure ensures the refactor to microservices is mechanical, not conceptual — each domain folder becomes a service with minimal changes.
- The 3D pipeline is the exception because it has fundamentally different infrastructure requirements (GPU, long-running, independent failure modes).

**Consequences:**
- Single deployment artifact simplifies CI/CD significantly.
- PostgreSQL connection pool is shared — must monitor connection usage as traffic grows.
- At ~1,000 concurrent API requests, we will need horizontal Pod scaling (Cloud Run handles this automatically).
- Team must enforce domain boundaries in code review. No cross-domain direct function calls — always go through domain interfaces.
- **The monolith split is a when, not an if.** First candidate to split: Try-On service (stateless, GPU-optional, scales independently). Second: Garment service (highest write throughput). Plan for this at Series A.

---

## ADR-002: Python 3.12 for the Entire Backend

**Status:** Accepted — March 2026
**Decision:** Use Python 3.12 as the single language for the API, pipeline, and physics engine. No polyglot backend.

**Context:**
The 3D pipeline and physics simulation are necessarily Python (Open3D, Trimesh, COLMAP Python bindings, NumPy, SciPy are all Python-native). The question is whether to also use Python for the API layer, or to use a "better" API language like Go or Node.js and accept a two-language backend.

**Options Considered:**
1. Python + FastAPI for everything (chosen)
2. Go for API, Python for pipeline (polyglot)
3. Node.js/TypeScript for API, Python for pipeline
4. Rust for performance-critical paths

**Rationale:**
- A single language means every backend engineer can work on every part of the system. A polyglot architecture at this team size creates specialization silos and bus-factor risk.
- FastAPI's async performance is sufficient for our use case. Benchmarks show 5,000–15,000 requests/second on a single Cloud Run instance — more than enough until significant scale.
- Python 3.12 is significantly faster than 3.11 (30%+ on some benchmarks) and has structural pattern matching that simplifies complex dispatch logic in the pipeline.
- The real performance bottleneck is never the API layer — it's always the database, the GCS call, or the pipeline. Switching to Go saves microseconds that are dwarfed by milliseconds of I/O.
- Pydantic v2 (Rust-backed) gives us schema validation performance comparable to Go.

**Consequences:**
- GIL is a constraint for CPU-bound work. Mitigated by: async I/O for network-bound operations, Cloud Run multi-instance for CPU-bound pipeline work, `multiprocessing` for physics simulation within pipeline workers.
- Python's memory footprint is higher than Go/Rust. Cloud Run instances need at least 4GB RAM for pipeline workers. Accepted cost.
- Type checking: `mypy` in strict mode enforced in CI. No `Any` types without explicit justification.

---

## ADR-003: PostgreSQL as the Primary Data Store (No NoSQL)

**Status:** Accepted — March 2026
**Decision:** PostgreSQL 16 on Cloud SQL is the single source of truth for all relational data. No MongoDB, DynamoDB, or Cassandra in the core data model.

**Context:**
Loocbooc needs to store garment data, brand data, DPP records, and try-on interactions. The data has relational structure (garment → brand, try-on → avatar + garment) but also flexible schema elements (tech pack specs vary by garment type, integration credentials vary by system).

DPP compliance adds a hard requirement: ACID transactions for audit trails. The garment's version history and DPP record must be provably consistent.

**Options Considered:**
1. PostgreSQL (chosen)
2. MongoDB — for flexible garment metadata
3. DynamoDB — for scale
4. CockroachDB — for distributed SQL
5. Supabase — managed Postgres with extras

**Rationale:**
- JSONB columns solve the flexible schema problem without sacrificing transactional integrity. `garments.metadata JSONB`, `garment_versions.spec_snapshot JSONB` — flexible where needed, structured where required.
- Row-level security in PostgreSQL enforces multi-tenant isolation at the database layer, providing a second line of defence beyond application-layer checks.
- `pg_trgm` for full-text search eliminates ElasticSearch until meaningful scale.
- PostGIS is available when we need geographic supply chain queries.
- Cloud SQL handles the operational overhead entirely — no DBA needed at MVP.
- DPP records are legally permanent. PostgreSQL's ACID guarantees and mature backup tooling make this a clear choice.

**Consequences:**
- Schema migrations require care at scale — use `pg_repack` for large table alterations, always test migrations on a clone first.
- JSONB queries are slower than normalized queries. Accept this for metadata fields; normalise only when a JSONB field is queried frequently with filters.
- At 10M+ garments, the `try_ons` table will grow very large. Partition by `created_at` (monthly). Design for this but don't implement until needed.

---

## ADR-004: Isolated 3D Pipeline with Async Queue

**Status:** Accepted — March 2026
**Decision:** The 3D reconstruction and physics simulation pipeline runs as isolated Cloud Run Jobs, triggered by a Redis Streams queue, completely decoupled from the API monolith.

**Context:**
The 3D pipeline is the highest-risk component of Loocbooc. It:
- Takes 2–10 minutes to process a single garment
- Requires GPU for photogrammetry paths
- Has significant failure modes (COLMAP divergence, physics sim NaN, out of memory)
- Consumes significant CPU and GPU resources

If this ran synchronously in the API, a single expensive garment upload would block an API thread for 10 minutes. If it ran as an async background task within the monolith, a pipeline crash could take down the API.

**Options Considered:**
1. Synchronous processing in API request (rejected — obviously wrong)
2. Background task within API monolith
3. Separate Cloud Run service (persistent, always-on)
4. Cloud Run Jobs triggered by queue (chosen)
5. Cloud Functions / Lambda
6. Kubernetes with GPU nodes

**Rationale:**
- Cloud Run Jobs scale to zero when idle (zero cost), and scale up for burst processing. At MVP (100 garments/day), the pipeline runs ~100 minutes of GPU time distributed through the day — paying for a persistent GPU instance 24/7 would waste 95% of compute spend.
- Redis Streams provides at-least-once delivery with consumer groups. If a job worker crashes mid-processing, the job returns to the queue and retries. The API is never aware of the crash.
- Complete isolation: a pipeline crash affects only that garment job. The API continues serving requests normally.
- Jobs can be independently monitored, scaled, and upgraded without touching the API.
- Cloud Run Jobs support GPU (Nvidia T4/A100) with the same deployment model as CPU jobs.

**Consequences:**
- Jobs are stateless — all state must be persisted to PostgreSQL and GCS before the job completes. Cannot use in-memory state across retry.
- The status polling model (`GET /garments/{ugi}/status`) is slightly worse UX than synchronous. Mitigated by WebSocket push notifications when processing completes.
- Dead letter queue (`pipeline:jobs:dead`) needs monitoring and operational runbook. Define SLA: reprocess or escalate within 2 hours.
- Cold start latency for Cloud Run Jobs: ~5–15s. Acceptable given 2–10 minute processing times.

---

## ADR-005: The .lgmt Proprietary Format

**Status:** Accepted — March 2026
**Decision:** Define a proprietary binary format (`.lgmt`) as the canonical garment file, in addition to exporting standard formats (GLB, USDZ).

**Context:**
Loocbooc needs a canonical representation that includes everything about a processed garment: mesh geometry, physics metadata, grading data for all sizes, material properties, and embedded metadata. No existing format supports all of these simultaneously.

GLB (gLTF 2.0) supports mesh + materials but not garment-specific physics or grading. USDZ is iOS-specific. CLO3D's `.zprj` is proprietary and not readable without CLO3D software. USD is verbose and complex.

**Options Considered:**
1. GLB with custom extensions (`KHR_materials_xxx`)
2. USD / USDZ
3. Custom binary format (`.lgmt`) — chosen
4. ZIP bundle of existing formats (`.lgmt` as zip)

**Rationale:**
- Custom binary allows optimal encoding for our specific data layout. The mesh, physics, and grading data are tightly coupled — a custom format can encode them with zero redundancy.
- GLB custom extensions have limited tooling support and the extensions would need to be maintained.
- The `.lgmt` format is the format that makes Loocbooc's data sticky. Third-party tools that want to render Loocbooc garments need the Loocbooc SDK. This is a moat.
- We still export GLB and USDZ for compatibility — `.lgmt` is the source of truth, the others are derived.
- The format is versioned (current: v1). Future versions can add sections without breaking readers that ignore unknown section types.

**Consequences:**
- We must maintain a reference parser in Python (for the pipeline), TypeScript (for the web SDK), and Swift/Kotlin (for the mobile SDK). Three parser implementations is maintenance overhead.
- Third-party developers need our SDK to use `.lgmt` files. This is intentional but must be balanced with developer-friendliness (open spec, clear docs).
- Storage: `.lgmt` is ~2–15MB per garment. At 1M garments, this is 2–15TB of storage — significant but manageable.

---

## ADR-006: React Native + iOS-Native Modules (Not Fully Web-Based)

**Status:** Accepted — March 2026
**Decision:** The Loocbooc mobile app is React Native with iOS-native modules for ARKit and Vision framework. Not a PWA. Not Expo without custom native code. Not Flutter.

**Context:**
The body scanning feature requires:
1. LiDAR depth sensor access (iPhone Pro)
2. ARKit body tracking (skeletal joint estimation)
3. iOS Vision framework (body segmentation, pose estimation)
4. Real-time point cloud streaming

All of these require native iOS APIs. Web APIs (WebXR, MediaDevices) do not expose these interfaces on iOS.

**Options Considered:**
1. Progressive Web App (PWA) — no native sensor access
2. React Native + native modules (chosen)
3. Flutter + native platform channels
4. Swift native app (no React)
5. Capacitor/Cordova + native plugins

**Rationale:**
- React Native shares component logic and TypeScript types with the web frontend (Next.js). Maximum code reuse for a small team.
- Native module bridge gives us full ARKit and Vision framework access without compromise. The `react-native-vision-camera` ecosystem and custom Swift modules cover everything we need.
- Flutter would give similar native access but requires Dart, splitting the team's language stack (Python + TypeScript + Dart = too many languages).
- A fully Swift native app would be the best iOS experience but eliminates code sharing with the web codebase entirely.
- The scanning module is ~20% of the app. 80% is product browsing, try-on viewer, wardrobe — this is React Native territory where sharing with web makes sense.

**Consequences:**
- iOS first. Android body scanning is not supported at MVP. Android users can use manual measurement entry.
- React Native bridge calls have ~1ms overhead. For the scan session (30s of data collection), all heavy computation runs on-device via native modules — React Native is only the UI shell.
- App Store submission requires Apple review. Build additional lead time into release schedule.
- React Native's architecture is diverging (Fabric, JSI, Hermes). Stay on the new architecture from day one to avoid a migration later.

---

## ADR-007: Redis Streams for Pipeline Queue (Not Kafka, Not Cloud Pub/Sub)

**Status:** Accepted — March 2026
**Decision:** Use Redis 7 Streams (via Cloud Memorystore) for the 3D pipeline job queue at MVP.

**Context:**
The pipeline queue needs: reliable delivery (at-least-once), consumer group semantics (multiple workers, each job processed once), dead letter support, and message TTL. We also use Redis for caching and rate limiting.

**Options Considered:**
1. Redis Streams (chosen)
2. Apache Kafka
3. GCP Cloud Pub/Sub
4. RabbitMQ
5. Cloud Tasks

**Rationale:**
- Redis is already in the architecture for caching and rate limiting. Using Redis Streams means one fewer managed service, one fewer operational concern, one fewer billing line item.
- Redis Streams support consumer groups with XACK semantics — exactly what we need for at-least-once pipeline delivery.
- At MVP throughput (100 jobs/day), Redis Streams is massively overprovisioned. The 1GB Memorystore instance can handle millions of queue operations per second.
- Kafka is the right choice at high throughput (millions of messages/day) but requires a Kafka cluster or managed Kafka (Confluent/MSK) — overkill and expensive at MVP.
- Cloud Pub/Sub is excellent but doesn't serve double duty as cache + rate limiter. Adding it would mean Redis is still in the architecture anyway.

**Consequences:**
- Redis is a single point of failure for both the queue AND the cache. **Mitigation:** Cloud Memorystore with high-availability mode (replica). At MVP, brief Redis downtime means queued jobs wait, not lost — pipeline workers retry on reconnect.
- Redis Streams don't have long-term retention like Kafka. Jobs older than 7 days are expired. This is fine — garments in `PROCESSING` for > 24 hours trigger an alert and re-enqueue.
- Migration path to Cloud Pub/Sub at scale is documented and straightforward — the queue interface is abstracted behind `QueueService` in the codebase.

---

## ADR-008: GCS Presigned URLs for File Upload (Direct to Storage)

**Status:** Accepted — March 2026
**Decision:** File uploads from clients (brands, mobile scanners) go directly to Google Cloud Storage using presigned URLs. Files never pass through the API server.

**Context:**
Garment processing involves large files: video scans (100–500MB), photo sets (10–60MB), pattern archives (1–20MB). If these passed through the API server, we'd need high-bandwidth Cloud Run instances, pay for egress twice (client → API → GCS), and deal with request timeouts for large uploads.

**Options Considered:**
1. Direct upload via API server
2. GCS presigned URLs (chosen)
3. Resumable uploads (TUS protocol) via API
4. FTP/SFTP for enterprise brands

**Rationale:**
- Presigned URLs transfer files directly between the client and GCS. The API server issues the URLs and is then uninvolved in the transfer.
- Client-to-GCS is free (no GCP egress charge for inbound to GCS). Client → API → GCS would incur egress on the Cloud Run side.
- GCS handles large file reliability better than API servers — automatic resumable upload support for files > 5MB.
- Security: presigned URLs are time-limited (1 hour), scoped to specific GCS paths, and single-use in intent (the API validates the upload completed before proceeding).

**Consequences:**
- CORS must be configured on the GCS bucket to allow browser direct upload.
- The API must poll or use GCS Object Notifications (via Cloud Pub/Sub) to detect when an upload completes, rather than having the upload land in the API's request handler.
- Mobile scanning uploads (LiDAR point clouds) are large and on cellular — implement upload resumability via GCS resumable upload protocol in the mobile SDK.
- Virus scanning: files are scanned by Cloud DLP after upload, before the pipeline is triggered. The pipeline will not start until the file is marked clean.

---

## ADR-009: EU Data Residency for DPP Compliance (Not Application-Layer Encryption Only)

**Status:** Accepted — March 2026
**Decision:** EU garment data and DPP records are physically stored in GCP's `europe-west1` (Belgium) region. This is architectural, not just an encryption choice.

**Context:**
The EU Digital Product Passport regulation (2027–2030 textile enforcement) requires garment traceability data to be stored and processed within the EU. This is not just about encryption — it's about physical data location under GDPR/EU sovereignty.

**Options Considered:**
1. Application-layer encryption only (rejected — not sufficient for data sovereignty)
2. Separate EU Cloud SQL instance + EU GCS buckets (chosen)
3. Full geo-replication with EU primary
4. Single global instance with encryption

**Rationale:**
- EU regulatory requirements are about physical data location. An encrypted database in the US does not satisfy EU data sovereignty rules.
- The implementation adds complexity: EU Cloud SQL read replica, EU GCS bucket, routing logic in the API. This complexity is justified by the regulatory requirement and the commercial advantage ("DPP compliant from day one" is a sales message).
- Implementing this at MVP is cheaper than retrofitting it later. Database migrations for data sovereignty are painful and risky.
- The EU is the most regulated fashion market in the world. EU compliance unlocks the EU market. The architectural cost is worth the commercial access.

**Consequences:**
- API must inspect the garment's `markets` array and route DPP writes to the EU endpoint if EU markets are included.
- Two Cloud SQL instances to manage (us-central1 + europe-west1). At MVP, the EU instance is primarily a read replica; DPP writes go to EU primary.
- Latency from non-EU regions to the EU instance is 100–200ms. Acceptable for DPP record writes (async, non-critical path).
- Cost: additional ~$150/month for the EU read replica. Acceptable.

---

## ADR-010: COLMAP for Photogrammetry (Not Neural NeRF/3DGS)

**Status:** Accepted — March 2026
**Decision:** Use COLMAP for Structure-from-Motion 3D reconstruction of garments from photos/video. Do not use Neural Radiance Fields (NeRF) or 3D Gaussian Splatting.

**Context:**
The 3D reconstruction field moved dramatically in 2022–2024 with NeRF (Neural Radiance Fields) and 3DGS (3D Gaussian Splatting). These produce photorealistic 3D representations but as radiance fields, not traditional meshes.

Loocbooc needs a **mesh** output (for physics simulation, for GLB/USDZ export, for try-on collision detection). NeRF/3DGS produce implicit representations that are difficult to convert to clean meshes.

**Options Considered:**
1. COLMAP + Open3D (chosen)
2. Instant-NGP (NeRF — NVIDIA)
3. 3D Gaussian Splatting
4. Photogrammetry SaaS (RealityCapture, Metashape)
5. Depth estimation (MiDaS/ZoeDepth) + point cloud
6. Category-specific shape priors (SMPL-equivalent for garments)

**Rationale:**
- COLMAP outputs a dense point cloud that Open3D converts to a clean mesh. The pipeline from COLMAP → mesh is well-understood, robust, and controllable.
- NeRF/3DGS produce beautiful renderings but the mesh extraction step (marching cubes on density field) produces low-quality geometry with holes and noise — worse than COLMAP for our use case.
- Commercial SaaS (RealityCapture) would add cost per reconstruction and dependency on a third-party service. We lose control and data portability.
- Depth estimation (MiDaS) is single-image, not multi-view — less accurate for 3D reconstruction.
- Shape priors (CLO3D-style template fitting) are the best approach for the pattern input path — we use this for `dxf_patterns` and `measurements_only`. For photo/video input, COLMAP is better because we have actual geometry data.

**Consequences:**
- COLMAP struggles with textureless surfaces (solid-colour fabrics). This is documented as a known limitation. Mitigation: depth fusion with LiDAR (iPhone Pro path), and physics-based mesh regularisation for textureless cases.
- COLMAP is compute-intensive. GPU acceleration is required for reasonable processing times on the video path.
- As garment-specific 3D reconstruction models mature (2026–2028), consider replacing the COLMAP path with a fine-tuned model trained on Loocbooc's own garment dataset. The architecture supports this — the ingestion step is abstracted.

---

## ADR-011: TypeScript Strict Mode for All Frontend Code

**Status:** Accepted — March 2026
**Decision:** TypeScript strict mode (`strict: true`, `noUncheckedIndexedAccess: true`) is enforced across the web frontend, mobile app, and shared types package. No `any` types without documented exceptions.

**Context:**
The shared types package (`shared/types.ts`) is the contract between the API (Python + Pydantic) and the frontend (TypeScript). If this contract drifts, bugs happen in production. The try-on and fit score data structures are especially sensitive — a type mismatch here produces incorrect fit recommendations to consumers.

**Options Considered:**
1. TypeScript strict mode (chosen)
2. TypeScript without strict mode
3. JavaScript with JSDoc
4. Auto-generated types from OpenAPI spec

**Rationale:**
- Strict mode catches null pointer errors, unsafe indexing, and implicit any at compile time rather than runtime. The upfront investment in typing is paid back within the first production bug that doesn't happen.
- Auto-generated types from OpenAPI are an option but create a generation step in CI. We prefer hand-written types in `shared/types.ts` that are the source of truth, with OpenAPI schema validated against them in CI tests.
- `noUncheckedIndexedAccess` is particularly valuable for arrays from the API — forces explicit null checking before accessing array elements.

**Consequences:**
- Initial type setup takes longer. Worth it.
- When the Python Pydantic schemas change, the TypeScript types in `shared/types.ts` must be updated manually. This is a process requirement, not a technical one — add a step to the API change checklist.
- External packages that aren't well-typed require `@types/` packages or declaration files.

---

## ADR-012: Garment UGI is Immutable After Issuance

**Status:** Accepted — March 2026
**Decision:** Once a UGI is issued and a garment enters `ACTIVE` status, the UGI string is permanently immutable. The brand code, category, and identifier components cannot be changed.

**Context:**
The UGI is Loocbooc's core data primitive. It will be:
- Printed on hangtags and care labels
- Stored in retailer systems
- Referenced in consumer purchase records
- Used as the DPP passport identifier
- Embedded in QR codes sewn into physical garments

If a UGI can change, every downstream system that stored it becomes inconsistent. The DPP audit trail is broken. Physical garments have the wrong code.

**Options Considered:**
1. Immutable UGI with versioned model (chosen)
2. Mutable UGI with redirect table
3. Separate "public ID" from internal UUID

**Rationale:**
- Immutability is the correct design for identifiers that escape the system boundary. Once a UGI is on a physical garment, it is permanent by definition.
- Changes to the garment (pattern updates, fabric changes) are expressed as version increments. The UGI remains constant; the version component (`001` → `002`) changes.
- The internal `garment.id` UUID is our internal primary key. The UGI is the external identifier. These are separate concerns. The UUID can never leave the system in any context where immutability matters.

**Consequences:**
- If a brand registers with the wrong brand code (e.g., typo), the garments created under that code cannot be renumbered. **Mitigation:** Brand codes are validated at registration with a preview of how the UGI will look. Require explicit confirmation.
- If a garment was created in the wrong category, the category code in the UGI cannot be corrected after ACTIVE status. The garment metadata can be updated; the UGI cannot. This is a cosmetic issue, not a functional one — the system treats UGI as an opaque identifier, the category in the code is informational only.

---

*ADRs are permanent records. Superseded decisions are marked with a reference to the superseding ADR, never deleted.*
*Proposed ADRs go through code review before being marked Accepted.*

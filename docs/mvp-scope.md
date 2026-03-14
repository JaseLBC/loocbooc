# Loocbooc — MVP Scope
*The line between what we build first and what we don't touch yet.*
*Date: March 2026 | Review at: MVP operational (estimated June 2026)*

---

## The Single Most Critical Thing to Get Right

**The 3D pipeline for DXF cut patterns.**

Here's why: The pattern input path is the highest-quality, lowest-effort onboarding for serious fashion brands. It produces mathematically accurate 3D models. It demonstrates the core technical differentiation. It enables the physics simulation that makes try-on actually work.

If the pipeline is unreliable, slow, or produces ugly output — nothing else matters. Brands won't pay. Investors won't believe. The whole story falls apart.

The photo and video paths can be added after launch. The CLO3D path can be added after launch. But the DXF pattern path must be excellent at launch. It is the technical proof.

---

## Features IN Scope for MVP

### Core Platform

**✅ Garment UUID (UGI) System**
- Full UGI generation with brand code, category, timestamp, checksum
- Collision detection and retry
- QR code generation for each UGI
- UGI public resolution endpoint (DPP page)

**✅ Brand Onboarding**
- Brand registration (name, brand code, country, email)
- Brand portal web UI (Next.js)
- API key creation and management
- Webhook configuration

**✅ Garment Management (Web Portal)**
- Create garment with UGI
- Upload flow: DXF patterns (primary), photos_12 (secondary), CLO3D files (tertiary)
- Care label OCR → automatic fabric composition extraction
- Manual fabric composition entry (fallback if OCR fails)
- Processing status tracking (poll + WebSocket push)
- Garment list, search by name, filter by status/category
- Garment detail page: 3D model viewer (Three.js GLB), metadata
- Version history
- Soft delete

**✅ 3D Pipeline**
- DXF pattern path: full pipeline (ingestion → 3D reconstruction → physics → GLB/USDZ/lgmt)
- Photos path (12 photos): full pipeline
- CLO3D / Marvelous Designer path: full pipeline
- Measurements-only path: template deformation pipeline (lowest quality, for fast onboarding)
- Async queue via Redis Streams
- Cloud Run Jobs (CPU + GPU instances)
- Failure handling: 3 retries, dead letter, brand notification on failure
- Processing status: real-time via WebSocket

**✅ Fabric Physics**
- Care label OCR (Cloud Vision API)
- Fabric composition → physics parameter lookup
- Seed database: top 50 fabric compositions (covers ~80% of garments)
- Physics feedback loop: consumer fit ratings update physics confidence score

**✅ Avatar Creation (Web, Measurements Only)**
- Manual measurement entry (no scan at MVP)
- Avatar stored with measurements
- Per-brand size recommendations derived from measurements

**✅ Avatar Creation (Mobile iOS, LiDAR Scan)**
- iOS app: body scan using ARKit + LiDAR (iPhone 12 Pro+)
- Point cloud upload to API
- Avatar mesh generation (server-side Open3D processing)
- Body measurement extraction from scan
- Fallback to manual entry if scan quality too low

**✅ Try-On**
- Request try-on: avatar + UGI + size
- Physics-based cloth simulation (server-side)
- Result: GLB file for Three.js viewer, USDZ for iOS AR Quick Look
- Fit score (0–100) with zone breakdown and fit verdict
- Size recommendation
- Result caching (Redis, 24h TTL)
- Cache invalidation on garment version update
- Consumer feedback submission (post-wear rating)

**✅ Manufacturer Portal**
- Manufacturer registration (API key, not full account)
- Manufacturer views garments shared with them (by brand)
- Real-time update notification via WebSocket when brand updates garment
- Tech pack download (PDF) from garment version
- Acknowledgment action (manufacturer confirms receipt of update)
- Change diff view (what changed between versions)

**✅ DPP (Digital Product Passport)**
- Create DPP record for a garment
- EU compliance checker (identifies missing required fields)
- Public DPP endpoint (no auth required — for physical QR code scan)
- Data stored in EU region (europe-west1) for EU-market garments
- EU compliant flag on garment

**✅ Auth**
- Email + password auth (JWT)
- API key auth (brands + manufacturers)
- Session tokens (anonymous consumer try-on)
- Role-based access (brand, manufacturer, consumer)
- API key scopes

**✅ Infrastructure**
- GCP Cloud Run (API monolith)
- GCP Cloud Run Jobs (pipeline)
- GCP Cloud SQL PostgreSQL 16
- GCP Memorystore Redis 7
- GCP Cloud Storage
- GCP Cloud Vision API (OCR)
- GCP Cloud CDN (static assets + model files)
- GCP Cloud Armor (WAF)
- Docker + GitHub Actions CI/CD
- Environment: dev, staging, production

---

## Features OUT of Scope for MVP

### Explicitly Deferred

**❌ Full Consumer Accounts**
Reason: Consumer sign-up, profiles, and wardrobe features require significant UX investment. At MVP, consumers use session-based try-on (anonymous). Full consumer accounts are Phase 2.
Unblocked by: MVP consumer session model.

**❌ Wardrobe / Digital Closet**
Reason: Requires consumer accounts + extensive UI work. Not needed to prove the core B2B value proposition.
Phase: 2.

**❌ Styling Recommendations / AI Styling**
Reason: Requires sufficient data volume (10K+ garments) and consumer preference data. The algorithm can't work at MVP scale.
Phase: 3.

**❌ Marketplace / Global Drops**
Reason: Platform economics, payment processing, brand-consumer transaction layer — significant product and legal work.
Phase: 3+.

**❌ Stylist Ecosystem / Consultant Portal**
Reason: Requires consumer accounts, wardrobe, and a marketplace. Foundation isn't there yet.
Phase: 3.

**❌ Android Mobile App**
Reason: ARKit body tracking quality significantly exceeds ARCore on Android for our use case. Android depth sensors are inconsistent across OEMs. iOS-first is the right call.
Phase: 2 (React Native code reuse means Android is a module swap, not a rewrite).

**❌ PLM / ERP Direct Integration**
Reason: Gerber AccuMark, Lectra Modaris, Centric PLM — each integration requires partnership agreements and testing access. These are medium-term enterprise sales features.
Phase: 2 (Gerber/Lectra), Phase 3 (full PLM suite).
At MVP: brands export files from their PLM and upload manually.

**❌ Physical Sample Replacement Workflow**
Reason: The comparison tool (3D approval vs physical sample) requires a structured review workflow that is a product build in itself.
Phase: 2.

**❌ Resale / Secondhand Tracking**
Reason: Requires consumer accounts and resale platform partnerships.
Phase: 3.

**❌ Recycling / End-of-Life Tracking**
Reason: DPP structure supports it (fields are in the schema) but the actual recycler portal and lifecycle event tracking is post-MVP.
Phase: 3.

**❌ Multi-brand Retailer Portal**
Reason: Retailers as first-class users (filtering inventory across multiple brands) is a different product surface. At MVP, brands drive adoption.
Phase: 2.

**❌ Consumer-facing Brand Discovery**
Reason: Without enough brand inventory (need 50+ active brands), a discovery UI is empty and useless.
Phase: 2 (when brand count justifies it).

**❌ Video Try-On / Real-Time AR**
Reason: Frame-by-frame real-time cloth simulation at 30fps is a significant technical challenge. Static try-on snapshot is sufficient for MVP.
Phase: 3.

**❌ Demand Validation for Emerging Designers**
Reason: Requires consumer accounts, social features, and pre-order mechanics.
Phase: 3.

**❌ Carbon Footprint Calculation**
Reason: Requires verified data from manufacturing chain. DPP supports storing it; calculating it accurately requires supply chain partnerships.
Phase: 2 (estimate tool), Phase 3 (verified).

---

## Success Metrics for MVP

### Launch Definition
MVP is operational when **Charcoal Clothing** (first brand) has:
- Minimum 50 garments with ACTIVE status (fully processed 3D models)
- At least 1 manufacturer connected and receiving real-time updates
- Try-on functional for all 50 garments with measurable fit scores
- DPP records created for EU-market garments

### 90-Day Post-Launch Targets (end of Month 3 after launch)

| Metric | Target |
|---|---|
| Brands onboarded | 10 active brands |
| Garments with ACTIVE status | 500 |
| Total UGIs issued | 500 |
| Pipeline success rate | ≥ 95% (of submitted garments reach ACTIVE) |
| Pipeline 95th-percentile processing time | ≤ 10 min per garment |
| Try-on requests | 2,000+ |
| Try-on cache hit rate | ≥ 40% (indicates real consumer reuse) |
| API uptime | 99.9% |
| Consumer fit feedback collected | 200+ ratings |
| Manufacturer portal active users | 5+ manufacturers |

### 6-Month Targets (proof-of-scale milestone for funding)

| Metric | Target |
|---|---|
| Brands onboarded | 50 |
| Total UGIs issued | 5,000 |
| Try-on requests | 50,000 |
| Platform uptime | 99.9% |
| Processing cost per garment | ≤ $0.80 |
| Net Promoter Score (brands) | ≥ 50 |
| DPP records created | 1,000+ |
| Funding status | Secured |

---

## Build Sequence — What Unblocks What

This is the order things must be built. Dependencies are hard constraints.

```
Week 1–2: Foundation (everything depends on this)
────────────────────────────────────────────────
[1] Database schema migrations (all tables)
[2] Auth system (JWT + API keys) — blocks everything that needs auth
[3] Brand CRUD + API keys — blocks brand portal
[4] UGI generation system — blocks garment creation
[5] GCS bucket setup + presigned URL generation — blocks file uploads
[6] Basic CI/CD pipeline (GitHub Actions → Cloud Run) — blocks all deployment

Week 3–4: Garment Core
────────────────────────────────────────────────
[7] Garment CRUD API endpoints (depends: 1,2,3,4,5)
[8] File upload flow with presigned URLs (depends: 5,7)
[9] Redis Streams queue setup (depends: 6)
[10] Pipeline worker skeleton — queue consumer, GCS reader, status updates (depends: 9)
[11] Care label OCR endpoint (Cloud Vision API) (depends: 2,5)

Week 5–6: 3D Pipeline — Measurements Path
────────────────────────────────────────────────
[12] Fabric physics database seeding (50 compositions) (depends: 1)
[13] Measurements-only pipeline path (Trimesh template deformation) (depends: 10,12)
    → First end-to-end test: submit garment → get GLB back
[14] Pipeline status updates via WebSocket (depends: 10,9)
[15] Brand portal: garment create + upload + status tracking (depends: 7,8,13,14)
    → Charcoal can submit first test garment

Week 7–8: 3D Pipeline — DXF Pattern Path (CRITICAL)
────────────────────────────────────────────────
[16] DXF parser (ezdxf) + pattern piece classifier (depends: 10)
[17] Pattern-to-3D reconstruction (Trimesh, seam joining) (depends: 16)
[18] Physics simulation (ARCSim-inspired cloth sim) (depends: 12,17)
[19] GLB + USDZ + .lgmt output generation (depends: 17,18)
[20] Three.js garment viewer in brand portal (depends: 15,19)
    → First DXF → 3D → viewer demo

Week 9–10: Avatar + Try-On (Core Consumer Feature)
────────────────────────────────────────────────
[21] Avatar CRUD + manual measurements API (depends: 1,2)
[22] Try-on job queue + worker skeleton (depends: 9,10,21)
[23] Cloth simulation for try-on (garment over avatar body) (depends: 18,22)
[24] Fit score calculation (depends: 23)
[25] Try-on result caching (Redis) (depends: 22,24)
[26] Consumer try-on UI (Three.js viewer + fit score display) (depends: 25)
    → End-to-end: consumer can try on a Charcoal garment

Week 11–12: Manufacturer Portal + DPP
────────────────────────────────────────────────
[27] Manufacturer API key + role (depends: 2)
[28] Garment share with manufacturer (production records) (depends: 1,7,27)
[29] Manufacturer portal: garment list, tech pack download (depends: 28)
[30] Real-time WebSocket: manufacturer receives update notifications (depends: 14,28)
[31] Manufacturer acknowledgment flow (depends: 29,30)
[32] DPP record CRUD + EU compliance checker (depends: 1,7)
[33] Public DPP endpoint + QR code generation (depends: 32)

Week 13–14: Photo Pipeline + Polish
────────────────────────────────────────────────
[34] Photos (12-photo) pipeline path — COLMAP + Open3D (depends: 10)
[35] Mobile iOS app: avatar body scan with ARKit (depends: 21)
    → Native module: LiDAR + ARKit body tracking → point cloud
[36] Avatar scan upload + server-side processing (depends: 35)
[37] Error handling polish: all pipeline failure modes + brand notifications
[38] Performance optimisation: try-on cache hit rate, pipeline queue monitoring

Week 15–16: Launch Preparation
────────────────────────────────────────────────
[39] Security review: penetration test basics, RBAC audit
[40] Load test: simulate 100 garments/day sustained + 10x burst
[41] Monitoring: Cloud Monitoring dashboards, alerting on SLA metrics
[42] Charcoal onboarding: full catalogue digitisation (50+ garments)
[43] Documentation: API docs, brand onboarding guide
[44] Launch
```

---

## Timeline

| Milestone | Date | Gate Condition |
|---|---|---|
| Foundation complete | Week 2 | Auth + schema + CI/CD working |
| First garment processed end-to-end | Week 6 | Measurements-only path produces a GLB |
| First DXF garment processed | Week 8 | Pattern path produces accurate GLB |
| First consumer try-on working | Week 10 | Try-on + fit score returned |
| Manufacturer portal functional | Week 12 | Manufacturer sees real-time update |
| Charcoal Clothing fully onboarded | Week 15 | 50+ garments ACTIVE, manufacturer connected |
| **MVP Live** | **Week 16** | All MVP features operational |
| 10 brands onboarded | Week 20 | Pipeline handles concurrent load |
| 500 garments issued | Week 24 | Quality metrics tracked |
| Funding secured | Month 5–6 | Metrics + demo ready |

**Assumptions:**
- 4-6 engineers (2 backend/pipeline, 1 frontend, 1 mobile, 1 full-stack, 1 DevOps/infra)
- CTO / Technical Co-Founder in place by Week 2
- Charcoal Clothing provides DXF pattern files for testing from Week 4
- No pivot to fundamentally different architecture mid-build

**Risks to timeline:**
- COLMAP photogrammetry quality on textureless fabrics (Week 13) — mitigated by LiDAR path and physics regularisation, but may require additional iteration
- ARKit body tracking accuracy for avatar measurements — may need manual correction flow if scan quality is low
- Cloud Run GPU availability in target regions — reserve instances before Week 7
- DXF file format variance across pattern-making software — test against Gerber AccuMark exports specifically (Charcoal's software)

---

## The One Thing That Must Not Happen

Someone else ships a functioning garment UUID + virtual try-on + DPP-compliant system before Loocbooc reaches 10 active brands and demonstrable data.

The window is real. The urgency is real. Every week of delay is a week the competitor who doesn't exist yet gets closer to existing.

Speed is a quality. Ship fast. Ship correct on the things that matter. Defer everything else.

---

*Review this document at MVP launch. Update scope based on what was learned.*
*The order of Phase 2 features is decided at MVP launch based on what brands and consumers are asking for.*

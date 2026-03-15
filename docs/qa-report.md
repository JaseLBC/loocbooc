# QA Report — March 2026

**Auditor:** Automated QA Review (subagent)  
**Date:** 2026-03-15  
**Scope:** Full codebase audit — `packages/api`, `packages/pipeline`, `packages/web`, `shared/types.ts`  
**Status:** 8 bugs fixed in this review. 7 issues require architectural decisions.

---

## Critical Issues (blocking launch)

### C-1 — Frontend sends API key as Bearer token instead of X-API-Key header
**File:** `packages/web/lib/api.ts` — `request()` function  
**Severity:** CRITICAL — ALL authenticated web requests fail silently, falling back to mock data  
**Root cause:** The `request()` helper was setting `Authorization: Bearer ${auth.apiKey}` but the API's `verify_api_key()` middleware only reads from the `X-API-Key` header. JWT Bearer would fail the `startswith("lb_live_")` check, and `X-API-Key` would be empty.  
**Fixed:** Changed to `headers['X-API-Key'] = auth.apiKey`. Also removed `X-Brand-ID` header (API derives brand from the key itself).

### C-2 — File upload sends all files in one request; API accepts one file per request
**File:** `packages/web/lib/api.ts` — `uploadFiles()`  
**Severity:** CRITICAL — Multi-file uploads would fail or silently discard all but the first file  
**Root cause:** Frontend used `formData.append('files', file)` (plural key, multiple files) but API expects a single `file` field per request. Also used incorrect Bearer auth header.  
**Fixed:** Now loops over files and sends one at a time with `formData.append('file', file)`, using the corrected `X-API-Key` header.

### C-3 — All garment API paths missing `/api/v1` prefix
**File:** `packages/web/lib/api.ts`  
**Severity:** CRITICAL — All garment/scan/fabric API calls hit wrong URLs (404 from the server)  
**Root cause:** Manufacturer API calls already had `/api/v1` in path, but garment/scan/fabric calls did not (inconsistency between different agents' work).  
**Fixed:** Added `/api/v1` prefix to all `api.garments.*`, `api.scan.*`, `api.fabrics.*`, `api.brand.*` paths.

### C-4 — CORS wildcard origin with `allow_credentials=True` breaks browser auth
**File:** `packages/api/app/main.py`  
**Severity:** CRITICAL — In `DEBUG=True` mode, CORS was set to `allow_origins=["*"]` + `allow_credentials=True`. The CORS spec prohibits this combination; modern browsers will reject all credentialed cross-origin requests.  
**Fixed:** Replaced wildcard with explicit localhost origins for development mode. Production mode already had correct specific domains.

### C-5 — `GarmentListResponse` field mismatch between API and frontend
**File:** `packages/web/types/index.ts`  
**Severity:** CRITICAL — Garment list page would render no results; pagination broken  
**Root cause:** API schema (`GarmentListResponse`) returns `items`, `page_size`, `has_next` but the web type defined `garments`, `limit`, with no `has_next`. Different agents designed these independently.  
**Fixed:** Aligned `web/types/index.ts` and the mock data in `lib/api.ts` to use `items`, `page_size`, `has_next`.

---

## High Priority Issues (fix before first user)

### H-1 — `GarmentCategory` values plural (API) vs. singular (frontend/shared)
**Files:** `packages/api/app/models/garment.py`, `shared/types.ts`, `packages/web/types/index.ts`  
**Severity:** HIGH — Any create/filter/display involving categories would fail with 422 errors or show wrong values  
**Root cause:** API model used plural values (`"tops"`, `"bottoms"`) while `web/types/index.ts` used singular (`"top"`, `"bottom"`). `shared/types.ts` also used singular.  
**Fixed:**
- Aligned `shared/types.ts` GarmentCategory enum to plural values matching the API model
- Updated `web/types/index.ts` GarmentCategory to plural values
- Updated `GarmentUploadWizard.tsx` CATEGORIES array to use plural keys
- Updated mock data in `api.ts` to use plural values
- Added `SUITS = "suits"` to the API model (was in web types but not API)

### H-2 — `GarmentStatus` enum missing states
**Files:** `packages/api/app/models/garment.py`, `shared/types.ts`  
**Severity:** HIGH — Pipeline and UI would error when trying to set/display `error`, `updating`, or `deleted` status  
**Root cause:** API model only had 4 states (draft, processing, active, archived). `shared/types.ts` defined 7 (including error, updating, deleted). Different agents used different references.  
**Fixed:** Added `UPDATING`, `ERROR`, `DELETED` to `GarmentStatus` enum in `app/models/garment.py`. Note: a DB migration is required to apply these to the PostgreSQL enum type.

### H-3 — `SECRET_KEY` uses insecure default with no production warning
**File:** `packages/api/app/config.py`  
**Severity:** HIGH — Weak JWT secret in production would allow any attacker to forge valid tokens  
**Fixed:** Added `@field_validator("SECRET_KEY")` that warns on any weak default key and raises a `ValueError` if shorter than 16 chars. Still needs an explicit `ValueError` in production/staging environments (see H-3a below).

### H-3a — Should error (not just warn) on default SECRET_KEY in production _(requires architectural decision)_
**File:** `packages/api/app/config.py`  
**Severity:** HIGH  
**Issue:** Currently a warning is emitted when the default key is used. In `ENVIRONMENT=production` or `staging`, this should be a hard error at startup. Needs decision on whether to use the `ENVIRONMENT` field in the validator (currently an `info` parameter is available but the approach needs agreement).  
**Recommendation:** Add environment-aware check: if `info.data.get('ENVIRONMENT') in ('production', 'staging')` and key is the default, raise `ValueError("SECRET_KEY must be changed in production")`.

### H-4 — `test_uuid.py` base-36 assertion wrong (test was always failing)
**File:** `packages/api/tests/test_uuid.py` — `TestBase36Conversion.test_to_base36_known_values`  
**Severity:** HIGH (test failure masks real bugs)  
**Root cause:** `_to_base36(35, width=8)` produces `"0000000Z"` (8 chars) but test asserted `"000000Z"` (7 chars).  
**Fixed:** Corrected assertion to `"0000000Z"`.

---

## Medium Priority (fix this sprint)

### M-1 — `GarmentCreate` schema missing `season`, `fabricComposition`, `uploadMethod`
**File:** `packages/api/app/schemas/garment.py`  
**Severity:** MEDIUM — The upload wizard collects season, fabric composition, and upload method, but `GarmentCreate` has no fields for these. They currently get silently dropped.  
**Recommendation:** Add `season: str | None = None`, `fabric_composition: str | None = None`, and `upload_method: str | None = None` to `GarmentCreate`. Fabric composition should trigger the pipeline.

### M-2 — `FabricPhysics` type mismatch: 0-100 UX scale vs actual physics values
**Files:** `packages/web/types/index.ts`, `shared/types.ts`, `packages/api/app/schemas/garment.py`  
**Severity:** MEDIUM — The frontend's `FabricPhysics` type uses a simplified 0-100 UX scale (`drape`, `stretch`, `weight`, `breathability`, `sheen`) but the physics system uses actual simulation parameters (`drape_coefficient` 0-1, `stretch_x` as fractional elongation, etc.)  
**The gap:** There is no API endpoint that converts physics params to the simplified 0-100 UX scale. The `/fabrics/physics` mock in `api.ts` fakes this but the real API doesn't return it.  
**Recommendation:** Either (a) add a `/api/v1/fabrics/ux-summary` endpoint that converts physics → UX scale, or (b) update the frontend to display actual physics values with appropriate labels.

### M-3 — `GarmentResponse` doesn't return nested `brand` object or `models` URLs
**File:** `packages/api/app/schemas/garment.py`  
**Severity:** MEDIUM — `shared/types.ts` defines `Garment.brand: BrandSummary` and `Garment.models: GarmentModels`, but `GarmentResponse` only returns `brand_id: str` and has no mesh URL fields  
**Recommendation:** Add `brand: BrandSummary` (nested) and `models: GarmentModels` to `GarmentResponse`. Requires eager-loading the brand relationship in `get_garment_by_ugi`.

### M-4 — `GarmentResponse.id` is actually a UGI, not a UUID
**File:** `packages/api/app/schemas/garment.py`, `shared/types.ts`  
**Severity:** MEDIUM — `shared/types.ts` types the garment's primary identifier as `id: UUID`, but `GarmentResponse` returns the UGI string in `id`. This is semantically correct behaviour (UGI is the PK) but the type annotation is wrong.  
**Recommendation:** Change `Garment.id` type in `shared/types.ts` to `UGI` (already defined as `type UGI = string`).

### M-5 — ProgressReporter creates synchronous Redis connection in async pipeline
**File:** `packages/pipeline/pipeline/orchestrator.py` — `ProgressReporter.__init__`  
**Severity:** MEDIUM — Uses `redis.from_url()` (sync) inside an async pipeline. Should use `redis.asyncio`.  
**Recommendation:** Change to `redis.asyncio.from_url()` and make `update()` async, or use a fire-and-forget approach via `asyncio.create_task`.

### M-6 — No DB commit in garment service — relies on middleware commit
**File:** `packages/api/app/services/garment_service.py`  
**Severity:** MEDIUM — Service only calls `db.flush()`, not `db.commit()`. This is correct for unit-of-work pattern if the router middleware commits after the response, but there's no explicit commit middleware visible.  
**Recommendation:** Confirm the session commit pattern — either add explicit `await db.commit()` in the service after each write, or ensure the FastAPI dependency lifecycle handles commits consistently.

### M-7 — `next.config.mjs` allows images from any hostname
**File:** `packages/web/next.config.mjs`  
**Severity:** MEDIUM — `hostname: '**'` allows Next.js image optimization to proxy images from any external domain, which could be abused.  
**Recommendation:** Restrict to `*.loocbooc.com`, `storage.googleapis.com`, `s3.amazonaws.com`.

---

## Low Priority / Future

### L-1 — LGMT exporter rebuilds entire ZIP to update checksum (inefficient)
**File:** `packages/pipeline/pipeline/output/lgmt_exporter.py` — `_update_checksum()`  
The checksum update re-reads and re-writes the entire ZIP archive. For large garment packages (multi-MB GLBs) this doubles I/O.  
**Recommendation:** Store checksum in a separate manifest field populated before writing, or compute it as part of the write pass.

### L-2 — `GarmentFile.file_type` enum out of sync with `shared/types.ts`
The model `GarmentFileType` uses simple values (`photo`, `video`, `pattern_ai`) but `shared/types.ts` `GarmentFileType` uses prefixed values (`source_photo`, `source_video`, `source_dxf`, etc.).  
**Recommendation:** Decide canonical values and align both sides.

### L-3 — `polypropylene` missing from `FibrePhysicsBase` coverage note
The `FIBRE_PHYSICS_BASE` dict has 16 entries. `polypropylene` is present (good) but is not in the test's `test_all_common_fibres_in_database` expected list. No crash, but the test should be updated to cover all 16.

### L-4 — `docs/qa-report.md` docstring in `composition_parser.py` used `pct` not `percentage`
**Fixed:** Corrected to `percentage` in this review.

### L-5 — Rate limiter uses `zadd` with same timestamp for multiple requests in same second
**File:** `packages/api/app/middleware/rate_limit.py`  
If multiple requests arrive in the same second, they all get key `str(now)` in the sorted set. Redis sorted sets deduplicate by member, so only one of those requests counts toward the rate limit. Use `str(uuid4())` or a float timestamp as the member key.

### L-6 — Auth: `X-Brand-ID` header was being sent from the web client (now removed)
**File:** `packages/web/lib/api.ts`  
The old code sent `X-Brand-ID` as a header alongside the API key. The API ignores this header and derives brand from the key itself — so it was harmless. Removed in the auth fix.

---

## What Was Fixed In This Review

| # | File | Issue | Fix |
|---|------|--------|-----|
| 1 | `packages/web/lib/api.ts` | API key sent as `Authorization: Bearer` | Changed to `X-API-Key` header |
| 2 | `packages/web/lib/api.ts` | Multi-file upload sent in one request | Loop per file, `file` key (singular) |
| 3 | `packages/web/lib/api.ts` | Garment paths missing `/api/v1` prefix | Added prefix to all garment/scan/fabric/brand paths |
| 4 | `packages/web/lib/api.ts` | Mock `GarmentListResponse` used `garments`/`limit` | Updated to `items`/`page_size`/`has_next` |
| 5 | `packages/web/lib/api.ts` | Mock garment categories were singular | Updated to plural values |
| 6 | `packages/web/types/index.ts` | `GarmentListResponse` wrong field names | Fixed to `items`, `page_size`, `has_next` |
| 7 | `packages/web/types/index.ts` | `GarmentStatus` missing states | Added `updating`, `archived`, `deleted` |
| 8 | `packages/web/types/index.ts` | `GarmentCategory` singular values | Updated to plural (matching API model) |
| 9 | `packages/web/components/garments/GarmentUploadWizard.tsx` | Category keys were singular | Updated to plural |
| 10 | `shared/types.ts` | `GarmentCategory` singular + missing values | Aligned to plural + added `bags`, `hats`, `suits` |
| 11 | `packages/api/app/models/garment.py` | Missing status values (error, updating, deleted) | Added to `GarmentStatus` enum |
| 12 | `packages/api/app/models/garment.py` | Missing `suits` category | Added `SUITS = "suits"` + category code `"SU"` |
| 13 | `packages/api/app/config.py` | No validation on default `SECRET_KEY` | Added `@field_validator` with warning + minimum length check |
| 14 | `packages/api/app/main.py` | CORS wildcard + credentials = broken auth | Explicit localhost origins in dev mode |
| 15 | `packages/api/tests/test_uuid.py` | Wrong assertion: `"000000Z"` (7 chars) | Fixed to `"0000000Z"` (8 chars) |
| 16 | `packages/pipeline/pipeline/physics/composition_parser.py` | Docstring used `pct` not `percentage` | Fixed to `percentage` |
| 17 | `packages/api/tests/test_auth.py` | No auth middleware tests existed | **Written**: covers hash, JWT, auth context, header path |
| 18 | `packages/pipeline/tests/test_composition_edge_cases.py` | Edge cases untested | **Written**: all-caps, reversed order, fractions, unknowns, OCR noise |

---

## Test Coverage Summary

### Before This Review

| Package | Critical Paths Tested |
|---------|----------------------|
| API: UGI service | ✅ Comprehensive |
| API: Garment endpoints | ✅ Basic CRUD |
| API: Auth middleware | ❌ Missing |
| API: File upload | ❌ Missing |
| Pipeline: Physics estimator | ✅ Good coverage |
| Pipeline: Composition parser — standard | ✅ Good coverage |
| Pipeline: Composition parser — edge cases | ❌ Missing (all-caps, OCR noise, reversed order) |
| Pipeline: Orchestrator | ✅ Basic |
| Web: No tests exist | ❌ Missing |

### After This Review

| Package | Added |
|---------|-------|
| API | `tests/test_auth.py` — 14 new tests covering hash, JWT, auth context, header paths |
| Pipeline | `tests/test_composition_edge_cases.py` — 30+ new tests covering all audited edge cases |

### Still Missing (recommended next sprint)

- **API:** File upload endpoint tests (file type validation, size limits, pipeline trigger)
- **API:** Rate limiter tests
- **API:** `GET /garments` list filtering / pagination tests
- **API:** Garment update / version audit trail tests
- **Pipeline:** LGMT exporter tests (ZIP structure validation, checksum verification)
- **Pipeline:** GLB exporter tests
- **Web:** Component tests (none exist; recommend adding with Vitest + Testing Library)

---

## Top 3 Issues Still Needing Attention

### 1. `FabricPhysics` type mismatch (M-2)
The frontend's simplified 0-100 scale physics display doesn't connect to the real physics system. There's a mock in `api.ts` that generates fake values but no real API endpoint exists. This blocks the core "physics-accurate simulation" value proposition from being surfaced in the UI. **Needs:** either a `/fabrics/ux-summary` endpoint or a decision on frontend data display.

### 2. `GarmentCreate` missing `season` and `fabricComposition` fields (M-1)
The upload wizard collects fabric composition in Step 4, which is the most important physics data, but `GarmentCreate` has no field for it. The data is currently dropped silently. **This means no garment created via the wizard will have physics simulation.** Needs: add these fields to `GarmentCreate` schema and wire through to the pipeline trigger.

### 3. DB migration required for new enum values (H-2)
`GarmentStatus.ERROR`, `GarmentStatus.UPDATING`, and `GarmentStatus.DELETED` were added to the Python enum but the PostgreSQL ENUM type on the database won't include them until an Alembic migration is run. Similarly, `GarmentCategory.SUITS` needs a migration. The service will error with `DataError` if anyone tries to set these statuses before the migration is applied. **Needs:** `alembic revision --autogenerate -m "add_garment_status_updating_error_deleted"` followed by review and `alembic upgrade head`.

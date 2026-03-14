# Loocbooc 3D Reconstruction Pipeline

The technical moat. Converts photos, videos, and pattern files into physics-accurate 3D garment models.

## Two Reconstruction Paths

**Path A — Pattern-based (highest accuracy)**
```
DXF/AAMA pattern + care label photo → composition OCR → physics params → 3D garment
```
More accurate than scanning because it derives geometry from the source truth (the pattern), not from a physical sample with variation. The 3D model exists before the garment is manufactured.

**Path B — Photo/video-based (accessible to all brands)**
```
12+ photos or 60-90s video → COLMAP photogrammetry → mesh → physics draping
```
Works on any phone, any existing product photography setup.

## Quick Start

```bash
# Install
cd packages/pipeline
poetry install

# Run tests (no COLMAP or Blender required)
poetry run pytest

# Test the physics estimator directly
python -c "
from pipeline.physics.physics_estimator import PhysicsEstimator
params = PhysicsEstimator().estimate_from_string('85% Polyester, 15% Elastane')
print(f'Drape: {params.drape_coefficient:.2f}, Stretch: {params.stretch_x:.2f}x')
"

# Start Celery worker (requires Redis)
celery -A pipeline.workers.celery_worker worker -Q pipeline -c 2 --loglevel=info

# Or with Docker
docker compose -f worker-compose.yml up
```

## Component Status

| Component | Status | Notes |
|---|---|---|
| `composition_parser.py` | ✅ Fully functional | 16+ fibres, 6 languages |
| `physics_estimator.py` | ✅ Fully functional | 16 fibres, non-linear rules |
| `photo_ingest.py` | ✅ Functional | Requires Pillow, OpenCV |
| `video_ingest.py` | ✅ Functional | Requires OpenCV |
| `pattern_ingest.py` | ✅ Functional | Requires ezdxf |
| `clo_ingest.py` | ✅ Functional | ZIP extraction |
| `photogrammetry.py` | ✅ COLMAP integration | Requires COLMAP binary |
| `mock_photogrammetry` | ✅ Functional | For dev without COLMAP |
| `mesh_processing.py` | ✅ Functional | Requires Open3D, trimesh |
| `pattern_to_3d.py` | ✅ Functional | Geometric assembly |
| `simulation.py` | ✅ PBD solver | Blender path stubbed |
| `glb_exporter.py` | ✅ Functional | Physics extension injection |
| `usdz_exporter.py` | ⚠️ Needs usd-core | Blender fallback included |
| `lgmt_exporter.py` | ✅ Fully functional | Complete LGMT format |
| `orchestrator.py` | ✅ Functional | All paths wired |
| `celery_worker.py` | ✅ Functional | S3 upload is stub |
| `gaussian_splat.py` | 🔲 Planned Q3 2026 | 3DGS future path |

## Installation Requirements

**Core (required):**
```bash
pip install numpy Pillow scipy opencv-python-headless open3d trimesh ezdxf pygltflib pydantic celery redis structlog httpx imagehash piexif
```

**Optional (for full functionality):**
```bash
pip install rembg          # Background removal
pip install usd-core       # USDZ export
# brew install colmap      # Photogrammetry reconstruction
# brew install blender     # Cloth simulation + USDZ
```

## COLMAP Installation

COLMAP is required for photo/video reconstruction (not needed for pattern-based path):

```bash
# macOS
brew install colmap

# Ubuntu / Debian
sudo apt install colmap

# Docker (recommended for production)
docker pull colmap/colmap
```

## Architecture

```
Job arrives (photo/video/pattern/CLO3D)
    ↓
PipelineOrchestrator.process_garment(job)
    ↓
Select path: CLO3D > Pattern > Photos > Video > Error
    ↓
Reconstruction (COLMAP or pattern-to-3D)
    ↓
PhysicsEstimation (composition → physics params)
    ↓
MeshProcessing (clean, LOD generation: HQ/Web/Mobile)
    ↓
ClothSimulation (PBD draping with physics)
    ↓
Export (GLB × 3 + USDZ + LGMT)
    ↓
Upload to S3/GCS + notify API
```

## The LGMT Format

`.lgmt` is a ZIP archive — Loocbooc's native garment file format:

```
garment.lgmt/
├── manifest.json      UGI, metadata, file inventory
├── mesh_hq.glb        50k triangles, Draco compressed
├── mesh_web.glb       15k triangles, Draco compressed
├── mesh_mobile.glb    8k triangles, Draco compressed
├── physics.json       Full physics parameter set
├── textures/
│   ├── albedo.png
│   ├── normal.png
│   └── roughness.png
├── patterns/
│   └── shirt.dxf      Original pattern (if provided)
└── versions.json      Version history
```

## Technical Risks

See the code comments and the main technical risk register. Summary:
1. COLMAP feature matching on textureless/solid fabrics is the hardest problem
2. USDZ export quality depends on usd-core (fragile library)
3. PBD cloth simulation is approximate — Blender/Marvelous gives better results
4. Pattern-to-3D geometric placement needs tuning per garment type

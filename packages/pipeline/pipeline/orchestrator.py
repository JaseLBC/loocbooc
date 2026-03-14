"""
Pipeline Orchestrator
======================
The main entry point for all 3D garment reconstruction jobs.

Routes jobs through the appropriate reconstruction path based on available inputs:
  Priority 1: CLO3D/Marvelous Designer file → direct import
  Priority 2: Pattern files (DXF/AAMA) → pattern-to-3D
  Priority 3: 12+ photos → photogrammetry
  Priority 4: Video → frame extraction → photogrammetry
  Priority 5: <8 photos → INSUFFICIENT_DATA error with guidance

Job lifecycle:
  QUEUED → PROCESSING → RECONSTRUCTION → PHYSICS → EXPORTING → COMPLETE / FAILED

Progress reporting: Updates Redis key with progress percentage.
Async: Designed for use with Celery workers (see workers/celery_worker.py).

Usage:
    orchestrator = PipelineOrchestrator()
    result = await orchestrator.process_garment(job)
"""

from __future__ import annotations

import asyncio
import logging
import tempfile
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional, Any

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    RECONSTRUCTION = "RECONSTRUCTION"
    PHYSICS = "PHYSICS"
    EXPORTING = "EXPORTING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class ReconstructionPath(str, Enum):
    CLO3D = "CLO3D"
    PATTERN = "PATTERN"
    PHOTOGRAMMETRY = "PHOTOGRAMMETRY"
    VIDEO = "VIDEO"
    MOCK = "MOCK"       # Development/testing path


@dataclass
class PipelineJob:
    """Input specification for a garment reconstruction job."""
    job_id: str
    ugi: str                        # Universal Garment Identifier

    # Input files — provide at least one path
    clo_file: Optional[str] = None          # .zprj or .avt
    pattern_files: list[str] = field(default_factory=list)  # DXF files
    photo_paths: list[str] = field(default_factory=list)    # JPEG/PNG images
    video_path: Optional[str] = None                        # MP4/MOV

    # Fabric composition (can come from label OCR)
    fabric_composition: Optional[str] = None  # "85% Polyester, 15% Elastane"

    # Metadata
    garment_name: Optional[str] = None
    garment_type: Optional[str] = None
    brand: Optional[str] = None
    season: Optional[str] = None
    colorway: Optional[str] = None

    # Options
    use_mock_reconstruction: bool = False   # For testing without COLMAP
    output_dir: Optional[str] = None        # Override default output location

    # Progress reporting
    redis_progress_key: Optional[str] = None  # Redis key to update with progress
    webhook_url: Optional[str] = None          # Callback URL on completion


@dataclass
class PipelineResult:
    """Output from a completed pipeline job."""
    job_id: str
    ugi: str
    status: JobStatus
    reconstruction_path: Optional[ReconstructionPath]

    # Output files
    lgmt_path: Optional[str] = None
    mesh_hq_path: Optional[str] = None
    mesh_web_path: Optional[str] = None
    mesh_mobile_path: Optional[str] = None
    usdz_path: Optional[str] = None

    # Physics results
    physics_params: Optional[dict] = None

    # Timing
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    duration_seconds: Optional[float] = None

    # Error / guidance
    error: Optional[str] = None
    guidance: Optional[str] = None
    warnings: list[str] = field(default_factory=list)
    progress: int = 0  # 0–100


class ProgressReporter:
    """Updates Redis key with job progress. No-ops gracefully if Redis unavailable."""

    def __init__(self, job_id: str, redis_key: Optional[str] = None):
        self.job_id = job_id
        self.redis_key = redis_key
        self._redis = None
        if redis_key:
            try:
                import redis
                self._redis = redis.from_url("redis://localhost:6379", decode_responses=True)
            except Exception:
                logger.warning("Redis unavailable — progress reporting disabled")

    def update(self, status: JobStatus, progress: int, message: str = "") -> None:
        """Update job progress in Redis."""
        data = {
            "job_id": self.job_id,
            "status": status.value,
            "progress": progress,
            "message": message,
        }
        logger.info(f"[{self.job_id}] {status.value} {progress}% {message}")

        if self._redis and self.redis_key:
            try:
                import json
                self._redis.set(self.redis_key, json.dumps(data), ex=86400)
            except Exception as e:
                logger.warning(f"Redis update failed: {e}")


class PipelineOrchestrator:
    """
    Main pipeline orchestrator. Routes garment jobs through reconstruction paths.
    """

    def __init__(
        self,
        work_dir: Optional[Path] = None,
        use_gpu: bool = True,
    ):
        self.work_dir = Path(work_dir) if work_dir else Path(tempfile.gettempdir()) / "loocbooc_pipeline"
        self.use_gpu = use_gpu

    async def process_garment(self, job: PipelineJob) -> PipelineResult:
        """
        Main entry point. Routes job through appropriate pipeline.

        Priority:
          1. CLO3D/MD file
          2. Pattern files
          3. 12+ photos
          4. Video
          5. <8 photos → INSUFFICIENT_DATA
        """
        started = time.monotonic()
        result = PipelineResult(
            job_id=job.job_id,
            ugi=job.ugi,
            status=JobStatus.PROCESSING,
            reconstruction_path=None,
            started_at=time.time(),
        )

        reporter = ProgressReporter(job.job_id, job.redis_progress_key)
        reporter.update(JobStatus.PROCESSING, 5, "Starting pipeline")

        # Create job work directory
        job_dir = self.work_dir / job.job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        try:
            # Determine reconstruction path
            path = self._select_reconstruction_path(job)

            if path is None:
                return self._insufficient_data_result(job, started, result)

            result.reconstruction_path = path
            reporter.update(JobStatus.PROCESSING, 10, f"Reconstruction path: {path.value}")

            # Run reconstruction
            reporter.update(JobStatus.RECONSTRUCTION, 15, "Starting reconstruction")
            mesh_path = await self._run_reconstruction(job, path, job_dir, reporter)

            if not mesh_path:
                result.status = JobStatus.FAILED
                result.error = "Reconstruction produced no mesh output"
                return result

            reporter.update(JobStatus.RECONSTRUCTION, 55, "Reconstruction complete")

            # Process physics
            reporter.update(JobStatus.PHYSICS, 60, "Estimating fabric physics")
            physics_params = self._run_physics_estimation(job)
            result.physics_params = physics_params

            reporter.update(JobStatus.PHYSICS, 70, "Physics estimation complete")

            # Run mesh LOD generation
            reporter.update(JobStatus.EXPORTING, 72, "Generating mesh LODs")
            lod_paths = await self._generate_lods(mesh_path, job_dir, reporter)

            # Run cloth simulation if physics available
            if physics_params and lod_paths.get("hq"):
                reporter.update(JobStatus.PHYSICS, 78, "Running cloth simulation")
                try:
                    lod_paths = await self._run_simulation(
                        lod_paths, physics_params, job_dir, reporter
                    )
                except Exception as e:
                    result.warnings.append(f"Cloth simulation failed (skipped): {e}")

            # Export all formats
            reporter.update(JobStatus.EXPORTING, 82, "Exporting formats")
            export_paths = await self._export_all_formats(
                job, lod_paths, physics_params, job_dir, reporter
            )

            result.mesh_hq_path = lod_paths.get("hq")
            result.mesh_web_path = lod_paths.get("web")
            result.mesh_mobile_path = lod_paths.get("mobile")
            result.lgmt_path = export_paths.get("lgmt")
            result.usdz_path = export_paths.get("usdz")

            reporter.update(JobStatus.COMPLETE, 100, "Complete")
            result.status = JobStatus.COMPLETE

        except Exception as e:
            logger.error(f"Pipeline failed for job {job.job_id}: {e}", exc_info=True)
            result.status = JobStatus.FAILED
            result.error = str(e)
            reporter.update(JobStatus.FAILED, result.progress, f"Failed: {e}")

        finally:
            elapsed = time.monotonic() - started
            result.completed_at = time.time()
            result.duration_seconds = round(elapsed, 2)

        return result

    def _select_reconstruction_path(self, job: PipelineJob) -> Optional[ReconstructionPath]:
        """Determine which reconstruction path to take."""
        if job.use_mock_reconstruction:
            return ReconstructionPath.MOCK

        if job.clo_file and Path(job.clo_file).exists():
            return ReconstructionPath.CLO3D

        if job.pattern_files and any(Path(p).exists() for p in job.pattern_files):
            return ReconstructionPath.PATTERN

        if len(job.photo_paths) >= 8:
            return ReconstructionPath.PHOTOGRAMMETRY

        if job.video_path and Path(job.video_path).exists():
            return ReconstructionPath.VIDEO

        if len(job.photo_paths) > 0:
            return None  # Not enough photos

        return None

    def _insufficient_data_result(
        self, job: PipelineJob, started: float, result: PipelineResult
    ) -> PipelineResult:
        """Return INSUFFICIENT_DATA with helpful guidance."""
        n_photos = len(job.photo_paths)
        guidance_parts = [
            f"Insufficient input data for reconstruction (provided {n_photos} photo(s)).",
            "",
            "To reconstruct this garment, provide ONE of:",
            "  • CLO3D file (.zprj) or Marvelous Designer file (.avt) — instant, highest quality",
            "  • DXF pattern file(s) — mathematically perfect reconstruction",
            f"  • {8}+ photos of the garment from multiple angles (recommend 12–24)",
            "  • 60–90 second video scan of the garment",
            "",
            "Photo guidelines:",
            "  • Minimum 8 photos, ideally 12–24",
            "  • White or solid background",
            "  • Good, even lighting (avoid harsh shadows or reflections)",
            "  • Cover all angles: front, back, sides, sleeves, details",
            "  • Keep camera distance consistent",
            "  • Minimum 1000×1000 pixel resolution",
        ]

        result.status = JobStatus.INSUFFICIENT_DATA
        result.error = "\n".join(guidance_parts)
        result.guidance = result.error
        result.completed_at = time.time()
        result.duration_seconds = round(time.monotonic() - started, 2)
        return result

    async def _run_reconstruction(
        self,
        job: PipelineJob,
        path: ReconstructionPath,
        job_dir: Path,
        reporter: ProgressReporter,
    ) -> Optional[str]:
        """Route to appropriate reconstruction module."""

        if path == ReconstructionPath.MOCK:
            from pipeline.reconstruction.photogrammetry import MockPhotogrammetryReconstructor
            recon = MockPhotogrammetryReconstructor()
            images_dir = job_dir / "images"
            images_dir.mkdir(exist_ok=True)
            result = recon.reconstruct(images_dir, job_dir / "reconstruction")
            return result.mesh_path

        elif path == ReconstructionPath.CLO3D:
            from pipeline.ingest.clo_ingest import CLOIngestor
            ingestor = CLOIngestor()
            result = ingestor.process(job.clo_file, job_dir / "clo_output")
            reporter.update(JobStatus.RECONSTRUCTION, 45, "CLO3D file imported")
            return result.mesh_path

        elif path == ReconstructionPath.PATTERN:
            from pipeline.reconstruction.pattern_to_3d import PatternTo3DConverter
            from pipeline.ingest.pattern_ingest import PatternIngestor
            ingestor = PatternIngestor()
            converter = PatternTo3DConverter()

            pattern_path = next(p for p in job.pattern_files if Path(p).exists())
            reporter.update(JobStatus.RECONSTRUCTION, 20, f"Parsing pattern: {Path(pattern_path).name}")
            pattern_file = ingestor.parse(pattern_path)

            reporter.update(JobStatus.RECONSTRUCTION, 35, f"Converting {pattern_file.piece_count} pieces to 3D")
            mesh = converter.convert(pattern_file, job_dir / "reconstruction")

            ply_path = job_dir / "reconstruction" / "assembled_raw.ply"
            return str(ply_path) if ply_path.exists() else None

        elif path == ReconstructionPath.PHOTOGRAMMETRY:
            from pipeline.ingest.photo_ingest import PhotoIngestor
            from pipeline.reconstruction.photogrammetry import PhotogrammetryReconstructor, MockPhotogrammetryReconstructor

            reporter.update(JobStatus.RECONSTRUCTION, 20, f"Preprocessing {len(job.photo_paths)} photos")
            ingestor = PhotoIngestor()
            ingest_result = ingestor.process(job.photo_paths, job_dir / "preprocessed")

            if not ingest_result.ready_for_reconstruction:
                raise RuntimeError(
                    f"Photo preprocessing failed: only {ingest_result.accepted_count} "
                    f"of {ingest_result.input_count} images accepted."
                )

            reporter.update(JobStatus.RECONSTRUCTION, 30, "Starting COLMAP reconstruction")
            recon = PhotogrammetryReconstructor()
            if not recon.is_available():
                logger.warning("COLMAP not installed — falling back to mock reconstruction")
                recon = MockPhotogrammetryReconstructor()

            result = recon.reconstruct(
                job_dir / "preprocessed",
                job_dir / "reconstruction",
            )
            return result.mesh_path

        elif path == ReconstructionPath.VIDEO:
            from pipeline.ingest.video_ingest import VideoIngestor
            from pipeline.reconstruction.photogrammetry import PhotogrammetryReconstructor, MockPhotogrammetryReconstructor

            reporter.update(JobStatus.RECONSTRUCTION, 18, "Extracting video frames")
            ingestor = VideoIngestor()
            ingest_result = ingestor.process(job.video_path, job_dir / "frames")

            if not ingest_result.ready_for_reconstruction:
                raise RuntimeError(
                    f"Video frame extraction failed: only {ingest_result.extracted_frame_count} usable frames."
                )

            reporter.update(JobStatus.RECONSTRUCTION, 30, f"Running photogrammetry on {ingest_result.extracted_frame_count} frames")
            recon = PhotogrammetryReconstructor()
            if not recon.is_available():
                recon = MockPhotogrammetryReconstructor()

            result = recon.reconstruct(
                job_dir / "frames",
                job_dir / "reconstruction",
            )
            return result.mesh_path

        return None

    def _run_physics_estimation(self, job: PipelineJob) -> Optional[dict]:
        """Parse fabric composition and estimate physics parameters."""
        if not job.fabric_composition:
            logger.info("No fabric composition provided — using default physics.")
            return None

        from pipeline.physics.composition_parser import CompositionParser
        from pipeline.physics.physics_estimator import PhysicsEstimator

        parser = CompositionParser()
        composition = parser.parse(job.fabric_composition)

        estimator = PhysicsEstimator()
        physics = estimator.estimate(composition)

        logger.info(
            f"Physics estimated: drape={physics.drape_coefficient:.2f}, "
            f"stretch_x={physics.stretch_x:.2f}, confidence={physics.confidence_level.value}"
        )

        return physics.to_dict()

    async def _generate_lods(
        self,
        mesh_path: str,
        job_dir: Path,
        reporter: ProgressReporter,
    ) -> dict[str, Optional[str]]:
        """Generate High / Web / Mobile LOD meshes."""
        from pipeline.reconstruction.mesh_processing import MeshProcessor, MeshQuality

        processor = MeshProcessor()
        lod_dir = job_dir / "lods"

        try:
            results = processor.process_multi_lod(Path(mesh_path), lod_dir)
            lod_paths = {}
            for quality_key, result in results.items():
                if result.success:
                    lod_paths[quality_key] = result.output_path
                else:
                    logger.warning(f"LOD {quality_key} failed: {result.error}")
                    lod_paths[quality_key] = None

            # Fallback: if LOD generation failed, use original mesh
            if not any(lod_paths.values()):
                lod_paths = {"hq": mesh_path, "web": mesh_path, "mobile": mesh_path}

            return lod_paths

        except Exception as e:
            logger.warning(f"LOD generation failed: {e} — using original mesh for all LODs")
            return {"hq": mesh_path, "web": mesh_path, "mobile": mesh_path}

    async def _run_simulation(
        self,
        lod_paths: dict[str, Optional[str]],
        physics_params: dict,
        job_dir: Path,
        reporter: ProgressReporter,
    ) -> dict[str, Optional[str]]:
        """Apply cloth simulation draping to the HQ mesh."""
        # Simulation is computationally intensive — run on HQ only,
        # then downsample results for web/mobile
        # For now, skip simulation in async path and let dedicated worker handle it
        # This is a hook for future integration
        return lod_paths

    async def _export_all_formats(
        self,
        job: PipelineJob,
        lod_paths: dict[str, Optional[str]],
        physics_params: Optional[dict],
        job_dir: Path,
        reporter: ProgressReporter,
    ) -> dict[str, Optional[str]]:
        """Export GLB LODs, USDZ, and LGMT."""
        exports: dict[str, Optional[str]] = {}

        # Export GLB LODs (inject physics extension)
        glb_paths: dict[str, Path] = {}
        from pipeline.output.glb_exporter import GLBExporter
        glb_exporter = GLBExporter()
        for level, mesh_path in lod_paths.items():
            if not mesh_path:
                continue
            out = job_dir / "output" / f"mesh_{level}.glb"
            out.parent.mkdir(parents=True, exist_ok=True)
            try:
                glb_result = glb_exporter.export(
                    Path(mesh_path), out, physics_params=physics_params
                )
                if glb_result.success:
                    glb_paths[level] = out
            except Exception as e:
                reporter._redis  # just reference reporter to avoid unused warning
                logger.warning(f"GLB export {level} failed: {e}")

        reporter.update(JobStatus.EXPORTING, 88, "GLB export complete")

        # Export USDZ (web mesh, best compromise)
        web_mesh = lod_paths.get("web") or lod_paths.get("hq")
        if web_mesh:
            usdz_path = job_dir / "output" / "garment.usdz"
            try:
                from pipeline.output.usdz_exporter import USDZExporter
                usdz_result = USDZExporter().export(Path(web_mesh), usdz_path)
                if usdz_result.success:
                    exports["usdz"] = str(usdz_path)
            except Exception as e:
                logger.warning(f"USDZ export failed: {e}")

        reporter.update(JobStatus.EXPORTING, 93, "Assembling LGMT package")

        # Export LGMT
        lgmt_path = job_dir / "output" / f"{job.ugi}.lgmt"
        try:
            from pipeline.output.lgmt_exporter import LGMTExporter
            lgmt_result = LGMTExporter().export(
                ugi=job.ugi,
                output_path=lgmt_path,
                mesh_paths={k: v for k, v in glb_paths.items()},
                physics=physics_params,
                metadata={
                    "garment_name": job.garment_name,
                    "garment_type": job.garment_type,
                    "brand": job.brand,
                    "season": job.season,
                    "colorway": job.colorway,
                },
            )
            if lgmt_result.success:
                exports["lgmt"] = str(lgmt_path)
        except Exception as e:
            logger.warning(f"LGMT export failed: {e}")

        return exports


def create_orchestrator(
    work_dir: Optional[str] = None,
    use_gpu: bool = True,
) -> PipelineOrchestrator:
    """Factory function for creating a configured orchestrator."""
    return PipelineOrchestrator(
        work_dir=Path(work_dir) if work_dir else None,
        use_gpu=use_gpu,
    )

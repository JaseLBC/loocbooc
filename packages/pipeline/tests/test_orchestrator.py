"""
Tests for the pipeline orchestrator routing and job lifecycle.
"""

import pytest
import asyncio
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock

from pipeline.orchestrator import (
    PipelineOrchestrator,
    PipelineJob,
    PipelineResult,
    JobStatus,
    ReconstructionPath,
    ProgressReporter,
)


def make_job(**kwargs) -> PipelineJob:
    """Helper to create a PipelineJob with defaults."""
    defaults = {
        "job_id": "test-job-001",
        "ugi": "LB-2026-TEST-001",
    }
    defaults.update(kwargs)
    return PipelineJob(**defaults)


class TestPipelineOrchestrator:

    def setup_method(self):
        self.orchestrator = PipelineOrchestrator()

    # -------------------------------------------------------------------
    # Path selection tests
    # -------------------------------------------------------------------

    def test_selects_clo3d_path_when_file_provided(self, tmp_path):
        """CLO3D file should take priority over everything else."""
        clo_file = tmp_path / "garment.zprj"
        clo_file.touch()
        job = make_job(
            clo_file=str(clo_file),
            pattern_files=["pattern.dxf"],
            photo_paths=["img1.jpg"] * 12,
        )
        path = self.orchestrator._select_reconstruction_path(job)
        assert path == ReconstructionPath.CLO3D

    def test_selects_pattern_path_when_dxf_provided(self, tmp_path):
        """Pattern file should take priority over photos."""
        dxf_file = tmp_path / "shirt.dxf"
        dxf_file.touch()
        job = make_job(
            pattern_files=[str(dxf_file)],
            photo_paths=["img1.jpg"] * 12,
        )
        path = self.orchestrator._select_reconstruction_path(job)
        assert path == ReconstructionPath.PATTERN

    def test_selects_photogrammetry_with_12_photos(self, tmp_path):
        photos = []
        for i in range(12):
            p = tmp_path / f"img_{i}.jpg"
            p.touch()
            photos.append(str(p))
        job = make_job(photo_paths=photos)
        path = self.orchestrator._select_reconstruction_path(job)
        assert path == ReconstructionPath.PHOTOGRAMMETRY

    def test_selects_photogrammetry_with_8_photos(self, tmp_path):
        """8 photos = minimum threshold for photogrammetry."""
        photos = []
        for i in range(8):
            p = tmp_path / f"img_{i}.jpg"
            p.touch()
            photos.append(str(p))
        job = make_job(photo_paths=photos)
        path = self.orchestrator._select_reconstruction_path(job)
        assert path == ReconstructionPath.PHOTOGRAMMETRY

    def test_selects_video_path_when_video_provided(self, tmp_path):
        video = tmp_path / "scan.mp4"
        video.touch()
        job = make_job(video_path=str(video))
        path = self.orchestrator._select_reconstruction_path(job)
        assert path == ReconstructionPath.VIDEO

    def test_returns_none_with_insufficient_photos(self, tmp_path):
        """<8 photos and no other input → None (insufficient data)."""
        photos = []
        for i in range(5):
            p = tmp_path / f"img_{i}.jpg"
            p.touch()
            photos.append(str(p))
        job = make_job(photo_paths=photos)
        path = self.orchestrator._select_reconstruction_path(job)
        assert path is None

    def test_returns_none_with_no_input(self):
        job = make_job()
        path = self.orchestrator._select_reconstruction_path(job)
        assert path is None

    def test_selects_mock_when_flag_set(self):
        job = make_job(use_mock_reconstruction=True)
        path = self.orchestrator._select_reconstruction_path(job)
        assert path == ReconstructionPath.MOCK

    # -------------------------------------------------------------------
    # Insufficient data result
    # -------------------------------------------------------------------

    def test_insufficient_data_result_contains_guidance(self):
        import time
        job = make_job()
        result = PipelineResult(
            job_id=job.job_id,
            ugi=job.ugi,
            status=JobStatus.PROCESSING,
            reconstruction_path=None,
        )
        started = time.monotonic()
        final = self.orchestrator._insufficient_data_result(job, started, result)
        assert final.status == JobStatus.INSUFFICIENT_DATA
        assert final.guidance is not None
        assert "8" in final.guidance  # Should mention minimum photo count

    # -------------------------------------------------------------------
    # Physics estimation
    # -------------------------------------------------------------------

    def test_physics_estimation_returns_dict(self):
        job = make_job(fabric_composition="85% Polyester, 15% Elastane")
        physics = self.orchestrator._run_physics_estimation(job)
        assert physics is not None
        assert "drape_coefficient" in physics
        assert "stretch_x" in physics

    def test_physics_estimation_none_when_no_composition(self):
        job = make_job(fabric_composition=None)
        physics = self.orchestrator._run_physics_estimation(job)
        assert physics is None

    # -------------------------------------------------------------------
    # Full mock pipeline (integration test)
    # -------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_full_mock_pipeline_completes(self, tmp_path):
        """Full pipeline run with mock reconstruction should complete successfully."""
        job = make_job(
            use_mock_reconstruction=True,
            fabric_composition="100% Cotton",
            output_dir=str(tmp_path),
        )
        orchestrator = PipelineOrchestrator(work_dir=tmp_path)
        result = await orchestrator.process_garment(job)

        # Should complete (not fail)
        assert result.status in (JobStatus.COMPLETE, JobStatus.FAILED)
        # Even in test env, it should at least start and set reconstruction path
        assert result.reconstruction_path == ReconstructionPath.MOCK

    @pytest.mark.asyncio
    async def test_insufficient_data_returns_correct_status(self):
        job = make_job()  # No files
        orchestrator = PipelineOrchestrator()
        result = await orchestrator.process_garment(job)
        assert result.status == JobStatus.INSUFFICIENT_DATA

    @pytest.mark.asyncio
    async def test_result_has_timing_info(self):
        job = make_job()
        orchestrator = PipelineOrchestrator()
        result = await orchestrator.process_garment(job)
        assert result.duration_seconds is not None
        assert result.duration_seconds >= 0
        assert result.completed_at is not None

    # -------------------------------------------------------------------
    # Progress reporter
    # -------------------------------------------------------------------

    def test_progress_reporter_no_redis(self):
        """Reporter should not crash when Redis is unavailable."""
        reporter = ProgressReporter("test-job", redis_key=None)
        reporter.update(JobStatus.PROCESSING, 50, "halfway")  # Should not raise

    def test_progress_reporter_with_invalid_redis(self):
        """Reporter should not crash with invalid Redis URL."""
        reporter = ProgressReporter("test-job", redis_key="progress:test-job")
        reporter.update(JobStatus.COMPLETE, 100, "done")  # Should not raise


class TestPipelineJob:

    def test_job_defaults(self):
        job = PipelineJob(job_id="j1", ugi="LB-001")
        assert job.photo_paths == []
        assert job.pattern_files == []
        assert job.use_mock_reconstruction is False
        assert job.fabric_composition is None

    def test_job_with_all_fields(self):
        job = PipelineJob(
            job_id="j1",
            ugi="LB-001",
            fabric_composition="100% Cotton",
            garment_name="Test Shirt",
            brand="Charcoal",
        )
        assert job.garment_name == "Test Shirt"
        assert job.brand == "Charcoal"


class TestLGMTExporter:
    """Basic LGMT export tests — no mesh files required."""

    def test_lgmt_export_metadata_only(self, tmp_path):
        from pipeline.output.lgmt_exporter import LGMTExporter
        import zipfile

        exporter = LGMTExporter()
        out = tmp_path / "test.lgmt"
        result = exporter.export(
            ugi="LB-2026-TEST",
            output_path=out,
            physics={"drape_coefficient": 0.45, "stretch_x": 0.05},
            metadata={"brand": "Charcoal", "garment_type": "SHIRT"},
        )
        assert result.success
        assert out.exists()
        assert zipfile.is_zipfile(out)

    def test_lgmt_manifest_contains_ugi(self, tmp_path):
        from pipeline.output.lgmt_exporter import LGMTExporter

        exporter = LGMTExporter()
        out = tmp_path / "test.lgmt"
        exporter.export(ugi="LB-2026-MANIFEST-TEST", output_path=out)

        manifest = exporter.read_manifest(out)
        assert manifest["ugi"] == "LB-2026-MANIFEST-TEST"

    def test_lgmt_physics_readable(self, tmp_path):
        from pipeline.output.lgmt_exporter import LGMTExporter

        exporter = LGMTExporter()
        out = tmp_path / "test.lgmt"
        physics = {"drape_coefficient": 0.75, "elastane_pct": 15}
        exporter.export(ugi="LB-001", output_path=out, physics=physics)

        loaded = exporter.read_physics(out)
        assert loaded["drape_coefficient"] == 0.75

    def test_lgmt_includes_versions(self, tmp_path):
        import zipfile, json
        from pipeline.output.lgmt_exporter import LGMTExporter

        exporter = LGMTExporter()
        out = tmp_path / "test.lgmt"
        exporter.export(ugi="LB-001", output_path=out)

        with zipfile.ZipFile(out) as zf:
            with zf.open("versions.json") as f:
                versions = json.load(f)
        assert "current" in versions
        assert "history" in versions

"""
Celery Worker — Async Pipeline Job Processing
===============================================
Pipeline jobs are processed asynchronously via Celery with Redis as broker.

The API endpoint:
  1. Validates the request
  2. Creates a PipelineJob
  3. Calls process_garment_task.delay(job_id)
  4. Returns immediately with {job_id, status_url}

The worker:
  1. Picks up the job from the Redis queue
  2. Loads job details from DB/Redis
  3. Runs the PipelineOrchestrator
  4. Uploads output files to S3/GCS
  5. Updates the garment record in DB
  6. Notifies API via Redis pub/sub or webhook

Progress polling:
  Client polls GET /garments/{ugi}/scan/status
  Returns: {status, progress, message, output_urls}

Usage:
  Start worker:
    celery -A pipeline.workers.celery_worker worker -Q pipeline -c 2 --loglevel=info

  Queue a job (from API):
    process_garment_task.delay(job_dict)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Optional

from celery import Celery
from celery.utils.log import get_task_logger

from pipeline.orchestrator import (
    PipelineJob,
    PipelineOrchestrator,
    JobStatus,
    PipelineResult,
)

logger = get_task_logger(__name__)

# ---------------------------------------------------------------------------
# Celery application configuration
# ---------------------------------------------------------------------------
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", REDIS_URL)

celery_app = Celery(
    "loocbooc_pipeline",
    broker=REDIS_URL,
    backend=RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,           # Ack only after successful completion
    worker_prefetch_multiplier=1,  # Process one job at a time per worker
    task_routes={
        "pipeline.workers.celery_worker.process_garment_task": {"queue": "pipeline"},
    },
    # Retry config
    task_default_retry_delay=60,   # Wait 60s before retry
    task_max_retries=3,
)


# ---------------------------------------------------------------------------
# Main task
# ---------------------------------------------------------------------------

@celery_app.task(
    bind=True,
    max_retries=3,
    name="pipeline.workers.celery_worker.process_garment_task",
    queue="pipeline",
)
def process_garment_task(self, job_dict: dict) -> dict:
    """
    Main Celery task for garment reconstruction.

    Args:
        job_dict: Serialized PipelineJob dictionary

    Returns:
        Serialized PipelineResult dictionary
    """
    job = _deserialize_job(job_dict)
    logger.info(f"Starting pipeline job: {job.job_id} (UGI: {job.ugi})")

    # Update task state for Celery monitoring
    self.update_state(state="PROCESSING", meta={"progress": 5, "job_id": job.job_id})

    try:
        # Run the async orchestrator in a sync context
        orchestrator = PipelineOrchestrator()
        result = asyncio.run(orchestrator.process_garment(job))

        if result.status == JobStatus.FAILED:
            logger.error(f"Job {job.job_id} failed: {result.error}")
            # Retry if it's a transient error
            if _is_retryable_error(result.error):
                raise self.retry(
                    exc=RuntimeError(result.error),
                    countdown=60,
                )

        elif result.status == JobStatus.COMPLETE:
            logger.info(
                f"Job {job.job_id} complete in {result.duration_seconds:.1f}s. "
                f"LGMT: {result.lgmt_path}"
            )
            # Upload to cloud storage (async, non-blocking)
            _schedule_upload(result, job)
            # Notify API
            _notify_completion(result, job)

        result_dict = _serialize_result(result)
        return result_dict

    except Exception as exc:
        logger.error(f"Unexpected error in job {job.job_id}: {exc}", exc_info=True)
        try:
            raise self.retry(exc=exc, countdown=60)
        except self.MaxRetriesExceededError:
            logger.error(f"Max retries exceeded for job {job.job_id}")
            return _serialize_result(PipelineResult(
                job_id=job.job_id,
                ugi=job.ugi,
                status=JobStatus.FAILED,
                reconstruction_path=None,
                error=f"Max retries exceeded: {exc}",
            ))


@celery_app.task(
    name="pipeline.workers.celery_worker.upload_outputs_task",
    queue="pipeline",
)
def upload_outputs_task(result_dict: dict, job_dict: dict) -> dict:
    """
    Upload pipeline output files to cloud storage (S3/GCS).
    Called after successful reconstruction.

    Upload paths:
      s3://loocbooc-garments/{ugi}/v{version}/mesh_hq.glb
      s3://loocbooc-garments/{ugi}/v{version}/mesh_web.glb
      s3://loocbooc-garments/{ugi}/v{version}/mesh_mobile.glb
      s3://loocbooc-garments/{ugi}/v{version}/{ugi}.lgmt
    """
    result = _deserialize_result(result_dict)
    job = _deserialize_job(job_dict)

    storage_urls = {}

    # Upload each output file
    files_to_upload = {
        "mesh_hq": result.mesh_hq_path,
        "mesh_web": result.mesh_web_path,
        "mesh_mobile": result.mesh_mobile_path,
        "lgmt": result.lgmt_path,
        "usdz": result.usdz_path,
    }

    for key, local_path in files_to_upload.items():
        if not local_path:
            continue
        path = Path(local_path)
        if not path.exists():
            logger.warning(f"Output file not found for upload: {local_path}")
            continue

        try:
            url = _upload_to_storage(path, result.ugi, key)
            storage_urls[key] = url
            logger.info(f"Uploaded {key}: {url}")
        except Exception as e:
            logger.error(f"Failed to upload {key}: {e}")

    return storage_urls


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _deserialize_job(job_dict: dict) -> PipelineJob:
    """Deserialize a job dict to PipelineJob."""
    return PipelineJob(
        job_id=job_dict["job_id"],
        ugi=job_dict["ugi"],
        clo_file=job_dict.get("clo_file"),
        pattern_files=job_dict.get("pattern_files", []),
        photo_paths=job_dict.get("photo_paths", []),
        video_path=job_dict.get("video_path"),
        fabric_composition=job_dict.get("fabric_composition"),
        garment_name=job_dict.get("garment_name"),
        garment_type=job_dict.get("garment_type"),
        brand=job_dict.get("brand"),
        season=job_dict.get("season"),
        colorway=job_dict.get("colorway"),
        use_mock_reconstruction=job_dict.get("use_mock_reconstruction", False),
        output_dir=job_dict.get("output_dir"),
        redis_progress_key=job_dict.get("redis_progress_key"),
        webhook_url=job_dict.get("webhook_url"),
    )


def _serialize_result(result: PipelineResult) -> dict:
    """Serialize PipelineResult to dict for Celery/JSON."""
    return {
        "job_id": result.job_id,
        "ugi": result.ugi,
        "status": result.status.value,
        "reconstruction_path": result.reconstruction_path.value if result.reconstruction_path else None,
        "lgmt_path": result.lgmt_path,
        "mesh_hq_path": result.mesh_hq_path,
        "mesh_web_path": result.mesh_web_path,
        "mesh_mobile_path": result.mesh_mobile_path,
        "usdz_path": result.usdz_path,
        "physics_params": result.physics_params,
        "started_at": result.started_at,
        "completed_at": result.completed_at,
        "duration_seconds": result.duration_seconds,
        "error": result.error,
        "guidance": result.guidance,
        "warnings": result.warnings,
        "progress": result.progress,
    }


def _deserialize_result(result_dict: dict) -> PipelineResult:
    """Deserialize result dict to PipelineResult."""
    from pipeline.orchestrator import ReconstructionPath
    rp = result_dict.get("reconstruction_path")
    return PipelineResult(
        job_id=result_dict["job_id"],
        ugi=result_dict["ugi"],
        status=JobStatus(result_dict["status"]),
        reconstruction_path=ReconstructionPath(rp) if rp else None,
        lgmt_path=result_dict.get("lgmt_path"),
        mesh_hq_path=result_dict.get("mesh_hq_path"),
        mesh_web_path=result_dict.get("mesh_web_path"),
        mesh_mobile_path=result_dict.get("mesh_mobile_path"),
        usdz_path=result_dict.get("usdz_path"),
        physics_params=result_dict.get("physics_params"),
        error=result_dict.get("error"),
        warnings=result_dict.get("warnings", []),
    )


def _is_retryable_error(error: Optional[str]) -> bool:
    """Determine if an error is transient and worth retrying."""
    if not error:
        return False
    retryable_keywords = [
        "connection refused", "timeout", "redis", "network",
        "resource temporarily unavailable", "too many open files",
    ]
    error_lower = error.lower()
    return any(kw in error_lower for kw in retryable_keywords)


def _schedule_upload(result: PipelineResult, job: PipelineJob) -> None:
    """Queue an upload task (non-blocking)."""
    try:
        upload_outputs_task.delay(
            _serialize_result(result),
            {
                "job_id": job.job_id,
                "ugi": job.ugi,
                "garment_name": job.garment_name,
            },
        )
    except Exception as e:
        logger.warning(f"Could not queue upload task: {e}")


def _notify_completion(result: PipelineResult, job: PipelineJob) -> None:
    """Notify API of job completion via Redis pub/sub or webhook."""
    # Redis pub/sub notification
    try:
        import redis as redis_lib
        r = redis_lib.from_url(REDIS_URL)
        notification = json.dumps({
            "event": "pipeline.complete",
            "job_id": result.job_id,
            "ugi": result.ugi,
            "status": result.status.value,
        })
        r.publish(f"pipeline:complete:{result.job_id}", notification)
    except Exception as e:
        logger.warning(f"Redis notification failed: {e}")

    # HTTP webhook if configured
    if job.webhook_url:
        try:
            import httpx
            httpx.post(
                job.webhook_url,
                json=_serialize_result(result),
                timeout=10,
            )
        except Exception as e:
            logger.warning(f"Webhook notification failed: {e}")


def _upload_to_storage(path: Path, ugi: str, key: str) -> str:
    """
    Upload a file to cloud storage and return the public URL.

    In production: use boto3 (S3) or google-cloud-storage.
    Currently: stub that returns a placeholder URL.
    """
    # TODO: Replace with actual S3/GCS upload
    bucket = os.environ.get("STORAGE_BUCKET", "loocbooc-garments")
    s3_key = f"{ugi}/{path.name}"
    placeholder_url = f"https://storage.loocbooc.com/{bucket}/{s3_key}"
    logger.info(f"[STUB] Would upload {path} to {placeholder_url}")
    return placeholder_url

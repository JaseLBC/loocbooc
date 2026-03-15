"""
Celery Worker — Async Pipeline Job Processing
===============================================
Pipeline jobs are processed asynchronously via Celery with Redis as broker.

The API endpoint:
  1. Validates the request
  2. Pushes a job dict to Redis list `pipeline:jobs`
  3. Returns immediately

The worker:
  1. Background thread polls `pipeline:jobs` via BRPOP
  2. Dispatches to `process_garment_task.delay()`
  3. Runs PipelineOrchestrator with mock reconstruction (dev mode)
  4. Updates job status in Redis (QUEUED → PROCESSING → COMPLETE)
  5. Uploads placeholder .lgmt to MinIO
  6. Notifies API via PATCH /garments/{ugi} with status: active

Start worker:
  celery -A pipeline.workers.celery_worker worker -Q pipeline -c 1 --loglevel=info
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

from celery import Celery
from celery.signals import worker_ready
from celery.utils.log import get_task_logger

from pipeline.orchestrator import (
    PipelineJob,
    PipelineOrchestrator,
    JobStatus,
    PipelineResult,
)

logger = get_task_logger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", REDIS_URL)
API_BASE_URL = os.environ.get("API_BASE_URL", "http://api:8000")
PIPELINE_API_KEY = os.environ.get("PIPELINE_API_KEY", "lb_live_testkey_charcoal")
MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "http://minio:9000")
MINIO_ACCESS_KEY = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.environ.get("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.environ.get("MINIO_BUCKET", "loocbooc-dev")
PIPELINE_JOBS_QUEUE = "pipeline:jobs"

# ---------------------------------------------------------------------------
# Celery application configuration
# ---------------------------------------------------------------------------
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
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "pipeline.workers.celery_worker.process_garment_task": {"queue": "pipeline"},
    },
    task_default_retry_delay=60,
    task_max_retries=3,
)


# ---------------------------------------------------------------------------
# Background thread: poll Redis list `pipeline:jobs`
# ---------------------------------------------------------------------------

@worker_ready.connect
def start_redis_list_poller(sender, **kwargs):
    """Start background thread to poll pipeline:jobs Redis list when Celery starts."""
    thread = threading.Thread(target=_poll_redis_jobs, daemon=True, name="redis-job-poller")
    thread.start()
    logger.info(f"Started Redis list poller on queue: {PIPELINE_JOBS_QUEUE}")


def _poll_redis_jobs():
    """
    Background thread: pop jobs from the `pipeline:jobs` Redis list and
    dispatch them to the `process_garment_task` Celery task.

    The API pushes job dicts with:
      { job_id, garment_id, ugi, trigger, file_id, use_mock_reconstruction }
    """
    import redis as redis_lib

    logger.info(f"Redis job poller starting. Broker: {REDIS_URL}")
    r = None

    while True:
        try:
            if r is None:
                r = redis_lib.from_url(REDIS_URL, socket_timeout=10)
                logger.info("Redis job poller connected.")

            # BRPOP blocks until a job arrives (5s timeout to allow clean shutdown)
            result = r.brpop(PIPELINE_JOBS_QUEUE, timeout=5)

            if result:
                _, raw = result
                job_data = json.loads(raw)
                ugi = job_data.get("ugi") or job_data.get("garment_id")

                if not ugi:
                    logger.warning(f"Job missing UGI/garment_id, skipping: {job_data}")
                    continue

                # Build full PipelineJob dict for process_garment_task
                job_dict = {
                    "job_id": job_data.get("job_id") or str(uuid.uuid4()),
                    "ugi": ugi,
                    "use_mock_reconstruction": True,  # Always mock in dev
                    "photo_paths": job_data.get("photo_paths", []),
                    "pattern_files": job_data.get("pattern_files", []),
                    "clo_file": job_data.get("clo_file"),
                    "video_path": job_data.get("video_path"),
                    "fabric_composition": job_data.get("fabric_composition"),
                    "garment_name": job_data.get("garment_name", ugi),
                    "garment_type": job_data.get("garment_type"),
                    "brand": job_data.get("brand"),
                    "season": job_data.get("season"),
                    "colorway": job_data.get("colorway"),
                    "output_dir": f"/tmp/loocbooc_pipeline/{ugi}",
                    "redis_progress_key": f"pipeline:progress:{ugi}",
                }

                logger.info(f"Dispatching pipeline job for UGI: {ugi} (trigger: {job_data.get('trigger')})")
                process_garment_task.delay(job_dict)

                # Update Redis status to QUEUED
                _update_progress(ugi, "QUEUED", 0, "Job queued for processing")

        except KeyboardInterrupt:
            logger.info("Redis job poller shutting down.")
            break
        except redis_lib.exceptions.ConnectionError as e:
            logger.warning(f"Redis connection lost in poller: {e}. Reconnecting in 5s...")
            r = None
            time.sleep(5)
        except Exception as e:
            logger.error(f"Redis poller unexpected error: {e}", exc_info=True)
            time.sleep(2)


def _update_progress(ugi: str, status: str, progress: int, message: str):
    """Update pipeline progress in Redis."""
    try:
        import redis as redis_lib
        r = redis_lib.from_url(REDIS_URL, decode_responses=True)
        data = {
            "ugi": ugi,
            "status": status,
            "progress": progress,
            "message": message,
            "updated_at": time.time(),
        }
        r.setex(f"pipeline:progress:{ugi}", 86400, json.dumps(data))
    except Exception as e:
        logger.warning(f"Progress update failed for {ugi}: {e}")


# ---------------------------------------------------------------------------
# Main Celery task
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
    Uses MockPhotogrammetryReconstructor in dev mode (no COLMAP required).
    """
    job = _deserialize_job(job_dict)
    logger.info(f"Starting pipeline job: {job.job_id} (UGI: {job.ugi})")

    _update_progress(job.ugi, "PROCESSING", 5, "Starting reconstruction")
    self.update_state(state="PROCESSING", meta={"progress": 5, "job_id": job.job_id})

    try:
        orchestrator = PipelineOrchestrator()
        result = asyncio.run(orchestrator.process_garment(job))

        if result.status == JobStatus.FAILED:
            logger.error(f"Job {job.job_id} failed: {result.error}")
            _update_progress(job.ugi, "FAILED", 0, f"Failed: {result.error}")
            if _is_retryable_error(result.error):
                raise self.retry(exc=RuntimeError(result.error), countdown=60)

        elif result.status in (JobStatus.COMPLETE, JobStatus.INSUFFICIENT_DATA):
            if result.status == JobStatus.COMPLETE:
                logger.info(f"Job {job.job_id} complete in {result.duration_seconds:.1f}s")
                _update_progress(job.ugi, "COMPLETE", 100, "Reconstruction complete")

                # Upload .lgmt placeholder to MinIO
                _upload_lgmt_to_minio(result, job)

                # Notify API: update garment status to active
                _notify_api_complete(result, job)
            else:
                _update_progress(job.ugi, "INSUFFICIENT_DATA", 0, "Insufficient input data")

        return _serialize_result(result)

    except Exception as exc:
        logger.error(f"Unexpected error in job {job.job_id}: {exc}", exc_info=True)
        _update_progress(job.ugi, "FAILED", 0, f"Error: {exc}")
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


# ---------------------------------------------------------------------------
# MinIO upload
# ---------------------------------------------------------------------------

def _upload_lgmt_to_minio(result: PipelineResult, job: PipelineJob) -> str | None:
    """Upload the .lgmt file (or a placeholder) to MinIO."""
    try:
        import boto3
        from botocore.client import Config

        # Use actual lgmt_path if produced, else create a placeholder
        lgmt_content = None
        if result.lgmt_path and Path(result.lgmt_path).exists():
            lgmt_content = Path(result.lgmt_path).read_bytes()
        else:
            # Placeholder LGMT for dev/mock
            placeholder = {
                "ugi": result.ugi,
                "version": 1,
                "status": "mock",
                "mesh_paths": {},
                "physics_params": result.physics_params or {},
                "warnings": result.warnings,
                "generated_at": time.time(),
            }
            lgmt_content = json.dumps(placeholder, indent=2).encode("utf-8")

        s3 = boto3.client(
            "s3",
            endpoint_url=MINIO_ENDPOINT,
            aws_access_key_id=MINIO_ACCESS_KEY,
            aws_secret_access_key=MINIO_SECRET_KEY,
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )

        key = f"garments/{result.ugi}/{result.ugi}.lgmt"
        s3.put_object(
            Bucket=MINIO_BUCKET,
            Key=key,
            Body=lgmt_content,
            ContentType="application/json",
        )

        url = f"{MINIO_ENDPOINT}/{MINIO_BUCKET}/{key}"
        logger.info(f"Uploaded .lgmt to MinIO: {url}")
        return url

    except Exception as e:
        logger.warning(f"LGMT upload to MinIO failed (non-fatal): {e}")
        return None


# ---------------------------------------------------------------------------
# API notification
# ---------------------------------------------------------------------------

def _notify_api_complete(result: PipelineResult, job: PipelineJob) -> None:
    """Notify API of completion: PATCH garment status to active."""
    # HTTP PATCH to update garment status
    try:
        import httpx

        url = f"{API_BASE_URL}/api/v1/garments/{result.ugi}"
        response = httpx.patch(
            url,
            json={"status": "active"},
            headers={
                "X-API-Key": PIPELINE_API_KEY,
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        if response.status_code in (200, 204):
            logger.info(f"Updated garment {result.ugi} status → active")
        else:
            logger.warning(
                f"API status update returned {response.status_code}: {response.text[:200]}"
            )
    except Exception as e:
        logger.warning(f"API status update failed (non-fatal): {e}")

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
        logger.warning(f"Redis pub/sub notification failed: {e}")


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _deserialize_job(job_dict: dict) -> PipelineJob:
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
        use_mock_reconstruction=job_dict.get("use_mock_reconstruction", True),
        output_dir=job_dict.get("output_dir"),
        redis_progress_key=job_dict.get("redis_progress_key"),
        webhook_url=job_dict.get("webhook_url"),
    )


def _serialize_result(result: PipelineResult) -> dict:
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
    if not error:
        return False
    retryable_keywords = [
        "connection refused", "timeout", "redis", "network",
        "resource temporarily unavailable", "too many open files",
    ]
    error_lower = error.lower()
    return any(kw in error_lower for kw in retryable_keywords)

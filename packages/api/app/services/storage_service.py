"""
Storage service — abstracts S3/GCS/local storage.
All garment files are stored here.
"""
import logging
import os
import uuid
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


def _get_storage_key(garment_id: str, filename: str, file_type: str) -> str:
    """Generate a storage key for a garment file."""
    safe_filename = filename.replace(" ", "_")
    return f"garments/{garment_id}/{file_type}/{uuid.uuid4().hex}_{safe_filename}"


async def upload_file(
    content: bytes,
    filename: str,
    mime_type: str,
    garment_id: str,
    file_type: str,
) -> tuple[str, str | None]:
    """
    Upload a file to storage.

    Returns:
        (storage_key, public_url)
        public_url is None if using private storage.
    """
    storage_key = _get_storage_key(garment_id, filename, file_type)

    if settings.STORAGE_BACKEND == "local":
        return await _upload_local(content, storage_key)
    elif settings.STORAGE_BACKEND == "s3":
        return await _upload_s3(content, storage_key, mime_type)
    elif settings.STORAGE_BACKEND == "gcs":
        return await _upload_gcs(content, storage_key, mime_type)
    else:
        raise ValueError(f"Unknown storage backend: {settings.STORAGE_BACKEND}")


async def _upload_local(content: bytes, storage_key: str) -> tuple[str, None]:
    """Write file to local filesystem for development."""
    base_path = Path(settings.LOCAL_STORAGE_PATH)
    file_path = base_path / storage_key
    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(file_path, "wb") as f:
        f.write(content)

    logger.debug(f"Stored file locally: {file_path}")
    return storage_key, None


async def _upload_s3(content: bytes, storage_key: str, mime_type: str) -> tuple[str, str]:
    """Upload to AWS S3."""
    try:
        import boto3
        from botocore.exceptions import ClientError

        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )

        s3.put_object(
            Bucket=settings.STORAGE_BUCKET,
            Key=storage_key,
            Body=content,
            ContentType=mime_type,
        )

        url = f"https://{settings.STORAGE_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{storage_key}"
        logger.info(f"Uploaded to S3: {storage_key}")
        return storage_key, url

    except Exception as e:
        logger.error(f"S3 upload failed: {e}")
        raise


async def _upload_gcs(content: bytes, storage_key: str, mime_type: str) -> tuple[str, str]:
    """Upload to Google Cloud Storage."""
    try:
        from google.cloud import storage as gcs_storage

        client = gcs_storage.Client()
        bucket = client.bucket(settings.STORAGE_BUCKET)
        blob = bucket.blob(storage_key)
        blob.upload_from_string(content, content_type=mime_type)

        url = f"https://storage.googleapis.com/{settings.STORAGE_BUCKET}/{storage_key}"
        logger.info(f"Uploaded to GCS: {storage_key}")
        return storage_key, url

    except Exception as e:
        logger.error(f"GCS upload failed: {e}")
        raise


async def get_file(storage_key: str) -> bytes | None:
    """Retrieve a file from storage."""
    if settings.STORAGE_BACKEND == "local":
        file_path = Path(settings.LOCAL_STORAGE_PATH) / storage_key
        if not file_path.exists():
            return None
        return file_path.read_bytes()
    elif settings.STORAGE_BACKEND == "s3":
        import boto3
        s3 = boto3.client("s3")
        try:
            response = s3.get_object(Bucket=settings.STORAGE_BUCKET, Key=storage_key)
            return response["Body"].read()
        except Exception:
            return None
    return None


async def delete_file(storage_key: str) -> bool:
    """Delete a file from storage."""
    if settings.STORAGE_BACKEND == "local":
        file_path = Path(settings.LOCAL_STORAGE_PATH) / storage_key
        if file_path.exists():
            file_path.unlink()
            return True
        return False
    elif settings.STORAGE_BACKEND == "s3":
        import boto3
        s3 = boto3.client("s3")
        try:
            s3.delete_object(Bucket=settings.STORAGE_BUCKET, Key=storage_key)
            return True
        except Exception:
            return False
    return False

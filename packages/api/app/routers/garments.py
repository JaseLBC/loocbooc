"""
Garment endpoints.
The core of the Loocbooc API — garment creation, retrieval, file uploads.
"""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import AuthContext, get_auth_context, require_api_key, require_auth
from app.models.garment import (
    Garment,
    GarmentCategory,
    GarmentFile,
    GarmentFileType,
    GarmentStatus,
)
from app.redis import cache
from app.schemas.garment import (
    GarmentCreate,
    GarmentListResponse,
    GarmentResponse,
    GarmentUpdate,
    UGIParseResponse,
)
from app.services import garment_service, storage_service
from app.services.uuid_service import parse_ugi, validate_ugi
from app.utils.pagination import PaginationParams, get_pagination, paginate_response

router = APIRouter(prefix="/garments", tags=["garments"])
logger = logging.getLogger(__name__)

# Allowed file extensions and their types
FILE_TYPE_MAP = {
    "image/jpeg": GarmentFileType.PHOTO,
    "image/png": GarmentFileType.PHOTO,
    "image/webp": GarmentFileType.PHOTO,
    "video/mp4": GarmentFileType.VIDEO,
    "application/postscript": GarmentFileType.PATTERN_AI,
    "image/vnd.dxf": GarmentFileType.PATTERN_DXF,
    "application/dxf": GarmentFileType.PATTERN_DXF,
}

EXTENSION_TYPE_MAP = {
    ".jpg": GarmentFileType.PHOTO,
    ".jpeg": GarmentFileType.PHOTO,
    ".png": GarmentFileType.PHOTO,
    ".webp": GarmentFileType.PHOTO,
    ".mp4": GarmentFileType.VIDEO,
    ".ai": GarmentFileType.PATTERN_AI,
    ".dxf": GarmentFileType.PATTERN_DXF,
    ".zprj": GarmentFileType.CLO3D,
    ".avt": GarmentFileType.MARVELOUS,
    ".pdf": GarmentFileType.TECH_PACK,
}

MAX_FILE_SIZE_BYTES = settings.MAX_FILE_SIZE_MB * 1024 * 1024


@router.post("/", response_model=GarmentResponse, status_code=status.HTTP_201_CREATED)
async def create_garment(
    data: GarmentCreate,
    auth: AuthContext = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new garment.

    Requires API key authentication. The brand associated with the API key
    is used automatically — no need to specify brand_id in the request.

    Returns the full garment object including the generated UGI.
    """
    if not auth.brand:
        raise HTTPException(status_code=400, detail="API key is not associated with a brand")

    garment = await garment_service.create_garment(
        db=db,
        brand=auth.brand,
        data=data,
        created_by=f"api_key:{auth.brand_id}",
    )
    await db.refresh(garment)
    return garment


@router.get("/", response_model=GarmentListResponse)
async def list_garments(
    brand_id: str | None = Query(None),
    status_filter: GarmentStatus | None = Query(None, alias="status"),
    category: GarmentCategory | None = Query(None),
    pagination: PaginationParams = Depends(get_pagination),
    auth: AuthContext | None = Depends(get_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    List garments. Authenticated users see all statuses; public requests see only active garments.
    """
    if not auth:
        # Force active-only for public
        status_filter = GarmentStatus.ACTIVE

    garments, total = await garment_service.list_garments(
        db=db,
        brand_id=brand_id,
        status=status_filter,
        category=category,
        page=pagination.page,
        page_size=pagination.page_size,
    )

    items = [GarmentResponse.model_validate(g) for g in garments]
    return paginate_response(items, total, pagination)


@router.get("/validate/{ugi}", response_model=UGIParseResponse)
async def validate_and_parse_ugi(ugi: str):
    """
    Validate and parse a UGI string without looking it up in the database.
    Useful for client-side validation.
    """
    parsed = parse_ugi(ugi)
    return UGIParseResponse(
        ugi=parsed.ugi,
        brand_code=parsed.brand_code,
        category_code=parsed.category_code,
        category=parsed.category or "unknown",
        timestamp_ms=parsed.timestamp_ms,
        created_at=parsed.created_at,
        checksum=parsed.checksum,
        is_valid=parsed.is_valid,
    )


@router.get("/{ugi}", response_model=GarmentResponse)
async def get_garment(
    ugi: str,
    auth: AuthContext | None = Depends(get_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Get a garment by its UGI.

    Public: only active garments visible (cached 5min).
    Authenticated: any status visible (cached 30s).
    """
    is_authenticated = auth is not None

    cached = await garment_service.get_garment_cached(db, ugi.upper(), is_authenticated)
    if cached is not None:
        return cached

    # Not cached and not found
    raise HTTPException(status_code=404, detail=f"Garment {ugi!r} not found")


@router.patch("/{ugi}", response_model=GarmentResponse)
async def update_garment(
    ugi: str,
    data: GarmentUpdate,
    auth: AuthContext = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Update garment fields. Creates a new version in the audit trail."""
    garment = await garment_service.get_garment_by_ugi(db, ugi.upper())
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")

    # Brand auth: only the owning brand can update
    if auth.auth_type == "api_key" and garment.brand_id != auth.brand_id:
        raise HTTPException(status_code=403, detail="Access denied")

    garment = await garment_service.update_garment(
        db=db,
        garment=garment,
        data=data,
        updated_by=auth.brand_id or auth.user_id or "unknown",
    )
    await db.refresh(garment)
    return GarmentResponse.model_validate(garment)


@router.post("/{ugi}/files", status_code=status.HTTP_201_CREATED)
async def upload_garment_file(
    ugi: str,
    file: UploadFile = File(...),
    is_primary: bool = Form(default=False),
    auth: AuthContext = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a file for a garment.

    Accepts: photos (JPEG/PNG/WebP), video (MP4), pattern files (AI, DXF),
    CLO3D (.zprj), Marvelous Designer (.avt), tech packs (PDF).

    Automatically triggers 3D pipeline if ≥8 photos or pattern file uploaded.
    """
    garment = await garment_service.get_garment_by_ugi(db, ugi.upper(), include_files=True)
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")

    if auth.auth_type == "api_key" and garment.brand_id != auth.brand_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Validate file size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE_MB}MB",
        )

    # Determine file type from extension
    filename = file.filename or "upload"
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    file_type = EXTENSION_TYPE_MAP.get(ext)

    if file_type is None:
        # Try MIME type as fallback
        mime = file.content_type or ""
        file_type = FILE_TYPE_MAP.get(mime, GarmentFileType.OTHER)

    # Validate acceptable types
    if ext and ext not in EXTENSION_TYPE_MAP:
        raise HTTPException(
            status_code=415,
            detail=f"File type {ext!r} not supported. "
            "Accepted: .jpg, .jpeg, .png, .webp, .mp4, .ai, .dxf, .zprj, .avt, .pdf",
        )

    # Upload to storage
    storage_key, storage_url = await storage_service.upload_file(
        content=content,
        filename=filename,
        mime_type=file.content_type or "application/octet-stream",
        garment_id=garment.id,
        file_type=file_type.value,
    )

    # Create file record
    garment_file = GarmentFile(
        garment_id=garment.id,
        file_type=file_type,
        original_filename=filename,
        storage_key=storage_key,
        storage_url=storage_url,
        mime_type=file.content_type or "application/octet-stream",
        file_size_bytes=len(content),
        is_primary=is_primary,
        processing_status="pending",
    )
    db.add(garment_file)
    await db.flush()

    # Invalidate cache
    await cache.delete("garment", "public", garment.id)
    await cache.delete("garment", "auth", garment.id)

    # Check if we should trigger 3D pipeline
    pipeline_triggered = False
    if file_type in (GarmentFileType.PATTERN_AI, GarmentFileType.PATTERN_DXF,
                     GarmentFileType.CLO3D, GarmentFileType.MARVELOUS):
        # Pattern or 3D file — trigger pipeline immediately
        await _trigger_pipeline(garment.id, "pattern_file", garment_file.id)
        pipeline_triggered = True
    elif file_type == GarmentFileType.PHOTO:
        photo_count = await garment_service.count_garment_files_by_type(
            db, garment.id, GarmentFileType.PHOTO.value
        )
        if photo_count >= settings.PIPELINE_MIN_PHOTOS:
            await _trigger_pipeline(garment.id, "photo_threshold", garment_file.id)
            pipeline_triggered = True

    logger.info(
        f"Uploaded {file_type.value} for garment {ugi}: {filename} ({len(content)} bytes)"
        + (" — pipeline triggered" if pipeline_triggered else "")
    )

    return {
        "id": garment_file.id,
        "garment_id": garment.id,
        "file_type": file_type.value,
        "filename": filename,
        "size_bytes": len(content),
        "storage_key": storage_key,
        "pipeline_triggered": pipeline_triggered,
    }


async def _trigger_pipeline(garment_id: str, trigger: str, file_id: str):
    """Push a job to the 3D pipeline queue.

    Note: garment_id IS the UGI (e.g. LB-CHAR-DR-K9F3M2A1-X7Q).
    The pipeline worker uses BRPOP to consume from this queue.
    """
    import uuid as _uuid
    from app.redis import cache
    await cache.push_job(
        settings.PIPELINE_JOB_QUEUE,
        {
            "job_id": str(_uuid.uuid4()),
            "garment_id": garment_id,   # This IS the UGI
            "ugi": garment_id,          # Explicit UGI field for pipeline worker
            "trigger": trigger,
            "file_id": file_id,
            "use_mock_reconstruction": True,  # Always use mock in dev
        },
    )
    logger.info(f"Triggered 3D pipeline for garment {garment_id} (trigger: {trigger})")

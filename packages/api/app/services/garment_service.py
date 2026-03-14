"""
Garment service — business logic for garment creation, retrieval, and management.
Coordinates UGI generation, caching, and audit trail.
"""
import logging
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.garment import Garment, GarmentCategory, GarmentFile, GarmentStatus, GarmentVersion
from app.models.brand import Brand
from app.redis import cache
from app.schemas.garment import GarmentCreate, GarmentUpdate
from app.services.uuid_service import generate_unique_ugi

logger = logging.getLogger(__name__)


async def get_brand_by_id(db: AsyncSession, brand_id: str) -> Brand | None:
    result = await db.execute(select(Brand).where(Brand.id == brand_id))
    return result.scalar_one_or_none()


async def create_garment(
    db: AsyncSession,
    brand: Brand,
    data: GarmentCreate,
    created_by: str = "api",
) -> Garment:
    """
    Create a new garment with a generated UGI.

    Steps:
    1. Validate brand is active
    2. Generate unique UGI
    3. Create garment record
    4. Create initial version (audit trail)
    """
    if not brand.is_active:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Brand is not active")

    # Generate UGI
    ugi = await generate_unique_ugi(db, brand.brand_code, data.category)

    garment = Garment(
        id=ugi,
        brand_id=brand.id,
        status=GarmentStatus.DRAFT,
        category=data.category,
        name=data.name,
        description=data.description,
        sku=data.sku,
        metadata_=data.metadata,
        dpp_data=data.dpp_data,
        size_chart={},
    )
    db.add(garment)
    await db.flush()

    # Create initial version
    version = GarmentVersion(
        garment_id=garment.id,
        version_number=1,
        changed_by=created_by,
        change_type="created",
        diff={},
        snapshot={
            "name": garment.name,
            "category": garment.category.value,
            "status": garment.status.value,
            "description": garment.description,
        },
    )
    db.add(version)
    await db.flush()

    logger.info(f"Created garment {ugi} for brand {brand.brand_code}")
    return garment


async def get_garment_by_ugi(
    db: AsyncSession,
    ugi: str,
    include_files: bool = True,
    include_physics: bool = True,
) -> Garment | None:
    """Fetch a garment by UGI with optional related data."""
    query = select(Garment).where(Garment.id == ugi.upper())

    if include_files or include_physics:
        opts = []
        if include_files:
            opts.append(selectinload(Garment.files))
        if include_physics:
            opts.append(selectinload(Garment.fabric_physics))
        query = query.options(*opts)

    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_garment_cached(
    db: AsyncSession,
    ugi: str,
    is_authenticated: bool = False,
) -> dict | None:
    """
    Get garment data, using Redis cache.
    Authenticated users see all statuses (cached 30s).
    Public requests only see active garments (cached 5min).
    """
    cache_key = ("garment", "auth" if is_authenticated else "public", ugi)
    cached = await cache.get(*cache_key)
    if cached is not None:
        return cached

    garment = await get_garment_by_ugi(db, ugi)
    if garment is None:
        return None

    if not is_authenticated and garment.status != GarmentStatus.ACTIVE:
        return None

    # Serialize to dict for caching
    from app.schemas.garment import GarmentResponse
    response_data = GarmentResponse.model_validate(garment).model_dump(mode="json")

    ttl = (
        settings.CACHE_TTL_DRAFT_GARMENT
        if garment.status != GarmentStatus.ACTIVE
        else settings.CACHE_TTL_PUBLIC_GARMENT
    )
    await cache.set(*cache_key, value=response_data, ttl=ttl)

    return response_data


async def update_garment(
    db: AsyncSession,
    garment: Garment,
    data: GarmentUpdate,
    updated_by: str = "api",
) -> Garment:
    """Update garment fields and create a new version record."""
    diff = {}
    old_snapshot = {
        "name": garment.name,
        "status": garment.status.value,
        "description": garment.description,
    }

    for field, value in data.model_dump(exclude_none=True).items():
        old_value = getattr(garment, field if field != "metadata" else "metadata_", None)
        if old_value != value:
            diff[field] = {"old": old_value, "new": value}
            if field == "metadata":
                garment.metadata_ = value
            else:
                setattr(garment, field, value)

    if diff:
        # Get current version number
        result = await db.execute(
            select(func.max(GarmentVersion.version_number)).where(
                GarmentVersion.garment_id == garment.id
            )
        )
        current_version = result.scalar() or 0

        version = GarmentVersion(
            garment_id=garment.id,
            version_number=current_version + 1,
            changed_by=updated_by,
            change_type="update",
            diff=diff,
            snapshot={**old_snapshot, **{k: v["new"] for k, v in diff.items()}},
        )
        db.add(version)
        await db.flush()

        # Invalidate cache
        await cache.delete("garment", "public", garment.id)
        await cache.delete("garment", "auth", garment.id)

    return garment


async def list_garments(
    db: AsyncSession,
    brand_id: str | None = None,
    status: GarmentStatus | None = None,
    category: GarmentCategory | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Garment], int]:
    """List garments with filtering and pagination."""
    query = select(Garment).options(
        selectinload(Garment.files),
        selectinload(Garment.fabric_physics),
    )

    if brand_id:
        query = query.where(Garment.brand_id == brand_id)
    if status:
        query = query.where(Garment.status == status)
    if category:
        query = query.where(Garment.category == category)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(Garment.created_at.desc())

    result = await db.execute(query)
    garments = result.scalars().all()

    return list(garments), total


async def count_garment_files_by_type(
    db: AsyncSession,
    garment_id: str,
    file_type: str,
) -> int:
    """Count files of a specific type for a garment."""
    result = await db.execute(
        select(func.count())
        .select_from(GarmentFile)
        .where(
            GarmentFile.garment_id == garment_id,
            GarmentFile.file_type == file_type,
        )
    )
    return result.scalar() or 0

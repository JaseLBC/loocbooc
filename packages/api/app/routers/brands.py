"""Brand management endpoints."""
import hashlib
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import AuthContext, require_auth
from app.models.brand import APIKey, Brand
from app.schemas.brand import (
    APIKeyCreate,
    APIKeyCreateResponse,
    APIKeyResponse,
    BrandCreate,
    BrandResponse,
    BrandUpdate,
)

router = APIRouter(prefix="/brands", tags=["brands"])
logger = logging.getLogger(__name__)


@router.post("/", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
async def create_brand(
    data: BrandCreate,
    db: AsyncSession = Depends(get_db),
    # In production this would require admin auth — relaxed for dev/testing
):
    """Create a new brand."""
    # Check brand_code uniqueness
    existing = await db.execute(
        select(Brand).where(Brand.brand_code == data.brand_code.upper())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Brand code {data.brand_code!r} is already taken",
        )

    # Check slug uniqueness
    slug_check = await db.execute(select(Brand).where(Brand.slug == data.slug))
    if slug_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Slug {data.slug!r} is already taken",
        )

    brand = Brand(
        brand_code=data.brand_code.upper(),
        name=data.name,
        slug=data.slug,
        website=data.website,
        country=data.country,
    )
    db.add(brand)
    await db.flush()
    await db.refresh(brand)

    logger.info(f"Created brand {brand.brand_code}: {brand.name}")
    return brand


@router.get("/{brand_id}", response_model=BrandResponse)
async def get_brand(
    brand_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a brand by ID."""
    result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return brand


@router.patch("/{brand_id}", response_model=BrandResponse)
async def update_brand(
    brand_id: str,
    data: BrandUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update brand details."""
    result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(brand, field, value)

    await db.flush()
    await db.refresh(brand)
    return brand


@router.post("/{brand_id}/api-keys", response_model=APIKeyCreateResponse, status_code=201)
async def create_api_key(
    brand_id: str,
    data: APIKeyCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create an API key for a brand.
    The raw key is returned ONCE. Store it securely — it cannot be retrieved again.
    """
    result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    raw_key = APIKey.generate_key()
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = raw_key[:16]

    api_key = APIKey(
        brand_id=brand_id,
        key_hash=key_hash,
        key_prefix=key_prefix,
        name=data.name,
    )
    db.add(api_key)
    await db.flush()
    await db.refresh(api_key)

    logger.info(f"Created API key {key_prefix}... for brand {brand.brand_code}")

    return APIKeyCreateResponse(
        id=api_key.id,
        brand_id=api_key.brand_id,
        key_prefix=api_key.key_prefix,
        name=api_key.name,
        is_active=api_key.is_active,
        last_used_at=api_key.last_used_at,
        expires_at=api_key.expires_at,
        created_at=api_key.created_at,
        raw_key=raw_key,
    )


@router.get("/{brand_id}/api-keys", response_model=list[APIKeyResponse])
async def list_api_keys(
    brand_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List API keys for a brand (without the raw key)."""
    result = await db.execute(
        select(APIKey).where(APIKey.brand_id == brand_id, APIKey.is_active == True)  # noqa
    )
    return result.scalars().all()

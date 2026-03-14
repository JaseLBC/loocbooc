"""Avatar endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.avatar import Avatar, AvatarMeasurement
from app.schemas.avatar import AvatarCreate, AvatarResponse

router = APIRouter(prefix="/avatars", tags=["avatars"])
logger = logging.getLogger(__name__)


@router.post("/", response_model=AvatarResponse, status_code=status.HTTP_201_CREATED)
async def create_avatar(
    data: AvatarCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create an avatar from body measurements or body scan data.

    Accepts:
    - Manual measurements (height, weight, chest, waist, hips, etc.)
    - Body scan data from mobile (scan_source: mobile_scan or lidar)

    The avatar ID can be used to perform try-ons against any garment.
    """
    avatar = Avatar(
        name=data.name,
        gender=data.gender,
        age_range=data.age_range,
        scan_source=data.scan_source,
        scan_data=data.scan_data,
    )
    db.add(avatar)
    await db.flush()

    # Create measurements record
    m = data.measurements
    measurement = AvatarMeasurement(
        avatar_id=avatar.id,
        is_current=True,
        height_cm=m.height_cm,
        weight_kg=m.weight_kg,
        chest_cm=m.chest_cm,
        waist_cm=m.waist_cm,
        hips_cm=m.hips_cm,
        inseam_cm=m.inseam_cm,
        shoulder_width_cm=m.shoulder_width_cm,
        sleeve_length_cm=m.sleeve_length_cm,
        neck_cm=m.neck_cm,
        thigh_cm=m.thigh_cm,
        extended_measurements=m.extended_measurements,
    )
    db.add(measurement)
    await db.flush()
    await db.refresh(avatar)

    # Load relationships
    result = await db.execute(
        select(Avatar)
        .options(selectinload(Avatar.measurements))
        .where(Avatar.id == avatar.id)
    )
    avatar = result.scalar_one()

    logger.info(f"Created avatar {avatar.id} ({data.scan_source})")
    return avatar


@router.get("/{avatar_id}", response_model=AvatarResponse)
async def get_avatar(
    avatar_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get an avatar by ID."""
    result = await db.execute(
        select(Avatar)
        .options(selectinload(Avatar.measurements))
        .where(Avatar.id == avatar_id, Avatar.is_active == True)  # noqa
    )
    avatar = result.scalar_one_or_none()
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar not found")
    return avatar

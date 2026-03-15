"""
Avatar endpoints — Avatar Module v2.

Endpoints:
  POST   /avatars                          — create from manual measurements
  GET    /avatars/{id}                     — retrieve avatar
  PUT    /avatars/{id}/measurements        — update measurements
  POST   /avatars/{id}/photo-scan          — extract measurements from photos
  GET    /avatars/{id}/fit-recommendations — fit recommendations across garments
"""
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.avatar import Avatar, AvatarMeasurement
from app.models.garment import Garment, GarmentStatus
from app.schemas.avatar import (
    AvatarCreate,
    AvatarMeasurementsInput,
    AvatarResponse,
    AvatarUpdateFitPreferences,
    AvatarUpdateMeasurements,
    FitRecommendationItem,
    FitRecommendationsResponse,
    PhotoScanResult,
    ZoneFitResponse,
)
from app.services.fit_scoring import (
    classify_body_type,
    fit_result_to_api_response,
    score_fit,
)
from app.services.photo_measurement import extract_measurements_from_photos

router = APIRouter(prefix="/avatars", tags=["avatars"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_active_avatar(avatar_id: str, db: AsyncSession) -> Avatar:
    result = await db.execute(
        select(Avatar)
        .options(selectinload(Avatar.measurements))
        .where(Avatar.id == avatar_id, Avatar.is_active == True)  # noqa: E712
    )
    avatar = result.scalar_one_or_none()
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar not found")
    return avatar


def _current_measurement(avatar: Avatar) -> AvatarMeasurement | None:
    return next(
        (m for m in avatar.measurements if m.is_current),
        avatar.measurements[0] if avatar.measurements else None,
    )


def _measurement_to_dict(m: AvatarMeasurement | None) -> dict:
    if m is None:
        return {}
    return {
        "height_cm": m.height_cm,
        "weight_kg": m.weight_kg,
        "chest_cm": m.chest_cm,
        "waist_cm": m.waist_cm,
        "hips_cm": m.hips_cm,
        "inseam_cm": m.inseam_cm,
        "shoulder_width_cm": m.shoulder_width_cm,
        "sleeve_length_cm": m.sleeve_length_cm,
        "arm_length_cm": m.arm_length_cm,
        "torso_length_cm": m.torso_length_cm,
        "neck_cm": m.neck_cm,
        "thigh_cm": m.thigh_cm,
    }


def _derive_body_type(m: AvatarMeasurementsInput) -> str | None:
    return classify_body_type(
        chest_cm=m.chest_cm,
        waist_cm=m.waist_cm,
        hips_cm=m.hips_cm,
        shoulder_width_cm=m.shoulder_width_cm,
    )


async def _save_measurement(
    avatar_id: str,
    m: AvatarMeasurementsInput,
    db: AsyncSession,
) -> AvatarMeasurement:
    """Mark all existing measurements as not current, then insert new one."""
    await db.execute(
        update(AvatarMeasurement)
        .where(AvatarMeasurement.avatar_id == avatar_id)
        .values(is_current=False)
    )

    body_type = _derive_body_type(m)

    measurement = AvatarMeasurement(
        avatar_id=avatar_id,
        is_current=True,
        height_cm=m.height_cm,
        weight_kg=m.weight_kg,
        chest_cm=m.chest_cm,
        waist_cm=m.waist_cm,
        hips_cm=m.hips_cm,
        inseam_cm=m.inseam_cm,
        shoulder_width_cm=m.shoulder_width_cm,
        sleeve_length_cm=m.sleeve_length_cm,
        arm_length_cm=m.arm_length_cm,
        neck_cm=m.neck_cm,
        thigh_cm=m.thigh_cm,
        torso_length_cm=m.torso_length_cm,
        body_type=body_type,
        measurement_source=m.measurement_source,
        confidence_score=m.confidence_score,
        extended_measurements=m.extended_measurements,
    )
    db.add(measurement)
    return measurement


# ---------------------------------------------------------------------------
# POST /avatars — create from manual measurements
# ---------------------------------------------------------------------------

@router.post("/", response_model=AvatarResponse, status_code=status.HTTP_201_CREATED)
async def create_avatar(
    data: AvatarCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create an avatar from body measurements.

    Accepts manual measurements and optional fit preferences.
    Body type is automatically classified from chest/waist/hip measurements.
    """
    body_type = _derive_body_type(data.measurements)

    avatar = Avatar(
        name=data.name,
        gender=data.gender,
        age_range=data.age_range,
        scan_source=data.scan_source,
        scan_data=data.scan_data,
        body_type=body_type,
        fit_preference=data.fit_preference.model_dump(),
        style_profile=data.style_profile.model_dump(),
        size_history={},
    )
    db.add(avatar)
    await db.flush()

    await _save_measurement(avatar.id, data.measurements, db)
    await db.flush()

    result = await db.execute(
        select(Avatar)
        .options(selectinload(Avatar.measurements))
        .where(Avatar.id == avatar.id)
    )
    avatar = result.scalar_one()

    logger.info("Created avatar %s (%s) body_type=%s", avatar.id, data.scan_source, body_type)
    return avatar


# ---------------------------------------------------------------------------
# GET /avatars/{id}
# ---------------------------------------------------------------------------

@router.get("/{avatar_id}", response_model=AvatarResponse)
async def get_avatar(
    avatar_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve an avatar with all measurements."""
    return await _get_active_avatar(avatar_id, db)


# ---------------------------------------------------------------------------
# PUT /avatars/{id}/measurements
# ---------------------------------------------------------------------------

@router.put("/{avatar_id}/measurements", response_model=AvatarResponse)
async def update_measurements(
    avatar_id: str,
    data: AvatarUpdateMeasurements,
    db: AsyncSession = Depends(get_db),
):
    """
    Update avatar measurements.

    Creates a new measurement record (versioned).
    Old measurements are retained for historical try-on accuracy.
    Also updates body type classification.
    """
    avatar = await _get_active_avatar(avatar_id, db)

    body_type = _derive_body_type(data.measurements)

    await _save_measurement(avatar_id, data.measurements, db)

    # Update body type on avatar
    await db.execute(
        update(Avatar)
        .where(Avatar.id == avatar_id)
        .values(body_type=body_type)
    )
    await db.flush()

    result = await db.execute(
        select(Avatar)
        .options(selectinload(Avatar.measurements))
        .where(Avatar.id == avatar_id)
    )
    updated = result.scalar_one()
    logger.info("Updated measurements for avatar %s, body_type=%s", avatar_id, body_type)
    return updated


# ---------------------------------------------------------------------------
# POST /avatars/{id}/photo-scan
# ---------------------------------------------------------------------------

@router.post("/{avatar_id}/photo-scan", response_model=PhotoScanResult)
async def photo_scan(
    avatar_id: str,
    height_cm: float = Form(..., gt=50, lt=300, description="Height in cm for calibration"),
    front_photo: UploadFile = File(..., description="Front-facing photo"),
    side_photo: UploadFile = File(..., description="Side-facing photo"),
    db: AsyncSession = Depends(get_db),
):
    """
    Extract body measurements from 2 photos using MediaPipe Pose estimation.

    Requires:
    - front_photo: full body, front-facing, good lighting
    - side_photo: full body, side-facing, good lighting
    - height_cm: known height for pixel-to-cm calibration

    Returns extracted measurements with per-field confidence scores.
    If MediaPipe is not available, returns fallback_required=True with clear guidance.

    After receiving measurements, call PUT /avatars/{id}/measurements to save them.
    The caller may override any measurement before saving (Step 3 in the UI flow).
    """
    await _get_active_avatar(avatar_id, db)  # Validate avatar exists

    front_bytes = await front_photo.read()
    side_bytes = await side_photo.read()

    result = extract_measurements_from_photos(
        front_image_bytes=front_bytes,
        side_image_bytes=side_bytes,
        height_cm=height_cm,
    )

    # Classify body type if measurements were extracted
    body_type = None
    if result.success and result.measurements:
        m = result.measurements
        body_type = classify_body_type(
            chest_cm=m.get("chest_cm"),
            waist_cm=m.get("waist_cm"),
            hips_cm=m.get("hips_cm"),
            shoulder_width_cm=m.get("shoulder_width_cm"),
        )

    logger.info(
        "Photo scan avatar=%s success=%s confidence=%.2f",
        avatar_id, result.success, result.overall_confidence,
    )

    return PhotoScanResult(
        success=result.success,
        measurements=result.measurements,
        confidence_scores=result.confidence_scores,
        overall_confidence=result.overall_confidence,
        warnings=result.warnings,
        error=result.error,
        fallback_required=result.fallback_required,
        body_type=body_type,
    )


# ---------------------------------------------------------------------------
# GET /avatars/{id}/fit-recommendations
# ---------------------------------------------------------------------------

@router.get("/{avatar_id}/fit-recommendations", response_model=FitRecommendationsResponse)
async def fit_recommendations(
    avatar_id: str,
    limit: int = 20,
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get fit recommendations for this avatar across available garments.

    Returns the best-fitting size for each active garment in the catalogue,
    with confidence scores and reasoning.

    Optional: filter by garment category.
    """
    avatar = await _get_active_avatar(avatar_id, db)
    current_m = _current_measurement(avatar)

    if current_m is None:
        raise HTTPException(
            status_code=422,
            detail="Avatar has no measurements. Add measurements before requesting recommendations.",
        )

    avatar_meas = _measurement_to_dict(current_m)
    fit_pref = avatar.fit_preference.get("preference", "regular") if avatar.fit_preference else "regular"

    # Fetch active garments with size charts
    query = select(Garment).where(
        Garment.status == GarmentStatus.ACTIVE,
        Garment.size_chart.isnot(None),  # type: ignore[attr-defined]
    )
    if category:
        query = query.where(Garment.category == category)
    query = query.limit(limit)

    garment_result = await db.execute(query)
    garments = garment_result.scalars().all()

    recommendations: list[FitRecommendationItem] = []

    for garment in garments:
        if not garment.size_chart:
            continue

        # Score each available size and pick the best
        best_result = None
        best_score = -1.0
        best_size_label = None

        for size_label, size_spec in garment.size_chart.items():
            if not isinstance(size_spec, dict):
                continue

            # Normalize spec keys
            normalized_spec = {
                "chest_cm": size_spec.get("chest") or size_spec.get("chest_cm"),
                "waist_cm": size_spec.get("waist") or size_spec.get("waist_cm"),
                "hips_cm": size_spec.get("hips") or size_spec.get("hips_cm"),
                "shoulder_width_cm": size_spec.get("shoulder") or size_spec.get("shoulder_width_cm"),
                "sleeve_length_cm": size_spec.get("sleeve") or size_spec.get("sleeve_length_cm"),
                "torso_length_cm": size_spec.get("length") or size_spec.get("torso_length_cm"),
            }

            result = score_fit(
                avatar_measurements=avatar_meas,
                garment_size_spec=normalized_spec,
                size_label=size_label,
                garment_category=garment.category or "tops",
                fit_preference=fit_pref,
                all_sizes={
                    sl: {
                        "chest_cm": sp.get("chest") or sp.get("chest_cm"),
                        "waist_cm": sp.get("waist") or sp.get("waist_cm"),
                        "hips_cm": sp.get("hips") or sp.get("hips_cm"),
                        "shoulder_width_cm": sp.get("shoulder") or sp.get("shoulder_width_cm"),
                        "sleeve_length_cm": sp.get("sleeve") or sp.get("sleeve_length_cm"),
                    }
                    for sl, sp in garment.size_chart.items()
                    if isinstance(sp, dict)
                },
            )

            if result.overall_score > best_score:
                best_score = result.overall_score
                best_result = result
                best_size_label = size_label

        if best_result and best_size_label:
            zones_out = {
                name: ZoneFitResponse(fit=zone.fit, ease_cm=zone.ease_cm)
                for name, zone in best_result.zones.items()
                if zone.ease_cm is not None
            }
            recommendations.append(
                FitRecommendationItem(
                    garment_id=garment.id,
                    ugi=garment.ugi,
                    garment_name=garment.name,
                    overall_fit=best_result.overall_fit,
                    size_recommendation=best_size_label,
                    confidence=best_result.confidence,
                    zones=zones_out,
                    reasoning=best_result.reasoning,
                    alternative=best_result.alternative,
                )
            )

    # Sort by confidence descending
    recommendations.sort(key=lambda r: r.confidence, reverse=True)

    return FitRecommendationsResponse(
        avatar_id=avatar_id,
        recommendations=recommendations,
        total=len(recommendations),
    )

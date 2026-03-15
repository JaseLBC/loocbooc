"""
Try-on endpoints — Fit Scoring Engine v2.

Upgraded from basic rule-based to multi-zone scoring with:
- Confidence scores
- Natural language reasoning
- Alternative size suggestions
- Structured zone-level feedback
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import AuthContext, get_auth_context
from app.models.avatar import Avatar, AvatarMeasurement
from app.models.garment import Garment, GarmentStatus
from app.models.try_on import FitScore, TryOn
from app.schemas.try_on import TryOnRequest, TryOnResponseV2
from app.services.fit_scoring import fit_result_to_api_response, score_fit
from app.services.garment_service import get_garment_by_ugi

router = APIRouter(tags=["try-on"])
logger = logging.getLogger(__name__)


def _measurement_to_dict(m: AvatarMeasurement) -> dict:
    return {
        "height_cm": m.height_cm,
        "weight_kg": m.weight_kg,
        "chest_cm": m.chest_cm,
        "waist_cm": m.waist_cm,
        "hips_cm": m.hips_cm,
        "inseam_cm": m.inseam_cm,
        "shoulder_width_cm": m.shoulder_width_cm,
        "sleeve_length_cm": m.sleeve_length_cm,
        "arm_length_cm": getattr(m, "arm_length_cm", None),
        "torso_length_cm": getattr(m, "torso_length_cm", None),
        "neck_cm": m.neck_cm,
        "thigh_cm": m.thigh_cm,
    }


@router.post(
    "/garments/{ugi}/try-on",
    response_model=TryOnResponseV2,
    status_code=201,
)
async def try_on_garment(
    ugi: str,
    request: TryOnRequest,
    auth: AuthContext | None = Depends(get_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Virtual try-on with multi-zone fit scoring v2.

    Returns structured fit result:
    {
      "overall_fit": "good",
      "size_recommendation": "Size 10",
      "confidence": 0.87,
      "zones": {
        "chest": {"fit": "good", "ease_cm": 4.2},
        "waist": {"fit": "slightly_tight", "ease_cm": 0.8},
        ...
      },
      "reasoning": "...",
      "alternative": {"size": "Size 12", "note": "..."}
    }
    """
    # Fetch garment
    garment = await get_garment_by_ugi(db, ugi.upper(), include_physics=True)
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")

    if garment.status != GarmentStatus.ACTIVE and not auth:
        raise HTTPException(status_code=404, detail="Garment not found")

    # Fetch avatar with current measurements
    result = await db.execute(
        select(Avatar)
        .options(selectinload(Avatar.measurements))
        .where(Avatar.id == request.avatar_id, Avatar.is_active == True)  # noqa: E712
    )
    avatar = result.scalar_one_or_none()
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar not found")

    current_m = next(
        (m for m in avatar.measurements if m.is_current),
        avatar.measurements[0] if avatar.measurements else None,
    )
    if not current_m:
        raise HTTPException(
            status_code=422,
            detail="Avatar has no measurements. Add measurements before trying on garments.",
        )

    avatar_meas = _measurement_to_dict(current_m)
    fit_pref = (
        avatar.fit_preference.get("preference", "regular")
        if avatar.fit_preference else "regular"
    )

    # Resolve size and spec
    size = request.size
    size_spec: dict = {}
    if garment.size_chart:
        if size and size in garment.size_chart:
            raw_spec = garment.size_chart[size]
        elif garment.size_chart:
            first_size = next(iter(garment.size_chart))
            size = size or first_size
            raw_spec = garment.size_chart.get(size, {})
        else:
            raw_spec = {}

        # Normalize spec keys (support both short and long form)
        size_spec = {
            "chest_cm": raw_spec.get("chest") or raw_spec.get("chest_cm"),
            "waist_cm": raw_spec.get("waist") or raw_spec.get("waist_cm"),
            "hips_cm": raw_spec.get("hips") or raw_spec.get("hips_cm"),
            "shoulder_width_cm": raw_spec.get("shoulder") or raw_spec.get("shoulder_width_cm"),
            "sleeve_length_cm": raw_spec.get("sleeve") or raw_spec.get("sleeve_length_cm"),
            "torso_length_cm": raw_spec.get("length") or raw_spec.get("torso_length_cm"),
        }

    # Apply stretch factor if fabric physics available
    if garment.fabric_physics and size_spec:
        avg_stretch = (garment.fabric_physics.stretch_x + garment.fabric_physics.stretch_y) / 2
        if avg_stretch > 20:
            stretch_factor = 1.0 + (avg_stretch / 200)
            size_spec = {
                k: v * stretch_factor if isinstance(v, (int, float)) else v
                for k, v in size_spec.items()
            }

    # Build all_sizes for alternative suggestion
    all_sizes: dict | None = None
    if garment.size_chart:
        all_sizes = {}
        for sl, sp in garment.size_chart.items():
            if isinstance(sp, dict):
                all_sizes[sl] = {
                    "chest_cm": sp.get("chest") or sp.get("chest_cm"),
                    "waist_cm": sp.get("waist") or sp.get("waist_cm"),
                    "hips_cm": sp.get("hips") or sp.get("hips_cm"),
                    "shoulder_width_cm": sp.get("shoulder") or sp.get("shoulder_width_cm"),
                    "sleeve_length_cm": sp.get("sleeve") or sp.get("sleeve_length_cm"),
                }

    # Score fit
    fit_result = score_fit(
        avatar_measurements=avatar_meas,
        garment_size_spec=size_spec,
        size_label=size or "Unknown",
        garment_category=garment.category or "tops",
        fit_preference=fit_pref,
        all_sizes=all_sizes,
    )

    api_response = fit_result_to_api_response(fit_result)

    # Persist try-on record
    try_on = TryOn(
        garment_id=garment.id,
        avatar_id=avatar.id,
        size=size,
        scoring_method="v2_multi_zone",
    )
    db.add(try_on)
    await db.flush()

    # Persist fit score record
    zones = fit_result.zones
    fit_score_record = FitScore(
        try_on_id=try_on.id,
        overall=fit_result.overall_score,
        chest_fit=zones.get("chest") and zones["chest"].fit,
        waist_fit=zones.get("waist") and zones["waist"].fit,
        hips_fit=zones.get("hips") and zones["hips"].fit,
        shoulder_fit=zones.get("shoulder") and zones["shoulder"].fit,
        sleeve_fit=zones.get("sleeve_length") and zones["sleeve_length"].fit,
        recommendation=fit_result.size_recommendation,
        measurement_deltas=fit_result.raw_deltas,
        raw_scores={
            z: {"fit": v.fit, "ease_cm": v.ease_cm, "score": v.score}
            for z, v in zones.items()
        },
    )
    db.add(fit_score_record)
    await db.flush()

    logger.info(
        "Try-on v2: garment=%s avatar=%s size=%s overall=%s confidence=%.2f",
        ugi, avatar.id, size, fit_result.overall_fit, fit_result.confidence,
    )

    return TryOnResponseV2(
        id=try_on.id,
        garment_id=garment.id,
        avatar_id=avatar.id,
        size=size,
        scoring_method="v2_multi_zone",
        created_at=try_on.created_at,
        overall_fit=api_response["overall_fit"],
        size_recommendation=api_response["size_recommendation"],
        confidence=api_response["confidence"],
        zones=api_response["zones"],
        reasoning=api_response["reasoning"],
        alternative=api_response.get("alternative"),
    )

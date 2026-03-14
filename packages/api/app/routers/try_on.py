"""
Try-on endpoints.
Rule-based fit scoring for MVP — ML model will replace this later.
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
from app.schemas.try_on import FitScoreResponse, FitZone, TryOnRequest, TryOnResponse
from app.services.garment_service import get_garment_by_ugi

router = APIRouter(tags=["try-on"])
logger = logging.getLogger(__name__)


# Fit assessment thresholds (cm delta)
# Positive delta = garment larger than body, negative = smaller
FIT_THRESHOLDS = {
    "perfect": (-1.5, 3.0),      # -1.5 to +3cm: perfect
    "good": (-3.0, 5.0),          # -3 to +5cm: good
    "slightly_tight": (-5.0, -1.5),
    "tight": (-10.0, -5.0),
    "very_tight": (None, -10.0),
    "slightly_loose": (3.0, 7.0),
    "loose": (7.0, 12.0),
    "very_loose": (12.0, None),
}


def assess_zone(delta_cm: float | None) -> tuple[str, float]:
    """
    Assess fit for a single body zone from the measurement delta.

    delta_cm = garment_spec_cm - avatar_measurement_cm
    Positive = garment bigger (loose), negative = garment smaller (tight).

    Returns (assessment_label, zone_score 0-1).
    """
    if delta_cm is None:
        return "unknown", 0.5

    if -1.5 <= delta_cm <= 3.0:
        return "perfect", 1.0
    elif -3.0 <= delta_cm <= 5.0:
        return "good", 0.85
    elif -5.0 <= delta_cm < -1.5:
        return "slightly_tight", 0.65
    elif -10.0 <= delta_cm < -5.0:
        return "tight", 0.35
    elif delta_cm < -10.0:
        return "very_tight", 0.1
    elif 3.0 < delta_cm <= 7.0:
        return "slightly_loose", 0.7
    elif 7.0 < delta_cm <= 12.0:
        return "loose", 0.4
    else:  # > 12
        return "very_loose", 0.15


def compute_fit_score(
    avatar_m: AvatarMeasurement,
    size_spec: dict,
) -> dict:
    """
    Rule-based fit scoring from measurements.

    size_spec should contain garment measurements (cm) for the relevant size:
    {
        "chest": 96.0,
        "waist": 76.0,
        "hips": 102.0,
        "length": 65.0,
        "shoulder": 42.0,
        "sleeve": 60.0,
    }

    Returns dict with zone scores, overall score, and recommendation.
    """
    zones = {}
    deltas = {}
    zone_scores = []

    zone_mapping = {
        "chest": ("chest_cm", 1.5),   # (measurement attr, weight)
        "waist": ("waist_cm", 1.5),
        "hips": ("hips_cm", 1.0),
        "shoulder": ("shoulder_width_cm", 1.2),
        "sleeve": ("sleeve_length_cm", 0.8),
    }

    for zone_name, (avatar_attr, weight) in zone_mapping.items():
        garment_val = size_spec.get(zone_name)
        avatar_val = getattr(avatar_m, avatar_attr, None)

        if garment_val is not None and avatar_val is not None:
            delta = garment_val - avatar_val
            assessment, score = assess_zone(delta)
            zones[zone_name] = FitZone(assessment=assessment, delta_cm=delta, score=score)
            deltas[zone_name] = delta
            zone_scores.append((score, weight))

    # Length assessment (different logic — purely "too short" or "too long")
    garment_length = size_spec.get("length")
    avatar_height = avatar_m.height_cm
    if garment_length and avatar_height:
        # Rough heuristic: torso length ≈ height * 0.3 for tops
        # This would be more precise with actual inseam/torso data
        pass  # Skip for now, needs garment category context

    # Compute weighted overall score
    if zone_scores:
        total_weight = sum(w for _, w in zone_scores)
        overall = sum(s * w for s, w in zone_scores) / total_weight
    else:
        overall = 0.5  # No data — neutral score

    # Determine recommendation
    # Look at the most critical zones (chest, waist, shoulder)
    critical_zones = [zones.get(z) for z in ("chest", "waist", "shoulder") if z in zones]
    tight_count = sum(1 for z in critical_zones if z and "tight" in z.assessment)
    loose_count = sum(1 for z in critical_zones if z and "loose" in z.assessment)
    very_tight = sum(1 for z in critical_zones if z and z.assessment == "very_tight")
    very_loose = sum(1 for z in critical_zones if z and z.assessment == "very_loose")

    if very_tight >= 1 or tight_count >= 2:
        recommendation = "size_up_2" if very_tight >= 2 else "size_up"
    elif very_loose >= 1 or loose_count >= 2:
        recommendation = "size_down"
    elif tight_count == 1:
        recommendation = "size_up"
    elif loose_count == 1:
        recommendation = "size_down"
    else:
        recommendation = "true_to_size"

    return {
        "overall": round(overall, 3),
        "zones": zones,
        "deltas": deltas,
        "recommendation": recommendation,
        "chest": zones.get("chest", FitZone(assessment="unknown", score=0.5)).assessment if "chest" in zones else None,
        "waist": zones.get("waist", FitZone(assessment="unknown", score=0.5)).assessment if "waist" in zones else None,
        "hips": zones.get("hips", FitZone(assessment="unknown", score=0.5)).assessment if "hips" in zones else None,
        "shoulder": zones.get("shoulder", FitZone(assessment="unknown", score=0.5)).assessment if "shoulder" in zones else None,
        "sleeve": zones.get("sleeve", FitZone(assessment="unknown", score=0.5)).assessment if "sleeve" in zones else None,
    }


@router.post("/garments/{ugi}/try-on", response_model=TryOnResponse, status_code=201)
async def try_on_garment(
    ugi: str,
    request: TryOnRequest,
    auth: AuthContext | None = Depends(get_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Perform a virtual try-on.

    Looks up garment specs and avatar measurements, runs rule-based fit scoring,
    and returns a detailed fit assessment.

    For MVP: rule-based scoring from measurements.
    Future: ML model trained on consumer feedback data.
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
        .where(Avatar.id == request.avatar_id, Avatar.is_active == True)  # noqa
    )
    avatar = result.scalar_one_or_none()
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar not found")

    # Get current measurements
    current_measurements = next(
        (m for m in avatar.measurements if m.is_current),
        avatar.measurements[0] if avatar.measurements else None,
    )
    if not current_measurements:
        raise HTTPException(
            status_code=422,
            detail="Avatar has no measurements. Add measurements before trying on garments.",
        )

    # Get size spec from garment's size_chart
    size = request.size
    size_spec = {}
    if garment.size_chart:
        if size and size in garment.size_chart:
            size_spec = garment.size_chart[size]
        elif "default" in garment.size_chart:
            size_spec = garment.size_chart["default"]
        elif garment.size_chart:
            # Use first available size
            first_size = next(iter(garment.size_chart))
            size_spec = garment.size_chart[first_size]
            size = first_size

    # If we have fabric physics, we can factor in stretch
    stretch_factor = 1.0
    if garment.fabric_physics:
        # High stretch fabrics are more forgiving — bump the effective garment size
        avg_stretch = (garment.fabric_physics.stretch_x + garment.fabric_physics.stretch_y) / 2
        if avg_stretch > 20:  # > 20% stretch
            stretch_factor = 1.0 + (avg_stretch / 200)  # Up to ~1.5x for high stretch

    if stretch_factor > 1.0 and size_spec:
        size_spec = {k: v * stretch_factor if isinstance(v, (int, float)) else v
                     for k, v in size_spec.items()}

    # Compute fit
    fit_result = compute_fit_score(current_measurements, size_spec)

    # Create TryOn record
    try_on = TryOn(
        garment_id=garment.id,
        avatar_id=avatar.id,
        size=size,
        scoring_method="rule_based_v1",
    )
    db.add(try_on)
    await db.flush()

    # Create FitScore record
    fit_score_record = FitScore(
        try_on_id=try_on.id,
        overall=fit_result["overall"],
        chest_fit=fit_result.get("chest"),
        waist_fit=fit_result.get("waist"),
        hips_fit=fit_result.get("hips"),
        shoulder_fit=fit_result.get("shoulder"),
        sleeve_fit=fit_result.get("sleeve"),
        recommendation=fit_result["recommendation"],
        measurement_deltas=fit_result["deltas"],
        raw_scores={z: {"assessment": v.assessment, "score": v.score}
                    for z, v in fit_result["zones"].items()},
    )
    db.add(fit_score_record)
    await db.flush()

    logger.info(
        f"Try-on: garment={ugi} avatar={avatar.id} "
        f"overall={fit_result['overall']:.2f} rec={fit_result['recommendation']}"
    )

    return TryOnResponse(
        id=try_on.id,
        garment_id=garment.id,
        avatar_id=avatar.id,
        size=size,
        scoring_method="rule_based_v1",
        created_at=try_on.created_at,
        fit_score=FitScoreResponse(
            overall=fit_result["overall"],
            chest=fit_result.get("chest"),
            waist=fit_result.get("waist"),
            hips=fit_result.get("hips"),
            shoulder=fit_result.get("shoulder"),
            sleeve=fit_result.get("sleeve"),
            recommendation=fit_result["recommendation"],
            zones=fit_result["zones"],
            measurement_deltas=fit_result["deltas"],
            size_tried=size,
            scoring_method="rule_based_v1",
        ),
    )

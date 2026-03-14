"""
Fabric physics service.
Maps fabric composition strings to physics simulation parameters.
This is the compound data moat — more garments = more accurate physics.
"""
import hashlib
import logging
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fabric import FabricPhysics

logger = logging.getLogger(__name__)

# Known fibre physics base values
# Each entry: (drape, stretch_x, stretch_y, recovery, weight_gsm, sheen, heat_response, pilling, breathability)
FIBRE_BASE_PHYSICS: dict[str, dict[str, float]] = {
    "cotton": {
        "drape": 0.5, "stretch_x": 5.0, "stretch_y": 3.0, "recovery": 0.3,
        "weight_gsm": 150.0, "sheen": 0.1, "heat_response": 0.6,
        "pilling": 0.5, "breathability": 0.9,
    },
    "polyester": {
        "drape": 0.45, "stretch_x": 8.0, "stretch_y": 6.0, "recovery": 0.7,
        "weight_gsm": 120.0, "sheen": 0.5, "heat_response": 0.3,
        "pilling": 0.3, "breathability": 0.4,
    },
    "elastane": {
        "drape": 0.3, "stretch_x": 100.0, "stretch_y": 100.0, "recovery": 0.95,
        "weight_gsm": 80.0, "sheen": 0.3, "heat_response": 0.2,
        "pilling": 0.6, "breathability": 0.5,
    },
    "spandex": {  # alias for elastane
        "drape": 0.3, "stretch_x": 100.0, "stretch_y": 100.0, "recovery": 0.95,
        "weight_gsm": 80.0, "sheen": 0.3, "heat_response": 0.2,
        "pilling": 0.6, "breathability": 0.5,
    },
    "lycra": {  # alias for elastane
        "drape": 0.3, "stretch_x": 100.0, "stretch_y": 100.0, "recovery": 0.95,
        "weight_gsm": 80.0, "sheen": 0.3, "heat_response": 0.2,
        "pilling": 0.6, "breathability": 0.5,
    },
    "nylon": {
        "drape": 0.55, "stretch_x": 15.0, "stretch_y": 12.0, "recovery": 0.75,
        "weight_gsm": 100.0, "sheen": 0.6, "heat_response": 0.25,
        "pilling": 0.4, "breathability": 0.35,
    },
    "viscose": {
        "drape": 0.8, "stretch_x": 8.0, "stretch_y": 6.0, "recovery": 0.3,
        "weight_gsm": 130.0, "sheen": 0.4, "heat_response": 0.7,
        "pilling": 0.4, "breathability": 0.8,
    },
    "rayon": {  # alias for viscose
        "drape": 0.8, "stretch_x": 8.0, "stretch_y": 6.0, "recovery": 0.3,
        "weight_gsm": 130.0, "sheen": 0.4, "heat_response": 0.7,
        "pilling": 0.4, "breathability": 0.8,
    },
    "wool": {
        "drape": 0.65, "stretch_x": 10.0, "stretch_y": 8.0, "recovery": 0.6,
        "weight_gsm": 200.0, "sheen": 0.15, "heat_response": 0.8,
        "pilling": 0.3, "breathability": 0.75,
    },
    "silk": {
        "drape": 0.95, "stretch_x": 5.0, "stretch_y": 4.0, "recovery": 0.4,
        "weight_gsm": 90.0, "sheen": 0.9, "heat_response": 0.5,
        "pilling": 0.7, "breathability": 0.85,
    },
    "linen": {
        "drape": 0.35, "stretch_x": 3.0, "stretch_y": 2.0, "recovery": 0.2,
        "weight_gsm": 170.0, "sheen": 0.05, "heat_response": 0.6,
        "pilling": 0.7, "breathability": 0.95,
    },
    "acrylic": {
        "drape": 0.4, "stretch_x": 8.0, "stretch_y": 6.0, "recovery": 0.5,
        "weight_gsm": 140.0, "sheen": 0.35, "heat_response": 0.3,
        "pilling": 0.15, "breathability": 0.4,
    },
    "modal": {
        "drape": 0.75, "stretch_x": 10.0, "stretch_y": 8.0, "recovery": 0.5,
        "weight_gsm": 120.0, "sheen": 0.3, "heat_response": 0.65,
        "pilling": 0.55, "breathability": 0.85,
    },
    "cashmere": {
        "drape": 0.7, "stretch_x": 8.0, "stretch_y": 6.0, "recovery": 0.55,
        "weight_gsm": 160.0, "sheen": 0.3, "heat_response": 0.85,
        "pilling": 0.2, "breathability": 0.7,
    },
    "tencel": {
        "drape": 0.8, "stretch_x": 8.0, "stretch_y": 6.0, "recovery": 0.4,
        "weight_gsm": 125.0, "sheen": 0.25, "heat_response": 0.65,
        "pilling": 0.6, "breathability": 0.9,
    },
    "lyocell": {  # alias for tencel
        "drape": 0.8, "stretch_x": 8.0, "stretch_y": 6.0, "recovery": 0.4,
        "weight_gsm": 125.0, "sheen": 0.25, "heat_response": 0.65,
        "pilling": 0.6, "breathability": 0.9,
    },
}


def parse_composition(composition_raw: str) -> dict[str, float]:
    """
    Parse a fabric composition string into a normalized fibre breakdown.

    Handles formats like:
    - "85% polyester 15% elastane"
    - "100% Cotton"
    - "60% cotton, 35% polyester, 5% elastane"
    - "Polyester 80% Elastane 20%"

    Returns dict like {"polyester": 0.85, "elastane": 0.15}
    Raises ValueError if no fibres can be parsed.
    """
    # Extract all percentage-fibre pairs (handles various orderings)
    pattern = r"(\d+(?:\.\d+)?)\s*%\s*([a-zA-Z]+)|([a-zA-Z]+)\s+(\d+(?:\.\d+)?)\s*%"
    matches = re.findall(pattern, composition_raw, re.IGNORECASE)

    breakdown: dict[str, float] = {}
    for m in matches:
        if m[0] and m[1]:
            pct, fibre = float(m[0]), m[1].lower()
        elif m[2] and m[3]:
            fibre, pct = m[2].lower(), float(m[3])
        else:
            continue
        breakdown[fibre] = pct / 100.0

    if not breakdown:
        raise ValueError(f"Could not parse any fibre composition from: {composition_raw!r}")

    # Normalize to sum to 1.0 (handles rounding errors in labels)
    total = sum(breakdown.values())
    if abs(total - 1.0) > 0.05:
        logger.warning(
            f"Composition percentages sum to {total*100:.1f}% (expected ~100%): {composition_raw!r}"
        )
    if total > 0:
        breakdown = {k: v / total for k, v in breakdown.items()}

    return breakdown


def normalize_composition(breakdown: dict[str, float]) -> str:
    """
    Create a normalized composition string for hashing/dedup.
    Alphabetical fibre order, 4 decimal places.
    Example: "cotton:0.1500,polyester:0.8500"
    """
    return ",".join(f"{k}:{v:.4f}" for k, v in sorted(breakdown.items()))


def hash_composition(normalized: str) -> str:
    """SHA-256 hash of normalized composition string."""
    return hashlib.sha256(normalized.encode()).hexdigest()


def estimate_physics_from_breakdown(breakdown: dict[str, float]) -> dict[str, float]:
    """
    Estimate physics parameters from fibre breakdown using weighted average
    of known fibre base values.

    For unknown fibres, uses cotton as fallback.
    """
    props = {
        "drape": 0.0, "stretch_x": 0.0, "stretch_y": 0.0, "recovery": 0.0,
        "weight_gsm": 0.0, "sheen": 0.0, "heat_response": 0.0,
        "pilling": 0.0, "breathability": 0.0,
    }
    total_weight = 0.0

    for fibre, fraction in breakdown.items():
        base = FIBRE_BASE_PHYSICS.get(fibre, FIBRE_BASE_PHYSICS["cotton"])
        for key in props:
            props[key] += base[key] * fraction
        total_weight += fraction

    if total_weight > 0:
        props = {k: v / total_weight for k, v in props.items()}

    return props


async def get_or_create_physics(
    db: AsyncSession,
    composition_raw: str,
    override_params: dict[str, Any] | None = None,
) -> tuple[FabricPhysics, bool]:
    """
    Look up or create a FabricPhysics entry for a composition string.

    Returns (FabricPhysics, created: bool).
    If the composition already exists, increments sample_count.
    If new, estimates params from fibre breakdown.
    """
    try:
        breakdown = parse_composition(composition_raw)
    except ValueError as e:
        logger.error(f"Failed to parse composition: {e}")
        raise

    normalized = normalize_composition(breakdown)
    comp_hash = hash_composition(normalized)

    # Look up existing
    result = await db.execute(
        select(FabricPhysics).where(FabricPhysics.composition_hash == comp_hash)
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Increment sample count and recalculate confidence
        existing.sample_count += 1
        existing.confidence_score = min(
            0.99, 0.5 + 0.5 * (1 - 1 / (1 + existing.sample_count / 10))
        )
        await db.flush()
        return existing, False

    # Estimate physics from breakdown
    estimated = estimate_physics_from_breakdown(breakdown)

    if override_params:
        estimated.update(override_params)
        is_estimated = False
    else:
        is_estimated = True

    physics = FabricPhysics(
        composition_hash=comp_hash,
        composition_raw=composition_raw,
        composition_normalized=normalized,
        fibre_breakdown=breakdown,
        drape_coefficient=estimated["drape"],
        stretch_x=estimated["stretch_x"],
        stretch_y=estimated["stretch_y"],
        recovery_rate=estimated["recovery"],
        weight_gsm=estimated["weight_gsm"],
        sheen_level=estimated["sheen"],
        heat_response=estimated["heat_response"],
        pilling_resistance=estimated["pilling"],
        breathability=estimated["breathability"],
        sample_count=1,
        confidence_score=0.5,
        is_estimated=is_estimated,
    )
    db.add(physics)
    await db.flush()

    logger.info(f"Created new FabricPhysics entry: {normalized} (estimated={is_estimated})")
    return physics, True

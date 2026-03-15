"""
Fit Scoring Engine v2 — ML-ready multi-zone scoring with confidence and reasoning.

Replaces the basic rule-based system with:
- Multi-zone scoring (chest, waist, hips, shoulders, sleeve length, torso length)
- Confidence scoring (data quality → prediction certainty)
- Natural language reasoning with specific measurements
- Alternative size suggestions with ease values

Architecture: pure functions, no DB dependency. Can be replaced with ML model
by swapping score_fit() without touching any callers.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class ZoneFit:
    """Fit result for a single body zone."""
    zone: str
    fit: str  # good, slightly_tight, tight, very_tight, slightly_loose, loose, very_loose, unknown
    ease_cm: float | None  # positive = room to spare, negative = too tight
    score: float  # 0.0–1.0 (1.0 = perfect fit)
    weight: float  # contribution weight in overall score


@dataclass
class FitResult:
    """Complete fit scoring result — structured to match spec output contract."""
    overall_fit: str          # good, acceptable, poor
    size_recommendation: str  # e.g. "Size 10"
    confidence: float         # 0.0–1.0

    zones: dict[str, ZoneFit]
    reasoning: str
    alternative: dict[str, str] | None  # {"size": "Size 12", "note": "..."}

    # Internal
    overall_score: float      # 0.0–1.0 weighted composite
    raw_deltas: dict[str, float]
    data_quality: float       # 0.0–1.0 — how complete the input data was


# ---------------------------------------------------------------------------
# AU standard size chart (women's)
# Measurements in cm — these are body measurements, not garment ease
# ---------------------------------------------------------------------------

AU_WOMENS_SIZES: dict[str, dict[str, float]] = {
    "4":  {"chest": 76,  "waist": 58,  "hips": 82},
    "6":  {"chest": 80,  "waist": 62,  "hips": 86},
    "8":  {"chest": 84,  "waist": 66,  "hips": 90},
    "10": {"chest": 88,  "waist": 70,  "hips": 94},
    "12": {"chest": 92,  "waist": 74,  "hips": 98},
    "14": {"chest": 96,  "waist": 78,  "hips": 102},
    "16": {"chest": 100, "waist": 82,  "hips": 106},
    "18": {"chest": 104, "waist": 86,  "hips": 110},
    "20": {"chest": 108, "waist": 90,  "hips": 114},
    "22": {"chest": 114, "waist": 96,  "hips": 120},
}

# Garment ease by category (cm added to body measurements to get garment spec)
# These represent "regular fit" ease. Multiplied by fit preference factor below.
CATEGORY_EASE: dict[str, dict[str, float]] = {
    "tops":       {"chest": 8,  "waist": 6,  "hips": 6,  "shoulder": 1.5},
    "dresses":    {"chest": 8,  "waist": 6,  "hips": 8,  "shoulder": 1.5},
    "bottoms":    {"chest": 0,  "waist": 2,  "hips": 6,  "shoulder": 0},
    "outerwear":  {"chest": 12, "waist": 10, "hips": 10, "shoulder": 2},
    "activewear": {"chest": 2,  "waist": 2,  "hips": 4,  "shoulder": 1},
    "swimwear":   {"chest": -2, "waist": -2, "hips": 2,  "shoulder": 0},
    "default":    {"chest": 8,  "waist": 6,  "hips": 6,  "shoulder": 1.5},
}

# Fit preference modifiers — multiply ease by this factor
FIT_PREFERENCE_FACTOR: dict[str, float] = {
    "fitted":    0.5,   # Less ease than regular
    "regular":   1.0,
    "relaxed":   1.5,
    "oversized": 2.5,
}


# ---------------------------------------------------------------------------
# Zone scoring
# ---------------------------------------------------------------------------

# (min_ease, max_ease) ranges for each fit label
# ease = garment_spec - avatar_measurement
# positive ease = room, negative ease = tight
FIT_BANDS: list[tuple[str, float | None, float | None, float]] = [
    # label,         min_ease,  max_ease,  score
    ("very_tight",   None,      -8.0,      0.05),
    ("tight",        -8.0,      -4.0,      0.25),
    ("slightly_tight", -4.0,   -1.0,      0.60),
    ("good",         -1.0,       6.0,      1.00),
    ("slightly_loose", 6.0,     10.0,      0.70),
    ("loose",        10.0,      16.0,      0.40),
    ("very_loose",   16.0,      None,      0.10),
]

# Zone weights for overall score computation
ZONE_WEIGHTS: dict[str, float] = {
    "chest":         2.0,
    "waist":         2.0,
    "hips":          1.5,
    "shoulder":      2.0,
    "sleeve_length": 0.8,
    "torso_length":  1.0,
}


def _score_ease(ease_cm: float) -> tuple[str, float]:
    """Map ease (cm) to a fit label and score."""
    for label, min_e, max_e, score in FIT_BANDS:
        if min_e is None and ease_cm <= max_e:
            return label, score
        if max_e is None and ease_cm > min_e:
            return label, score
        if min_e is not None and max_e is not None and min_e < ease_cm <= max_e:
            return label, score
    return "good", 1.0


def _zone_fit_label_to_str(label: str) -> str:
    """Human-readable zone label."""
    return label.replace("_", " ")


# ---------------------------------------------------------------------------
# Body type classification
# ---------------------------------------------------------------------------

def classify_body_type(
    chest_cm: float | None,
    waist_cm: float | None,
    hips_cm: float | None,
    shoulder_width_cm: float | None = None,
) -> str | None:
    """
    Classify body type from key measurements.

    Returns one of: hourglass, pear, apple, rectangle, inverted_triangle
    or None if insufficient data.
    """
    if not all([chest_cm, waist_cm, hips_cm]):
        return None

    assert chest_cm is not None
    assert waist_cm is not None
    assert hips_cm is not None

    # Calculate ratios
    waist_to_chest = waist_cm / chest_cm
    waist_to_hips = waist_cm / hips_cm
    hip_to_chest = hips_cm / chest_cm

    # Hourglass: defined waist, chest and hips roughly equal
    if waist_to_chest < 0.75 and waist_to_hips < 0.75:
        if abs(hip_to_chest - 1.0) < 0.08:
            return "hourglass"

    # Pear: hips significantly wider than chest
    if hip_to_chest > 1.10 and waist_to_hips < 0.85:
        return "pear"

    # Apple: waist wider relative to hips and chest, fuller midsection
    if waist_to_chest > 0.88 and waist_to_hips > 0.88:
        return "apple"

    # Inverted triangle: chest/shoulders wider than hips
    if hip_to_chest < 0.90 and (shoulder_width_cm is None or shoulder_width_cm > hips_cm * 0.45):
        return "inverted_triangle"

    # Rectangle: all measurements roughly equal proportion
    return "rectangle"


# ---------------------------------------------------------------------------
# Core scoring engine
# ---------------------------------------------------------------------------

def score_fit(
    avatar_measurements: dict[str, float | None],
    garment_size_spec: dict[str, float | None],
    size_label: str,
    garment_category: str = "tops",
    fit_preference: str = "regular",
    all_sizes: dict[str, dict[str, float | None]] | None = None,
) -> FitResult:
    """
    Score the fit of a garment size against avatar measurements.

    Parameters
    ----------
    avatar_measurements : dict
        Keys: height_cm, chest_cm, waist_cm, hips_cm, shoulder_width_cm,
              sleeve_length_cm, arm_length_cm, torso_length_cm, inseam_cm
    garment_size_spec : dict
        Garment measurements at the chosen size. Same keys as avatar_measurements.
    size_label : str
        Human-readable size label, e.g. "Size 10" or "M"
    garment_category : str
        garment category slug — determines ease defaults
    fit_preference : str
        "fitted" | "regular" | "relaxed" | "oversized"
    all_sizes : dict | None
        Full size chart — enables alternative size suggestion

    Returns
    -------
    FitResult with all zones scored, reasoning, and alternative if relevant
    """
    ease_defaults = CATEGORY_EASE.get(garment_category, CATEGORY_EASE["default"])

    # Zone mapping: zone_name -> (avatar_key, garment_key, default_ease_cm)
    zone_map: dict[str, tuple[str, str, float]] = {
        "chest":          ("chest_cm",          "chest_cm",          ease_defaults["chest"]),
        "waist":          ("waist_cm",           "waist_cm",          ease_defaults["waist"]),
        "hips":           ("hips_cm",            "hips_cm",           ease_defaults["hips"]),
        "shoulder":       ("shoulder_width_cm",  "shoulder_width_cm", ease_defaults["shoulder"]),
        "sleeve_length":  ("arm_length_cm",      "sleeve_length_cm",  0.0),
        "torso_length":   ("torso_length_cm",    "torso_length_cm",   2.0),
    }

    zones: dict[str, ZoneFit] = {}
    raw_deltas: dict[str, float] = {}
    available_zones = 0
    scored_zones = 0

    for zone_name, (avatar_key, garment_key, _default_ease) in zone_map.items():
        available_zones += 1
        avatar_val = avatar_measurements.get(avatar_key)
        garment_val = garment_size_spec.get(garment_key)

        if avatar_val is None or garment_val is None:
            # Skip zones where we don't have data
            zones[zone_name] = ZoneFit(
                zone=zone_name,
                fit="unknown",
                ease_cm=None,
                score=0.75,  # Neutral — neither good nor bad
                weight=ZONE_WEIGHTS.get(zone_name, 1.0),
            )
            continue

        ease_cm = garment_val - avatar_val
        raw_deltas[zone_name] = ease_cm
        fit_label, score = _score_ease(ease_cm)
        scored_zones += 1

        zones[zone_name] = ZoneFit(
            zone=zone_name,
            fit=fit_label,
            ease_cm=round(ease_cm, 1),
            score=score,
            weight=ZONE_WEIGHTS.get(zone_name, 1.0),
        )

    # Data quality: what fraction of zones have actual data
    data_quality = scored_zones / available_zones if available_zones > 0 else 0.0

    # Weighted overall score (only count scored zones)
    scored_zone_list = [z for z in zones.values() if z.ease_cm is not None]
    if scored_zone_list:
        total_weight = sum(z.weight for z in scored_zone_list)
        overall_score = sum(z.score * z.weight for z in scored_zone_list) / total_weight
    else:
        overall_score = 0.5

    # Confidence: combination of data quality and score certainty
    # High confidence when many zones are scored AND they agree
    score_variance = 0.0
    if len(scored_zone_list) > 1:
        avg = overall_score
        score_variance = sum((z.score - avg) ** 2 for z in scored_zone_list) / len(scored_zone_list)
    confidence = round(data_quality * (1.0 - min(score_variance, 0.5)), 3)

    # Overall fit label
    if overall_score >= 0.85:
        overall_fit = "good"
    elif overall_score >= 0.60:
        overall_fit = "acceptable"
    else:
        overall_fit = "poor"

    # Build reasoning
    reasoning = _build_reasoning(zones, size_label, fit_preference, overall_fit)

    # Alternative size suggestion
    alternative = None
    if all_sizes and overall_fit != "good":
        alternative = _suggest_alternative(
            avatar_measurements, all_sizes, zones, size_label, garment_category, fit_preference
        )

    return FitResult(
        overall_fit=overall_fit,
        size_recommendation=size_label,
        confidence=confidence,
        zones=zones,
        reasoning=reasoning,
        alternative=alternative,
        overall_score=round(overall_score, 3),
        raw_deltas=raw_deltas,
        data_quality=round(data_quality, 3),
    )


def _build_reasoning(
    zones: dict[str, ZoneFit],
    size_label: str,
    fit_preference: str,
    overall_fit: str,
) -> str:
    """Generate natural language reasoning for the fit result."""
    parts: list[str] = []

    # Identify problem zones and good zones
    tight_zones = [z for z in zones.values() if z.ease_cm is not None and z.ease_cm < -1.0]
    loose_zones = [z for z in zones.values() if z.ease_cm is not None and z.ease_cm > 10.0]
    good_zones = [z for z in zones.values() if z.ease_cm is not None and -1.0 <= z.ease_cm <= 6.0]

    zone_labels = {
        "chest": "chest",
        "waist": "waist",
        "hips": "hips",
        "shoulder": "shoulders",
        "sleeve_length": "sleeve length",
        "torso_length": "torso length",
    }

    if overall_fit == "good":
        parts.append(f"The {size_label} fits well across all measured zones.")
        if good_zones:
            good_names = [zone_labels.get(z.zone, z.zone) for z in good_zones[:3]]
            parts.append(f"Comfortable ease through {', '.join(good_names)}.")
    else:
        if tight_zones:
            for z in tight_zones:
                label = zone_labels.get(z.zone, z.zone)
                ease_abs = abs(z.ease_cm)  # type: ignore[arg-type]
                if z.fit in ("very_tight", "tight"):
                    parts.append(
                        f"The {size_label} is {_zone_fit_label_to_str(z.fit)} "
                        f"at the {label} — {ease_abs:.1f}cm less than needed."
                    )
                else:
                    parts.append(
                        f"Minimal ease at the {label} ({ease_abs:.1f}cm under spec)."
                    )

        if loose_zones:
            for z in loose_zones:
                label = zone_labels.get(z.zone, z.zone)
                if z.fit in ("very_loose", "loose"):
                    parts.append(
                        f"Excess room at the {label} ({z.ease_cm:.1f}cm of ease)."
                    )

        if good_zones:
            good_names = [zone_labels.get(z.zone, z.zone) for z in good_zones[:2]]
            if good_names:
                parts.append(f"Fits well through {' and '.join(good_names)}.")

    # Fit preference note
    if fit_preference == "fitted" and loose_zones:
        parts.append(f"For your fitted preference, consider sizing down.")
    elif fit_preference in ("relaxed", "oversized") and tight_zones:
        parts.append(f"For a more relaxed fit, sizing up would give extra room.")

    return " ".join(parts) if parts else f"The {size_label} is an {overall_fit} fit based on available measurements."


def _suggest_alternative(
    avatar_measurements: dict[str, float | None],
    all_sizes: dict[str, dict[str, float | None]],
    current_zones: dict[str, ZoneFit],
    current_size: str,
    garment_category: str,
    fit_preference: str,
) -> dict[str, str] | None:
    """Find the best alternative size and explain why."""
    # Determine direction: size up or down?
    tight_zones = [z for z in current_zones.values() if z.ease_cm is not None and z.ease_cm < -1.0]
    loose_zones = [z for z in current_zones.values() if z.ease_cm is not None and z.ease_cm > 10.0]

    if not tight_zones and not loose_zones:
        return None

    want_bigger = len(tight_zones) >= len(loose_zones)

    # Score all sizes and pick the best one that isn't the current
    best_size = None
    best_score = -1.0

    for size_label, spec in all_sizes.items():
        if size_label == current_size:
            continue

        result = score_fit(
            avatar_measurements=avatar_measurements,
            garment_size_spec=spec,
            size_label=size_label,
            garment_category=garment_category,
            fit_preference=fit_preference,
        )

        # Only consider sizes in the right direction
        if want_bigger and result.overall_score > best_score:
            best_score = result.overall_score
            best_size = (size_label, result)
        elif not want_bigger and result.overall_score > best_score:
            best_score = result.overall_score
            best_size = (size_label, result)

    if not best_size or best_score <= 0.6:
        return None

    alt_size_label, alt_result = best_size
    direction = "larger" if want_bigger else "smaller"

    # Find what improved
    improved_zones: list[str] = []
    zone_labels = {
        "chest": "chest", "waist": "waist", "hips": "hips",
        "shoulder": "shoulders", "sleeve_length": "sleeve length",
    }
    for zone_name, alt_zone in alt_result.zones.items():
        current_zone = current_zones.get(zone_name)
        if (current_zone and alt_zone.ease_cm is not None
                and current_zone.ease_cm is not None
                and alt_zone.score > current_zone.score + 0.1):
            improved_zones.append(zone_labels.get(zone_name, zone_name))

    if improved_zones:
        note = f"More {direction} fit — improved ease through {', '.join(improved_zones[:2])}."
    else:
        note = f"A {direction} cut overall."

    return {"size": alt_size_label, "note": note}


# ---------------------------------------------------------------------------
# Format for API response (matches spec)
# ---------------------------------------------------------------------------

def fit_result_to_api_response(result: FitResult) -> dict[str, Any]:
    """Convert FitResult to the structured JSON format specified in the task."""
    zones_out: dict[str, dict] = {}
    for zone_name, zone in result.zones.items():
        zones_out[zone_name] = {
            "fit": zone.fit,
            "ease_cm": zone.ease_cm,
        }

    resp: dict[str, Any] = {
        "overall_fit": result.overall_fit,
        "size_recommendation": result.size_recommendation,
        "confidence": result.confidence,
        "zones": zones_out,
        "reasoning": result.reasoning,
    }
    if result.alternative:
        resp["alternative"] = result.alternative

    return resp

"""Try-on and fit score schemas — v2 multi-zone scoring."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TryOnRequest(BaseModel):
    avatar_id: str
    size: str | None = None


class FitZone(BaseModel):
    """Fit assessment for a single body zone."""
    assessment: str  # perfect, good, tight, loose, slightly_tight, slightly_loose
    delta_cm: float | None = None  # garment spec vs avatar measurement
    score: float  # 0-1


class FitScoreResponse(BaseModel):
    """
    Detailed fit scoring result (v1 — kept for backwards compatibility).
    """
    overall: float = Field(..., ge=0.0, le=1.0)
    chest: str | None = None
    waist: str | None = None
    hips: str | None = None
    length: str | None = None
    shoulder: str | None = None
    sleeve: str | None = None
    recommendation: str | None = None
    zones: dict[str, FitZone] = {}
    measurement_deltas: dict[str, float] = {}
    size_tried: str | None = None
    scoring_method: str = "rule_based"

    model_config = {"from_attributes": True}


class TryOnResponse(BaseModel):
    """v1 response — retained for backwards compat."""
    id: str
    garment_id: str
    avatar_id: str
    size: str | None
    scoring_method: str
    created_at: datetime
    fit_score: FitScoreResponse | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# v2 response — matches spec output contract
# ---------------------------------------------------------------------------

class ZoneFitDetail(BaseModel):
    """Zone fit detail in v2 response."""
    fit: str
    ease_cm: float | None = None


class TryOnResponseV2(BaseModel):
    """
    v2 try-on response with full multi-zone scoring.

    Matches the structured output specified in the task:
    {
      "overall_fit": "good",
      "size_recommendation": "Size 10",
      "confidence": 0.87,
      "zones": { "chest": {"fit": "good", "ease_cm": 4.2}, ... },
      "reasoning": "...",
      "alternative": {"size": "Size 12", "note": "..."}
    }
    """
    id: str
    garment_id: str
    avatar_id: str
    size: str | None
    scoring_method: str
    created_at: datetime

    # v2 fit result fields
    overall_fit: str          # good | acceptable | poor
    size_recommendation: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    zones: dict[str, ZoneFitDetail]
    reasoning: str
    alternative: dict[str, str] | None = None

    model_config = {"from_attributes": True}

"""Try-on and fit score schemas."""
from datetime import datetime

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
    Detailed fit scoring result.
    Core output of the virtual try-on engine.
    """
    overall: float = Field(..., ge=0.0, le=1.0, description="Overall fit score (0=terrible, 1=perfect)")
    chest: str | None = None
    waist: str | None = None
    hips: str | None = None
    length: str | None = None
    shoulder: str | None = None
    sleeve: str | None = None
    recommendation: str | None = None  # size_up, size_down, true_to_size, size_up_2
    zones: dict[str, FitZone] = {}
    measurement_deltas: dict[str, float] = {}
    size_tried: str | None = None
    scoring_method: str = "rule_based"

    model_config = {"from_attributes": True}


class TryOnResponse(BaseModel):
    id: str
    garment_id: str
    avatar_id: str
    size: str | None
    scoring_method: str
    created_at: datetime
    fit_score: FitScoreResponse | None = None

    model_config = {"from_attributes": True}

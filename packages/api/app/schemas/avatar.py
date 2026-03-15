"""Avatar schemas — extended for Avatar Module v2."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Measurement schemas
# ---------------------------------------------------------------------------

class AvatarMeasurementsInput(BaseModel):
    """Body measurements — all centimetres unless noted."""
    height_cm: float | None = Field(None, gt=50, lt=300)
    weight_kg: float | None = Field(None, gt=10, lt=500)
    chest_cm: float | None = Field(None, gt=30, lt=200)
    waist_cm: float | None = Field(None, gt=20, lt=200)
    hips_cm: float | None = Field(None, gt=30, lt=200)
    inseam_cm: float | None = Field(None, gt=20, lt=150)
    shoulder_width_cm: float | None = Field(None, gt=20, lt=100)
    sleeve_length_cm: float | None = Field(None, gt=30, lt=100)
    arm_length_cm: float | None = Field(None, gt=30, lt=120)
    neck_cm: float | None = Field(None, gt=20, lt=80)
    thigh_cm: float | None = Field(None, gt=20, lt=120)
    torso_length_cm: float | None = Field(None, gt=20, lt=100)
    measurement_source: str = Field(default="manual")
    confidence_score: float | None = Field(None, ge=0.0, le=1.0)
    extended_measurements: dict[str, Any] = Field(default_factory=dict)


class AvatarMeasurementResponse(BaseModel):
    id: str
    height_cm: float | None
    weight_kg: float | None
    chest_cm: float | None
    waist_cm: float | None
    hips_cm: float | None
    inseam_cm: float | None
    shoulder_width_cm: float | None
    sleeve_length_cm: float | None
    arm_length_cm: float | None
    neck_cm: float | None
    thigh_cm: float | None
    torso_length_cm: float | None
    body_type: str | None
    measurement_source: str
    confidence_score: float | None
    is_current: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Fit preference / style profile schemas
# ---------------------------------------------------------------------------

class FitPreferenceInput(BaseModel):
    """How the consumer prefers clothes to fit."""
    preference: str = Field(
        default="regular",
        description="fitted | regular | relaxed | oversized"
    )
    occasions: list[str] = Field(
        default_factory=list,
        description="work | casual | going_out | all"
    )


class StyleProfileInput(BaseModel):
    """Consumer style preferences."""
    colours: list[str] = Field(default_factory=list)
    silhouettes: list[str] = Field(default_factory=list)
    occasions: list[str] = Field(default_factory=list)
    avoid: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Avatar CRUD schemas
# ---------------------------------------------------------------------------

class AvatarCreate(BaseModel):
    """Create avatar from manual measurements."""
    name: str = Field(default="My Avatar", max_length=200)
    gender: str | None = None
    age_range: str | None = None
    measurements: AvatarMeasurementsInput
    scan_source: str = Field(default="manual")
    scan_data: dict[str, Any] = Field(default_factory=dict)
    fit_preference: FitPreferenceInput = Field(default_factory=FitPreferenceInput)
    style_profile: StyleProfileInput = Field(default_factory=StyleProfileInput)


class AvatarUpdateMeasurements(BaseModel):
    """Update avatar measurements (creates new measurement record)."""
    measurements: AvatarMeasurementsInput


class AvatarUpdateFitPreferences(BaseModel):
    """Update fit preferences and style profile."""
    fit_preference: FitPreferenceInput | None = None
    style_profile: StyleProfileInput | None = None
    name: str | None = Field(None, max_length=200)
    size_history: dict[str, Any] | None = None


class AvatarResponse(BaseModel):
    id: str
    name: str
    gender: str | None
    age_range: str | None
    scan_source: str
    body_type: str | None
    fit_preference: dict[str, Any]
    size_history: dict[str, Any]
    style_profile: dict[str, Any]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    measurements: list[AvatarMeasurementResponse] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Photo scan schemas
# ---------------------------------------------------------------------------

class PhotoScanInitiate(BaseModel):
    """Request to create avatar from photos — provides height for calibration."""
    height_cm: float = Field(..., gt=50, lt=300, description="Height in cm — required for calibration")


class PhotoScanResult(BaseModel):
    """Result of photo-based measurement extraction."""
    success: bool
    measurements: dict[str, float | None] = {}
    confidence_scores: dict[str, float] = {}
    overall_confidence: float = 0.0
    warnings: list[str] = []
    error: str | None = None
    fallback_required: bool = False
    body_type: str | None = None


# ---------------------------------------------------------------------------
# Fit recommendation schemas
# ---------------------------------------------------------------------------

class ZoneFitResponse(BaseModel):
    fit: str
    ease_cm: float | None = None


class FitRecommendationItem(BaseModel):
    garment_id: str
    ugi: str
    garment_name: str
    overall_fit: str
    size_recommendation: str
    confidence: float
    zones: dict[str, ZoneFitResponse]
    reasoning: str
    alternative: dict[str, str] | None = None


class FitRecommendationsResponse(BaseModel):
    avatar_id: str
    recommendations: list[FitRecommendationItem]
    total: int

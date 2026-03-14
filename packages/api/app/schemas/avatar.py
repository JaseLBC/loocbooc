"""Avatar schemas."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


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
    neck_cm: float | None = Field(None, gt=20, lt=80)
    thigh_cm: float | None = Field(None, gt=20, lt=120)
    extended_measurements: dict[str, Any] = Field(default_factory=dict)


class AvatarCreate(BaseModel):
    name: str = Field(default="My Avatar", max_length=200)
    gender: str | None = None
    age_range: str | None = None
    measurements: AvatarMeasurementsInput
    scan_source: str = Field(default="manual")
    scan_data: dict[str, Any] = Field(default_factory=dict)


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
    neck_cm: float | None
    thigh_cm: float | None
    is_current: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AvatarResponse(BaseModel):
    id: str
    name: str
    gender: str | None
    age_range: str | None
    scan_source: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    measurements: list[AvatarMeasurementResponse] = []

    model_config = {"from_attributes": True}

"""Fabric and physics schemas."""
from pydantic import BaseModel, Field


class FabricPhysicsCreate(BaseModel):
    composition_raw: str = Field(..., min_length=3, max_length=500)
    drape_coefficient: float = Field(..., ge=0.0, le=1.0)
    stretch_x: float = Field(0.0, ge=0.0)
    stretch_y: float = Field(0.0, ge=0.0)
    recovery_rate: float = Field(0.0, ge=0.0, le=1.0)
    weight_gsm: float = Field(..., gt=0.0)
    sheen_level: float = Field(0.2, ge=0.0, le=1.0)
    heat_response: float = Field(0.5, ge=0.0, le=1.0)


class FabricPhysicsUpdate(BaseModel):
    drape_coefficient: float | None = Field(None, ge=0.0, le=1.0)
    stretch_x: float | None = Field(None, ge=0.0)
    stretch_y: float | None = Field(None, ge=0.0)
    recovery_rate: float | None = Field(None, ge=0.0, le=1.0)
    weight_gsm: float | None = Field(None, gt=0.0)
    sheen_level: float | None = Field(None, ge=0.0, le=1.0)
    heat_response: float | None = Field(None, ge=0.0, le=1.0)


class FabricPhysicsResponse(BaseModel):
    id: str
    composition_hash: str
    composition_raw: str
    composition_normalized: str
    fibre_breakdown: dict[str, float]
    drape_coefficient: float
    stretch_x: float
    stretch_y: float
    recovery_rate: float
    weight_gsm: float
    sheen_level: float
    heat_response: float
    pilling_resistance: float
    breathability: float
    sample_count: int
    confidence_score: float
    is_estimated: bool

    model_config = {"from_attributes": True}


class OCRScanResponse(BaseModel):
    composition_raw: str
    fibre_breakdown: dict[str, float]
    confidence: float
    physics: FabricPhysicsResponse
    is_estimated: bool
    raw_ocr_text: str | None = None

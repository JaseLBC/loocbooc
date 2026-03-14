"""Garment schemas."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.models.garment import GarmentCategory, GarmentFileType, GarmentStatus


class GarmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=500)
    category: GarmentCategory
    description: str | None = None
    sku: str | None = Field(None, max_length=200)
    metadata: dict[str, Any] = Field(default_factory=dict)
    dpp_data: dict[str, Any] = Field(default_factory=dict)


class GarmentUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = None
    sku: str | None = None
    status: GarmentStatus | None = None
    metadata: dict[str, Any] | None = None
    dpp_data: dict[str, Any] | None = None
    size_chart: dict[str, Any] | None = None


class GarmentFileResponse(BaseModel):
    id: str
    file_type: GarmentFileType
    original_filename: str
    storage_url: str | None
    mime_type: str
    file_size_bytes: int
    width_px: int | None
    height_px: int | None
    duration_seconds: float | None
    is_primary: bool
    processing_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FabricPhysicsResponse(BaseModel):
    id: str
    composition_raw: str
    fibre_breakdown: dict[str, float]
    drape_coefficient: float
    stretch_x: float
    stretch_y: float
    recovery_rate: float
    weight_gsm: float
    sheen_level: float
    heat_response: float
    confidence_score: float
    is_estimated: bool

    model_config = {"from_attributes": True}


class GarmentResponse(BaseModel):
    id: str  # The UGI
    brand_id: str
    status: GarmentStatus
    category: GarmentCategory
    name: str
    description: str | None
    sku: str | None
    metadata: dict[str, Any] = Field(alias="metadata_")
    dpp_data: dict[str, Any]
    size_chart: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None
    files: list[GarmentFileResponse] = []
    fabric_physics: FabricPhysicsResponse | None = None

    model_config = {"from_attributes": True, "populate_by_name": True}


class GarmentListResponse(BaseModel):
    items: list[GarmentResponse]
    total: int
    page: int
    page_size: int
    has_next: bool


class UGIParseResponse(BaseModel):
    ugi: str
    brand_code: str
    category_code: str
    category: str
    timestamp_ms: int
    created_at: datetime
    checksum: str
    is_valid: bool

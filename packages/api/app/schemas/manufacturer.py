"""
Manufacturer marketplace Pydantic schemas.

Naming aligns with the frontend TypeScript types in packages/web/types/manufacturer.ts
so the API contract is self-documenting.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


# ─── Shared value types ───────────────────────────────────────────────────────

PriceTier = Literal["mass", "mid", "premium", "luxury"]
ConnectionStatus = Literal["ENQUIRY", "RESPONDED", "CONNECTED", "DECLINED", "INACTIVE"]


# ─── Rating ───────────────────────────────────────────────────────────────────

class ManufacturerRatingItem(BaseModel):
    """A single brand review as returned on a profile page."""
    id: str
    brand_name: str
    overall_score: int
    quality_score: int
    communication_score: int
    timeliness_score: int
    review: str | None
    orders_completed: int
    is_verified_purchase: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class RateManufacturerInput(BaseModel):
    """Body for POST /manufacturers/{profile_id}/ratings."""
    overall_score: int = Field(..., ge=1, le=5)
    quality_score: int = Field(..., ge=1, le=5)
    communication_score: int = Field(..., ge=1, le=5)
    timeliness_score: int = Field(..., ge=1, le=5)
    review: str | None = Field(None, max_length=2000)
    orders_completed: int = Field(1, ge=1)


# ─── Manufacturer list item ───────────────────────────────────────────────────

class ManufacturerListItem(BaseModel):
    """
    Lightweight profile summary returned in search results.
    Maps to ManufacturerListItem in the frontend.
    """
    id: str                          # Manufacturer account id
    profile_id: str                  # ManufacturerProfile id
    slug: str
    display_name: str
    country: str
    city: str | None
    hero_image_url: str | None
    specialisations: list[str]
    certifications: list[str]
    price_tier: str
    moq_min: int | None
    bulk_lead_time_days: int | None
    rating_avg: float | None
    rating_count: int
    is_verified: bool
    is_featured: bool
    response_time_hours: float | None

    model_config = {"from_attributes": True}


class ManufacturerListResponse(BaseModel):
    """Paginated list response for GET /manufacturers."""
    manufacturers: list[ManufacturerListItem]
    total: int
    page: int
    limit: int


# ─── Manufacturer full profile ────────────────────────────────────────────────

class ManufacturerProfile(BaseModel):
    """
    Full profile detail as returned on the profile page.
    Extends ManufacturerListItem with all rich data + ratings.
    Maps to ManufacturerProfile in the frontend.
    """
    id: str
    profile_id: str
    slug: str
    display_name: str
    description: str | None
    hero_image_url: str | None
    gallery_image_urls: list[str]
    video_url: str | None

    country: str
    city: str | None
    year_established: int | None
    employee_count: str | None
    monthly_capacity_min: int | None
    monthly_capacity_max: int | None
    moq_min: int
    moq_max: int | None
    sample_lead_time_days: int
    bulk_lead_time_days: int

    specialisations: list[str]
    materials: list[str]
    certifications: list[str]
    export_markets: list[str]
    price_tier: str
    tech_pack_formats: list[str]
    languages: list[str]

    is_verified: bool
    is_featured: bool
    response_time_hours: float | None
    rating_avg: float | None
    rating_count: int

    # Null when the requester is not a brand / hasn't connected
    connection_status: ConnectionStatus | None

    ratings: list[ManufacturerRatingItem]

    model_config = {"from_attributes": True}


# ─── Create / Update profile ──────────────────────────────────────────────────

class CreateProfileInput(BaseModel):
    """Body for POST /manufacturers/profile (manufacturer creates their listing)."""
    display_name: str = Field(..., min_length=2, max_length=255)
    description: str | None = Field(None, max_length=5000)
    country: str = Field(..., min_length=2, max_length=2, description="ISO 3166-1 alpha-2")
    city: str | None = Field(None, max_length=100)
    price_tier: PriceTier
    moq_min: int = Field(..., ge=1, description="Minimum order quantity per style")
    moq_max: int | None = Field(None, ge=1)
    sample_lead_time_days: int = Field(..., ge=1, le=365)
    bulk_lead_time_days: int = Field(..., ge=1, le=730)
    specialisations: list[str] = Field(default_factory=list)
    materials: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    export_markets: list[str] = Field(default_factory=list)
    tech_pack_formats: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=lambda: ["English"])
    monthly_capacity_min: int | None = Field(None, ge=1)
    monthly_capacity_max: int | None = Field(None, ge=1)
    year_established: int | None = Field(None, ge=1800, le=2030)
    employee_count: str | None = None

    @field_validator("country")
    @classmethod
    def uppercase_country(cls, v: str) -> str:
        return v.upper()


class UpdateProfileInput(BaseModel):
    """Body for PATCH /manufacturers/{slug}/profile — all fields optional."""
    display_name: str | None = Field(None, min_length=2, max_length=255)
    description: str | None = Field(None, max_length=5000)
    city: str | None = None
    price_tier: PriceTier | None = None
    moq_min: int | None = Field(None, ge=1)
    moq_max: int | None = Field(None, ge=1)
    sample_lead_time_days: int | None = Field(None, ge=1, le=365)
    bulk_lead_time_days: int | None = Field(None, ge=1, le=730)
    specialisations: list[str] | None = None
    materials: list[str] | None = None
    certifications: list[str] | None = None
    export_markets: list[str] | None = None
    tech_pack_formats: list[str] | None = None
    languages: list[str] | None = None
    monthly_capacity_min: int | None = Field(None, ge=1)
    monthly_capacity_max: int | None = Field(None, ge=1)
    year_established: int | None = Field(None, ge=1800, le=2030)
    employee_count: str | None = None
    hero_image_url: str | None = None
    description_update: str | None = None  # alias for description in patch context


class CreateProfileResponse(BaseModel):
    """Response for POST /manufacturers/profile."""
    manufacturer_id: str
    profile_id: str
    slug: str


# ─── Connections ─────────────────────────────────────────────────────────────

class SendEnquiryInput(BaseModel):
    """Body for POST /manufacturers/connections."""
    manufacturer_profile_id: str
    message: str = Field(..., min_length=10, max_length=2000)
    requested_specialisations: list[str] = Field(default_factory=list)
    moq_required: int | None = Field(None, ge=1)


class SendEnquiryResponse(BaseModel):
    connection_id: str


class BrandConnection(BaseModel):
    """
    A connection record as seen by a brand.
    Maps to BrandConnection in the frontend.
    """
    id: str
    manufacturer_profile_id: str
    manufacturer_slug: str
    manufacturer_name: str
    manufacturer_country: str
    manufacturer_hero_image_url: str | None
    status: ConnectionStatus
    enquiry_message: str | None
    responded_at: datetime | None
    connected_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateConnectionStatusInput(BaseModel):
    """Body for PATCH /manufacturers/connections/{id}/status (manufacturer responds)."""
    status: Literal["RESPONDED", "CONNECTED", "DECLINED", "INACTIVE"]
    response_message: str | None = Field(None, max_length=2000)


# ─── Search filters ───────────────────────────────────────────────────────────

class ManufacturerSearchFilters(BaseModel):
    """
    Query parameter model for GET /manufacturers.
    Arrays arrive as comma-separated strings and are split server-side.
    """
    search: str | None = None
    country: str | None = None           # comma-separated list: "CN,VN,IN"
    specialisations: str | None = None   # comma-separated: "Woven,Knitwear"
    price_tiers: str | None = None       # comma-separated: "mid,premium"
    certifications: str | None = None    # comma-separated: "GOTS,OEKO-TEX"
    max_moq: int | None = None
    verified_only: bool = False
    page: int = Field(1, ge=1)
    limit: int = Field(12, ge=1, le=100)

    def country_list(self) -> list[str]:
        if not self.country:
            return []
        return [c.strip().upper() for c in self.country.split(",") if c.strip()]

    def specialisations_list(self) -> list[str]:
        if not self.specialisations:
            return []
        return [s.strip() for s in self.specialisations.split(",") if s.strip()]

    def price_tiers_list(self) -> list[str]:
        if not self.price_tiers:
            return []
        return [p.strip() for p in self.price_tiers.split(",") if p.strip()]

    def certifications_list(self) -> list[str]:
        if not self.certifications:
            return []
        return [c.strip() for c in self.certifications.split(",") if c.strip()]

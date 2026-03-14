"""Brand schemas."""
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class BrandBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    website: str | None = None
    country: str | None = Field(None, min_length=2, max_length=2)


class BrandCreate(BrandBase):
    brand_code: str = Field(
        ..., min_length=4, max_length=4, pattern=r"^[A-Z0-9]{4}$",
        description="4-char alphanumeric brand code used in UGI (e.g. CHAR)"
    )


class BrandUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    website: str | None = None
    country: str | None = Field(None, min_length=2, max_length=2)
    is_active: bool | None = None


class BrandResponse(BrandBase):
    id: str
    brand_code: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class APIKeyCreate(BaseModel):
    name: str = Field(default="Default", max_length=100)


class APIKeyResponse(BaseModel):
    id: str
    brand_id: str
    key_prefix: str
    name: str
    is_active: bool
    last_used_at: datetime | None
    expires_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class APIKeyCreateResponse(APIKeyResponse):
    """Returned ONCE on creation — includes the raw key. Store it, it won't be shown again."""
    raw_key: str

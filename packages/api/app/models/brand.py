"""
Brand, BrandIntegration, and APIKey models.
Brands are the companies that upload garments to Loocbooc.
"""
import secrets
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class Brand(Base):
    __tablename__ = "brands"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(__import__("uuid").uuid4())
    )
    # 4-char alphanumeric code used in UGI — must be unique
    brand_code: Mapped[str] = mapped_column(String(4), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    website: Mapped[str | None] = mapped_column(String(500))
    country: Mapped[str | None] = mapped_column(String(2))  # ISO 3166-1 alpha-2
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    settings: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    garments: Mapped[list["Garment"]] = relationship("Garment", back_populates="brand")  # noqa: F821
    api_keys: Mapped[list["APIKey"]] = relationship("APIKey", back_populates="brand")
    integrations: Mapped[list["BrandIntegration"]] = relationship(
        "BrandIntegration", back_populates="brand"
    )

    def __repr__(self) -> str:
        return f"<Brand {self.brand_code}: {self.name}>"


class APIKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(__import__("uuid").uuid4())
    )
    brand_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    key_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(20), nullable=False)  # First 12 chars for display
    name: Mapped[str] = mapped_column(String(100), nullable=False, default="Default")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    brand: Mapped["Brand"] = relationship("Brand", back_populates="api_keys")

    @staticmethod
    def generate_key() -> str:
        """Generate a new API key. Returns the raw key (store only the hash)."""
        return f"lb_live_{secrets.token_urlsafe(32)}"

    def __repr__(self) -> str:
        return f"<APIKey {self.key_prefix}... for brand {self.brand_id}>"


class BrandIntegration(Base):
    __tablename__ = "brand_integrations"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(__import__("uuid").uuid4())
    )
    brand_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    integration_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # shopify, woocommerce, etc.
    config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    brand: Mapped["Brand"] = relationship("Brand", back_populates="integrations")

    def __repr__(self) -> str:
        return f"<BrandIntegration {self.integration_type} for brand {self.brand_id}>"

"""
Manufacturer marketplace models.

Three core tables:
  - Manufacturer      — the account-level entity (one per manufacturing business)
  - ManufacturerProfile — the rich public-facing marketplace profile (1:1 with Manufacturer)
  - ManufacturerRating  — brand reviews of a manufacturer (1 per brand per profile)
  - BrandManufacturerConnection — enquiry/connection lifecycle between a brand and manufacturer
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


# ─── Enums ────────────────────────────────────────────────────────────────────

class ConnectionStatus(str, enum.Enum):
    ENQUIRY = "ENQUIRY"       # Brand has sent an enquiry; awaiting response
    RESPONDED = "RESPONDED"   # Manufacturer has replied
    CONNECTED = "CONNECTED"   # Both parties have confirmed the connection
    DECLINED = "DECLINED"     # Manufacturer declined the enquiry
    INACTIVE = "INACTIVE"     # Connection went cold / was manually archived


# ─── Manufacturer (account) ───────────────────────────────────────────────────

class Manufacturer(Base):
    """
    The manufacturer account entity.
    A manufacturing business registers once; their public presence is their ManufacturerProfile.
    """
    __tablename__ = "manufacturers"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    # Sub of the Supabase/JWT user who owns this manufacturer account
    owner_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    # Relationships
    profile: Mapped["ManufacturerProfile | None"] = relationship(
        "ManufacturerProfile", back_populates="manufacturer", uselist=False,
    )

    def __repr__(self) -> str:
        return f"<Manufacturer {self.id}: {self.name}>"


# ─── ManufacturerProfile (marketplace listing) ────────────────────────────────

class ManufacturerProfile(Base):
    """
    The public marketplace profile for a manufacturer.
    One per Manufacturer account. This is what brands search and view.
    """
    __tablename__ = "manufacturer_profiles"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    manufacturer_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("manufacturers.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    # URL slug — generated from display_name + city at creation, e.g. orient-textile-hangzhou
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)

    # Core display fields
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    hero_image_url: Mapped[str | None] = mapped_column(String(1000))
    gallery_image_urls: Mapped[list[str]] = mapped_column(
        ARRAY(String), server_default="{}", nullable=False,
    )
    video_url: Mapped[str | None] = mapped_column(String(1000))

    # Location
    country: Mapped[str] = mapped_column(String(2), nullable=False, index=True)  # ISO 3166-1
    city: Mapped[str | None] = mapped_column(String(100))

    # Company facts
    year_established: Mapped[int | None] = mapped_column(Integer)
    employee_count: Mapped[str | None] = mapped_column(String(50))  # "50-100", "100-500" etc

    # Capacity
    monthly_capacity_min: Mapped[int | None] = mapped_column(Integer)
    monthly_capacity_max: Mapped[int | None] = mapped_column(Integer)

    # Order requirements
    moq_min: Mapped[int] = mapped_column(Integer, nullable=False)
    moq_max: Mapped[int | None] = mapped_column(Integer)
    sample_lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False)
    bulk_lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False)

    # Capabilities (array fields)
    specialisations: Mapped[list[str]] = mapped_column(
        ARRAY(String), server_default="{}", nullable=False,
    )
    materials: Mapped[list[str]] = mapped_column(
        ARRAY(String), server_default="{}", nullable=False,
    )
    certifications: Mapped[list[str]] = mapped_column(
        ARRAY(String), server_default="{}", nullable=False,
    )
    export_markets: Mapped[list[str]] = mapped_column(
        ARRAY(String), server_default="{}", nullable=False,
    )
    tech_pack_formats: Mapped[list[str]] = mapped_column(
        ARRAY(String), server_default="{}", nullable=False,
    )
    languages: Mapped[list[str]] = mapped_column(
        ARRAY(String), server_default="{}", nullable=False,
    )

    # Pricing tier: mass | mid | premium | luxury
    price_tier: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    # Verification & featured flags
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    # Computed / denormalised stats — updated on write
    response_time_hours: Mapped[float | None] = mapped_column(Float)  # rolling avg enquiry→respond
    rating_avg: Mapped[float | None] = mapped_column(Float)
    rating_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    # Relationships
    manufacturer: Mapped["Manufacturer"] = relationship(
        "Manufacturer", back_populates="profile",
    )
    ratings: Mapped[list["ManufacturerRating"]] = relationship(
        "ManufacturerRating",
        back_populates="manufacturer_profile",
        order_by="ManufacturerRating.created_at.desc()",
    )
    connections: Mapped[list["BrandManufacturerConnection"]] = relationship(
        "BrandManufacturerConnection", back_populates="manufacturer_profile",
    )

    def __repr__(self) -> str:
        return f"<ManufacturerProfile {self.slug}: {self.display_name}>"


# ─── ManufacturerRating ───────────────────────────────────────────────────────

class ManufacturerRating(Base):
    """
    A brand's review of a manufacturer. One rating per brand per profile.
    Adding/updating triggers a recompute of ManufacturerProfile.rating_avg.
    """
    __tablename__ = "manufacturer_ratings"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    manufacturer_profile_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("manufacturer_profiles.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    brand_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("brands.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # Denormalised for display — avoids join on every profile page load
    brand_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Scores — all 1–5 integers
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False)
    quality_score: Mapped[int] = mapped_column(Integer, nullable=False)
    communication_score: Mapped[int] = mapped_column(Integer, nullable=False)
    timeliness_score: Mapped[int] = mapped_column(Integer, nullable=False)

    review: Mapped[str | None] = mapped_column(Text)
    orders_completed: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_verified_purchase: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    # Relationships
    manufacturer_profile: Mapped["ManufacturerProfile"] = relationship(
        "ManufacturerProfile", back_populates="ratings",
    )

    __table_args__ = (
        UniqueConstraint(
            "manufacturer_profile_id", "brand_id",
            name="uq_manufacturer_rating_brand",
        ),
    )

    def __repr__(self) -> str:
        return f"<ManufacturerRating {self.id}: {self.overall_score}/5>"


# ─── BrandManufacturerConnection ──────────────────────────────────────────────

class BrandManufacturerConnection(Base):
    """
    Tracks the lifecycle of a brand → manufacturer relationship.
    One record per brand/profile pair. Status advances through a defined lifecycle.
    """
    __tablename__ = "brand_manufacturer_connections"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    brand_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("brands.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    manufacturer_profile_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("manufacturer_profiles.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    status: Mapped[ConnectionStatus] = mapped_column(
        Enum(ConnectionStatus, name="connection_status_enum", create_type=True),
        default=ConnectionStatus.ENQUIRY,
        nullable=False,
    )
    enquiry_message: Mapped[str | None] = mapped_column(Text)
    # Timestamps for each lifecycle stage (null until reached)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    # Relationships
    manufacturer_profile: Mapped["ManufacturerProfile"] = relationship(
        "ManufacturerProfile", back_populates="connections",
    )

    __table_args__ = (
        UniqueConstraint(
            "brand_id", "manufacturer_profile_id",
            name="uq_connection_brand_profile",
        ),
    )

    def __repr__(self) -> str:
        return f"<BrandManufacturerConnection {self.id}: {self.status.value}>"

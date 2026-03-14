"""
Avatar and AvatarMeasurement models.
Every consumer has a Loocbooc avatar — accurate body measurements
that enable physics-accurate virtual try-on.
"""
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class Avatar(Base):
    """
    Consumer avatar — the digital body double.
    Measurements drive fit scoring and try-on simulation.
    """
    __tablename__ = "avatars"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(__import__("uuid").uuid4())
    )
    # Owner — nullable for anonymous/guest avatars
    user_id: Mapped[str | None] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, default="My Avatar")
    # demographic
    gender: Mapped[str | None] = mapped_column(String(50))  # male, female, non_binary, other
    age_range: Mapped[str | None] = mapped_column(String(20))  # 18-25, 26-35, etc.
    # Scan source
    scan_source: Mapped[str] = mapped_column(
        String(50), nullable=False, default="manual"
    )  # manual, mobile_scan, lidar
    scan_data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    # Style profile
    style_profile: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    measurements: Mapped[list["AvatarMeasurement"]] = relationship(
        "AvatarMeasurement", back_populates="avatar", order_by="AvatarMeasurement.created_at.desc()"
    )
    try_ons: Mapped[list["TryOn"]] = relationship("TryOn", back_populates="avatar")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Avatar {self.id}: {self.name}>"


class AvatarMeasurement(Base):
    """
    Body measurements for an avatar — all in centimetres unless noted.
    Versioned so measurement updates don't invalidate historical try-ons.
    """
    __tablename__ = "avatar_measurements"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(__import__("uuid").uuid4())
    )
    avatar_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("avatars.id", ondelete="CASCADE"), nullable=False, index=True
    )
    is_current: Mapped[bool] = mapped_column(nullable=False, default=True)

    # Core measurements (cm)
    height_cm: Mapped[float | None] = mapped_column(Float)
    weight_kg: Mapped[float | None] = mapped_column(Float)
    chest_cm: Mapped[float | None] = mapped_column(Float)
    waist_cm: Mapped[float | None] = mapped_column(Float)
    hips_cm: Mapped[float | None] = mapped_column(Float)
    inseam_cm: Mapped[float | None] = mapped_column(Float)
    shoulder_width_cm: Mapped[float | None] = mapped_column(Float)
    sleeve_length_cm: Mapped[float | None] = mapped_column(Float)
    neck_cm: Mapped[float | None] = mapped_column(Float)
    thigh_cm: Mapped[float | None] = mapped_column(Float)

    # Extended measurements from LiDAR/scan
    extended_measurements: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    avatar: Mapped["Avatar"] = relationship("Avatar", back_populates="measurements")

    def __repr__(self) -> str:
        return f"<AvatarMeasurement {self.avatar_id} height={self.height_cm}cm>"

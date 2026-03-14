"""
FabricPhysics model — the physics database.
Maps fabric compositions to simulation parameters.
This is the compound data moat that gets more accurate with every garment uploaded.
"""
from datetime import datetime

from sqlalchemy import DateTime, Float, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class FabricPhysics(Base):
    """
    Physics parameters derived from fabric composition.
    Keyed by a normalized composition hash to deduplicate across garments.

    The more garments that share a composition, the higher the confidence_score
    and the more accurate the physics parameters become.
    """
    __tablename__ = "fabric_physics"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(__import__("uuid").uuid4())
    )
    # Normalized composition hash — unique index for fast lookup and deduplication
    composition_hash: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    # Human-readable composition as provided (e.g. "85% polyester 15% elastane")
    composition_raw: Mapped[str] = mapped_column(Text, nullable=False)
    # Normalized form (e.g. "elastane:0.15,polyester:0.85")
    composition_normalized: Mapped[str] = mapped_column(String(500), nullable=False)
    # Parsed fibre breakdown: {"polyester": 0.85, "elastane": 0.15}
    fibre_breakdown: Mapped[dict] = mapped_column(JSONB, nullable=False)

    # --- Physics Parameters ---
    # Drape coefficient: 0 = stiff (denim), 1 = very drapey (silk charmeuse)
    drape_coefficient: Mapped[float] = mapped_column(Float, nullable=False)
    # Stretch percentage — horizontal (across grain)
    stretch_x: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # Stretch percentage — vertical (along grain)
    stretch_y: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # Elastic recovery rate: 0 = no recovery, 1 = perfect recovery (spandex)
    recovery_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # Fabric weight in grams per square metre
    weight_gsm: Mapped[float] = mapped_column(Float, nullable=False)
    # Sheen level: 0 = flat matte, 1 = high gloss (wet look)
    sheen_level: Mapped[float] = mapped_column(Float, nullable=False, default=0.2)
    # Heat response: 0 = no response, 1 = high thermal sensitivity
    heat_response: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    # Pilling resistance: 0 = pills immediately, 1 = never pills
    pilling_resistance: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    # Breathability: 0 = fully occlusive, 1 = highly breathable
    breathability: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)

    # --- Confidence and Training ---
    # Number of garments that have contributed to this entry
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Confidence score: 0-1. Increases with more samples and validation
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    # Whether params were estimated (True) or measured/validated (False)
    is_estimated: Mapped[bool] = mapped_column(nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_fabric_physics_composition_hash", "composition_hash"),
        Index("ix_fabric_physics_drape", "drape_coefficient"),
    )

    def __repr__(self) -> str:
        return f"<FabricPhysics {self.composition_normalized} confidence={self.confidence_score:.2f}>"

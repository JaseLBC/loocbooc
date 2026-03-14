"""
TryOn and FitScore models.
Records every virtual try-on interaction and its fit assessment.
These interactions are training data for the fit prediction model.
"""
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class TryOn(Base):
    """
    A virtual try-on session — avatar + garment → fit assessment.
    Every try-on is recorded for training and analytics.
    """
    __tablename__ = "try_ons"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(__import__("uuid").uuid4())
    )
    garment_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("garments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    avatar_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("avatars.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Size being tried
    size: Mapped[str | None] = mapped_column(String(20))
    # Scoring method used: rule_based, ml_v1, etc.
    scoring_method: Mapped[str] = mapped_column(String(50), nullable=False, default="rule_based")
    # Consumer feedback (optional — provided after actual purchase/wear)
    consumer_feedback: Mapped[str | None] = mapped_column(
        String(20)
    )  # too_small, fits_well, too_large
    consumer_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    garment: Mapped["Garment"] = relationship("Garment", back_populates="try_ons")  # noqa: F821
    avatar: Mapped["Avatar"] = relationship("Avatar", back_populates="try_ons")  # noqa: F821
    fit_score: Mapped["FitScore | None"] = relationship(
        "FitScore", back_populates="try_on", uselist=False
    )

    def __repr__(self) -> str:
        return f"<TryOn {self.id}: garment={self.garment_id} avatar={self.avatar_id}>"


class FitScore(Base):
    """
    Detailed fit scoring for a try-on session.
    Covers all key body measurement zones.
    """
    __tablename__ = "fit_scores"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(__import__("uuid").uuid4())
    )
    try_on_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("try_ons.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True
    )
    # Overall fit score 0-1 (1 = perfect fit)
    overall: Mapped[float] = mapped_column(Float, nullable=False)
    # Zone-level assessments: perfect, good, tight, loose, slightly_tight, slightly_loose
    chest_fit: Mapped[str | None] = mapped_column(String(30))
    waist_fit: Mapped[str | None] = mapped_column(String(30))
    hips_fit: Mapped[str | None] = mapped_column(String(30))
    length_fit: Mapped[str | None] = mapped_column(String(30))  # too_short, good, slightly_long, etc.
    shoulder_fit: Mapped[str | None] = mapped_column(String(30))
    sleeve_fit: Mapped[str | None] = mapped_column(String(30))
    # Final recommendation
    recommendation: Mapped[str | None] = mapped_column(
        String(50)
    )  # size_up, size_down, true_to_size, size_up_2
    # Raw measurement deltas (garment spec vs avatar measurement, cm)
    measurement_deltas: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    # Full details for debugging / ML training
    raw_scores: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    try_on: Mapped["TryOn"] = relationship("TryOn", back_populates="fit_score")

    def __repr__(self) -> str:
        return f"<FitScore {self.try_on_id}: overall={self.overall:.2f} rec={self.recommendation}>"

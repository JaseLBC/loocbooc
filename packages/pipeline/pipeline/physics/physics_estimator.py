"""
Physics Parameter Estimator
============================
Maps fabric composition → physics simulation parameters.

The estimator uses a base property table for each fibre type and blends them
proportionally by percentage — with non-linear corrections for key interactions:

  - Elastane (even 5%) multiplies stretch capacity dramatically
  - Silk shifts drape toward fluid even in minority percentages
  - Linen stiffens the blend non-linearly

Output is a PhysicsParameters object, which can be serialized to JSON for embedding
in GLB/LGMT files or passed directly to the simulation engine.

Usage:
    estimator = PhysicsEstimator()
    params = estimator.estimate(composition_result)
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional

from pipeline.physics.composition_parser import CompositionResult, FibreEntry

logger = logging.getLogger(__name__)


class ConfidenceLevel(str, Enum):
    HIGH = "HIGH"      # All fibres in database
    MEDIUM = "MEDIUM"  # Some fibres estimated via interpolation
    LOW = "LOW"        # One or more completely unknown fibres


@dataclass
class FibrePhysicsBase:
    drape_coefficient: float       # 0.0 (stiff/cardboard) → 1.0 (perfectly fluid)
    stretch_x: float               # Fractional elongation. 1.0 = 100% stretch
    stretch_y: float               # Bias/cross-grain stretch
    recovery_rate: float           # 0.0 (no recovery) → 1.0 (perfect recovery)
    weight_gsm_min: float          # Typical fabric weight range (g/m²)
    weight_gsm_max: float
    sheen_level: float             # 0.0 (matte) → 1.0 (mirror)
    breathability: float           # 0.0 → 1.0
    roughness_pbr: float           # PBR roughness 0.0–1.0 (inverse of sheen)
    stiffness_bending: float       # Bending stiffness for simulation (higher = stiffer)
    damping: float                 # Vibration damping (higher = faster settle)


# ---------------------------------------------------------------------------
# Base physics properties per fibre type
# Values are for a typical woven/knitted fabric of 100% that fibre.
# Simulation must scale these by actual GSM / weave structure.
# ---------------------------------------------------------------------------
FIBRE_PHYSICS_BASE: dict[str, FibrePhysicsBase] = {
    "cotton": FibrePhysicsBase(
        drape_coefficient=0.45,
        stretch_x=0.05,
        stretch_y=0.04,
        recovery_rate=0.60,
        weight_gsm_min=120,
        weight_gsm_max=300,
        sheen_level=0.10,
        breathability=0.85,
        roughness_pbr=0.85,
        stiffness_bending=0.55,
        damping=0.60,
    ),
    "polyester": FibrePhysicsBase(
        drape_coefficient=0.55,
        stretch_x=0.08,
        stretch_y=0.07,
        recovery_rate=0.85,
        weight_gsm_min=80,
        weight_gsm_max=200,
        sheen_level=0.30,
        breathability=0.45,
        roughness_pbr=0.65,
        stiffness_bending=0.40,
        damping=0.55,
    ),
    "elastane": FibrePhysicsBase(
        drape_coefficient=0.70,
        stretch_x=3.00,   # 300% stretch capacity
        stretch_y=2.50,
        recovery_rate=0.98,
        weight_gsm_min=20,
        weight_gsm_max=80,
        sheen_level=0.20,
        breathability=0.50,
        roughness_pbr=0.70,
        stiffness_bending=0.10,
        damping=0.30,
    ),
    "wool": FibrePhysicsBase(
        drape_coefficient=0.60,
        stretch_x=0.15,
        stretch_y=0.12,
        recovery_rate=0.75,
        weight_gsm_min=150,
        weight_gsm_max=450,
        sheen_level=0.12,
        breathability=0.80,
        roughness_pbr=0.88,
        stiffness_bending=0.50,
        damping=0.70,
    ),
    "silk": FibrePhysicsBase(
        drape_coefficient=0.92,    # Near-perfect drape
        stretch_x=0.10,
        stretch_y=0.08,
        recovery_rate=0.70,
        weight_gsm_min=50,
        weight_gsm_max=150,
        sheen_level=0.85,
        breathability=0.70,
        roughness_pbr=0.15,
        stiffness_bending=0.08,
        damping=0.25,
    ),
    "linen": FibrePhysicsBase(
        drape_coefficient=0.28,    # Stiff
        stretch_x=0.02,
        stretch_y=0.02,
        recovery_rate=0.40,
        weight_gsm_min=140,
        weight_gsm_max=350,
        sheen_level=0.08,
        breathability=0.92,
        roughness_pbr=0.90,
        stiffness_bending=0.80,
        damping=0.75,
    ),
    "polyamide": FibrePhysicsBase(
        drape_coefficient=0.60,
        stretch_x=0.12,
        stretch_y=0.10,
        recovery_rate=0.88,
        weight_gsm_min=70,
        weight_gsm_max=180,
        sheen_level=0.35,
        breathability=0.40,
        roughness_pbr=0.60,
        stiffness_bending=0.35,
        damping=0.50,
    ),
    "viscose": FibrePhysicsBase(
        drape_coefficient=0.75,
        stretch_x=0.07,
        stretch_y=0.06,
        recovery_rate=0.50,
        weight_gsm_min=100,
        weight_gsm_max=200,
        sheen_level=0.35,
        breathability=0.75,
        roughness_pbr=0.60,
        stiffness_bending=0.20,
        damping=0.40,
    ),
    "modal": FibrePhysicsBase(
        drape_coefficient=0.80,
        stretch_x=0.08,
        stretch_y=0.07,
        recovery_rate=0.65,
        weight_gsm_min=90,
        weight_gsm_max=180,
        sheen_level=0.30,
        breathability=0.80,
        roughness_pbr=0.65,
        stiffness_bending=0.18,
        damping=0.38,
    ),
    "lyocell": FibrePhysicsBase(
        drape_coefficient=0.78,
        stretch_x=0.06,
        stretch_y=0.05,
        recovery_rate=0.70,
        weight_gsm_min=100,
        weight_gsm_max=200,
        sheen_level=0.25,
        breathability=0.82,
        roughness_pbr=0.68,
        stiffness_bending=0.22,
        damping=0.42,
    ),
    "acrylic": FibrePhysicsBase(
        drape_coefficient=0.45,
        stretch_x=0.06,
        stretch_y=0.05,
        recovery_rate=0.70,
        weight_gsm_min=100,
        weight_gsm_max=250,
        sheen_level=0.20,
        breathability=0.40,
        roughness_pbr=0.78,
        stiffness_bending=0.48,
        damping=0.58,
    ),
    "cashmere": FibrePhysicsBase(
        drape_coefficient=0.70,
        stretch_x=0.18,
        stretch_y=0.15,
        recovery_rate=0.72,
        weight_gsm_min=100,
        weight_gsm_max=300,
        sheen_level=0.20,
        breathability=0.82,
        roughness_pbr=0.78,
        stiffness_bending=0.35,
        damping=0.62,
    ),
    "alpaca": FibrePhysicsBase(
        drape_coefficient=0.68,
        stretch_x=0.16,
        stretch_y=0.13,
        recovery_rate=0.68,
        weight_gsm_min=120,
        weight_gsm_max=320,
        sheen_level=0.25,
        breathability=0.80,
        roughness_pbr=0.72,
        stiffness_bending=0.38,
        damping=0.65,
    ),
    "mohair": FibrePhysicsBase(
        drape_coefficient=0.62,
        stretch_x=0.14,
        stretch_y=0.11,
        recovery_rate=0.70,
        weight_gsm_min=120,
        weight_gsm_max=280,
        sheen_level=0.40,
        breathability=0.75,
        roughness_pbr=0.55,
        stiffness_bending=0.40,
        damping=0.60,
    ),
    "hemp": FibrePhysicsBase(
        drape_coefficient=0.35,
        stretch_x=0.03,
        stretch_y=0.02,
        recovery_rate=0.45,
        weight_gsm_min=150,
        weight_gsm_max=400,
        sheen_level=0.08,
        breathability=0.90,
        roughness_pbr=0.92,
        stiffness_bending=0.75,
        damping=0.72,
    ),
    "bamboo": FibrePhysicsBase(
        drape_coefficient=0.72,
        stretch_x=0.07,
        stretch_y=0.06,
        recovery_rate=0.62,
        weight_gsm_min=100,
        weight_gsm_max=200,
        sheen_level=0.28,
        breathability=0.85,
        roughness_pbr=0.68,
        stiffness_bending=0.22,
        damping=0.42,
    ),
    "polypropylene": FibrePhysicsBase(
        drape_coefficient=0.48,
        stretch_x=0.05,
        stretch_y=0.04,
        recovery_rate=0.80,
        weight_gsm_min=60,
        weight_gsm_max=150,
        sheen_level=0.18,
        breathability=0.30,
        roughness_pbr=0.75,
        stiffness_bending=0.45,
        damping=0.52,
    ),
}

# Fallback for unknown fibres — mid-range cotton-like properties
_FALLBACK_PHYSICS = FibrePhysicsBase(
    drape_coefficient=0.50,
    stretch_x=0.06,
    stretch_y=0.05,
    recovery_rate=0.65,
    weight_gsm_min=120,
    weight_gsm_max=250,
    sheen_level=0.15,
    breathability=0.65,
    roughness_pbr=0.80,
    stiffness_bending=0.50,
    damping=0.60,
)


@dataclass
class PhysicsParameters:
    """
    Complete physics parameter set for a garment.
    These map to simulation inputs and PBR render parameters.
    """
    # Draping / cloth simulation
    drape_coefficient: float       # How fluidly the fabric drapes
    stretch_x: float               # Warp stretch
    stretch_y: float               # Weft/cross-grain stretch
    recovery_rate: float           # Elastic recovery after stretching
    stiffness_bending: float       # Resistance to folding
    damping: float                 # Oscillation damping

    # Weight (used for gravity simulation)
    weight_gsm_estimate: float     # Estimated grams per square meter

    # PBR render material
    sheen_level: float             # 0.0 matte → 1.0 mirror
    roughness_pbr: float           # PBR roughness (1 - sheen approx)
    breathability: float           # Environmental feel (not visual)

    # Metadata
    confidence_level: ConfidenceLevel
    confidence_score: float
    fibre_breakdown: list[dict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    unknown_fibres: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["confidence_level"] = self.confidence_level.value
        return d


class PhysicsEstimator:
    """
    Estimates physics simulation parameters from a fabric composition.

    Non-linear blending rules:
      - Elastane: multiplicative on stretch (even 5% has outsized effect)
      - Silk: additive boost to drape coefficient
      - Linen: additive stiffening on bending
    """

    def estimate(self, composition: CompositionResult) -> PhysicsParameters:
        """Estimate physics parameters from a parsed composition result."""
        if not composition.fibres:
            return self._fallback_params("No fibres in composition")

        fibres = composition.fibres
        total_pct = sum(f.percentage for f in fibres)
        if total_pct == 0:
            return self._fallback_params("Zero total percentage")

        # Normalize to 100
        normalized = [(f.fibre, f.percentage / total_pct * 100) for f in fibres]

        # Identify unknown fibres
        unknown_fibres = [name for name, _ in normalized if name not in FIBRE_PHYSICS_BASE]

        # --- Linear blend (weighted average) ---
        blended = self._linear_blend(normalized)

        # --- Non-linear corrections ---
        blended = self._apply_elastane_rule(blended, normalized)
        blended = self._apply_silk_rule(blended, normalized)
        blended = self._apply_linen_rule(blended, normalized)

        # --- Confidence ---
        known_count = sum(1 for name, _ in normalized if name in FIBRE_PHYSICS_BASE)
        conf_ratio = known_count / len(normalized)
        if conf_ratio == 1.0:
            conf_level = ConfidenceLevel.HIGH
        elif conf_ratio >= 0.5:
            conf_level = ConfidenceLevel.MEDIUM
        else:
            conf_level = ConfidenceLevel.LOW

        # Combine parser confidence with estimator confidence
        combined_confidence = round(conf_ratio * composition.confidence, 4)

        # Weight estimate: midpoint of blended range
        weight_estimate = (blended.weight_gsm_min + blended.weight_gsm_max) / 2

        warnings = list(composition.warnings)
        if unknown_fibres:
            warnings.append(
                f"Unknown fibre(s) — fallback properties used: {', '.join(unknown_fibres)}"
            )

        return PhysicsParameters(
            drape_coefficient=round(blended.drape_coefficient, 4),
            stretch_x=round(blended.stretch_x, 4),
            stretch_y=round(blended.stretch_y, 4),
            recovery_rate=round(blended.recovery_rate, 4),
            stiffness_bending=round(blended.stiffness_bending, 4),
            damping=round(blended.damping, 4),
            weight_gsm_estimate=round(weight_estimate, 1),
            sheen_level=round(blended.sheen_level, 4),
            roughness_pbr=round(blended.roughness_pbr, 4),
            breathability=round(blended.breathability, 4),
            confidence_level=conf_level,
            confidence_score=combined_confidence,
            fibre_breakdown=[{"fibre": n, "percentage": round(p, 2)} for n, p in normalized],
            warnings=warnings,
            unknown_fibres=unknown_fibres,
        )

    def estimate_from_string(self, composition_string: str) -> PhysicsParameters:
        """Convenience method: parse + estimate in one call."""
        from pipeline.physics.composition_parser import CompositionParser
        parser = CompositionParser()
        composition = parser.parse(composition_string)
        return self.estimate(composition)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _linear_blend(self, normalized: list[tuple[str, float]]) -> FibrePhysicsBase:
        """Weighted average of all fibre physics properties."""
        total_w = sum(pct for _, pct in normalized)

        def wavg(attr: str) -> float:
            s = 0.0
            for name, pct in normalized:
                base = FIBRE_PHYSICS_BASE.get(name, _FALLBACK_PHYSICS)
                s += getattr(base, attr) * pct
            return s / total_w

        return FibrePhysicsBase(
            drape_coefficient=wavg("drape_coefficient"),
            stretch_x=wavg("stretch_x"),
            stretch_y=wavg("stretch_y"),
            recovery_rate=wavg("recovery_rate"),
            weight_gsm_min=wavg("weight_gsm_min"),
            weight_gsm_max=wavg("weight_gsm_max"),
            sheen_level=wavg("sheen_level"),
            breathability=wavg("breathability"),
            roughness_pbr=wavg("roughness_pbr"),
            stiffness_bending=wavg("stiffness_bending"),
            damping=wavg("damping"),
        )

    def _apply_elastane_rule(
        self, blended: FibrePhysicsBase, normalized: list[tuple[str, float]]
    ) -> FibrePhysicsBase:
        """
        Elastane has a multiplicative effect on stretch even at low percentages.
        5% elastane roughly doubles usable stretch; 15% gives ~3.5x.
        Uses a sigmoid-like curve.
        """
        elastane_pct = sum(p for n, p in normalized if n == "elastane")
        if elastane_pct < 0.5:
            return blended

        # Stretch multiplier: 1 + 2.5 * (1 - exp(-0.15 * pct))
        multiplier = 1.0 + 2.5 * (1 - math.exp(-0.15 * elastane_pct))
        return FibrePhysicsBase(
            **{**blended.__dict__,  # type: ignore[arg-type]
               "stretch_x": min(blended.stretch_x * multiplier, 4.0),
               "stretch_y": min(blended.stretch_y * multiplier, 3.5),
               "recovery_rate": min(blended.recovery_rate * (1 + 0.005 * elastane_pct), 0.99),
               "stiffness_bending": blended.stiffness_bending * max(0.5, 1 - 0.01 * elastane_pct),
               },
        )

    def _apply_silk_rule(
        self, blended: FibrePhysicsBase, normalized: list[tuple[str, float]]
    ) -> FibrePhysicsBase:
        """
        Silk dramatically improves drape even in minority percentages.
        30% silk in a cotton/silk blend gives most of silk's drape.
        """
        silk_pct = sum(p for n, p in normalized if n == "silk")
        if silk_pct < 0.5:
            return blended

        # Drape boost: diminishing returns, saturates around 50%
        boost = 0.30 * (1 - math.exp(-0.05 * silk_pct))
        new_drape = min(1.0, blended.drape_coefficient + boost)
        return FibrePhysicsBase(
            **{**blended.__dict__,  # type: ignore[arg-type]
               "drape_coefficient": new_drape,
               "sheen_level": min(1.0, blended.sheen_level + 0.15 * silk_pct / 100),
               "roughness_pbr": max(0.05, blended.roughness_pbr - 0.15 * silk_pct / 100),
               },
        )

    def _apply_linen_rule(
        self, blended: FibrePhysicsBase, normalized: list[tuple[str, float]]
    ) -> FibrePhysicsBase:
        """
        Linen stiffens the blend non-linearly.
        50% linen in a linen/cotton blend imparts most of linen's rigidity.
        """
        linen_pct = sum(p for n, p in normalized if n == "linen")
        if linen_pct < 0.5:
            return blended

        # Stiffening: accelerates past 40%
        stiffening = 0.25 * (1 - math.exp(-0.04 * linen_pct))
        drape_reduction = 0.20 * (1 - math.exp(-0.04 * linen_pct))
        return FibrePhysicsBase(
            **{**blended.__dict__,  # type: ignore[arg-type]
               "stiffness_bending": min(1.0, blended.stiffness_bending + stiffening),
               "drape_coefficient": max(0.05, blended.drape_coefficient - drape_reduction),
               },
        )

    def _fallback_params(self, reason: str) -> PhysicsParameters:
        fb = _FALLBACK_PHYSICS
        return PhysicsParameters(
            drape_coefficient=fb.drape_coefficient,
            stretch_x=fb.stretch_x,
            stretch_y=fb.stretch_y,
            recovery_rate=fb.recovery_rate,
            stiffness_bending=fb.stiffness_bending,
            damping=fb.damping,
            weight_gsm_estimate=(fb.weight_gsm_min + fb.weight_gsm_max) / 2,
            sheen_level=fb.sheen_level,
            roughness_pbr=fb.roughness_pbr,
            breathability=fb.breathability,
            confidence_level=ConfidenceLevel.LOW,
            confidence_score=0.0,
            warnings=[f"Fallback physics used: {reason}"],
        )

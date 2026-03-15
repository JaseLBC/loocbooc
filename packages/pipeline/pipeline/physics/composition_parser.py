"""
Fabric Composition Parser
==========================
Parses raw composition strings from care labels (OCR or manual input) into
a normalized, canonical form suitable for physics lookup and database storage.

Handles:
- Multiple languages: EN, FR, IT, DE, ZH + partial support for ES, PT, NL, JA
- Spelling variants and aliases (Lycra=Elastane, Spandex=Elastane, etc.)
- Percentages that don't sum to 100 (OCR errors) — normalizes and flags
- Noisy OCR output (extra characters, line breaks, etc.)

Example:
    parser = CompositionParser()
    result = parser.parse("85% Polyester, 15% Elastane")
    # {
    #   "fibres": [{"fibre": "polyester", "percentage": 85}, {"fibre": "elastane", "percentage": 15}],
    #   "normalized_key": "elastane:15|polyester:85",
    #   "confidence": 0.95,
    #   "warnings": []
    # }
"""

from __future__ import annotations

import re
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Canonical fibre name aliases
# Covers trade names, linguistic variants, common OCR errors.
# ---------------------------------------------------------------------------
FIBRE_ALIASES: dict[str, str] = {
    # ELASTANE / SPANDEX
    "elastane": "elastane",
    "spandex": "elastane",
    "lycra": "elastane",
    "elasterell": "elastane",
    "dorlastan": "elastane",
    "elastodiene": "elastane",
    # FR
    "élasthanne": "elastane",
    "elasthanne": "elastane",
    # DE
    "elasthan": "elastane",
    # IT
    "elastan": "elastane",
    # ZH
    "氨纶": "elastane",
    "弹力纤维": "elastane",

    # POLYESTER
    "polyester": "polyester",
    "polyèster": "polyester",
    "poliéster": "polyester",
    "poliester": "polyester",
    "polyestère": "polyester",
    "polyestere": "polyester",
    "dacron": "polyester",
    "trevira": "polyester",
    "terylene": "polyester",
    # ZH
    "涤纶": "polyester",
    "聚酯纤维": "polyester",

    # COTTON
    "cotton": "cotton",
    "coton": "cotton",
    "baumwolle": "cotton",
    "cotone": "cotton",
    "algodón": "cotton",
    "algodao": "cotton",
    "katoen": "cotton",
    # ZH
    "棉": "cotton",
    "纯棉": "cotton",

    # NYLON / POLYAMIDE
    "nylon": "polyamide",
    "polyamide": "polyamide",
    "polyamid": "polyamide",
    "poliammide": "polyamide",
    "polyamide 6": "polyamide",
    "polyamide 6.6": "polyamide",
    "polyamide 66": "polyamide",
    "pa6": "polyamide",
    "pa66": "polyamide",
    "tactel": "polyamide",
    # ZH
    "锦纶": "polyamide",
    "尼龙": "polyamide",
    "聚酰胺": "polyamide",

    # WOOL
    "wool": "wool",
    "laine": "wool",
    "wolle": "wool",
    "lana": "wool",
    "wol": "wool",
    "merino": "wool",
    "cashmere": "cashmere",
    "kashmir": "cashmere",
    "cachemire": "cashmere",
    "kaschmirwolle": "cashmere",
    "lambswool": "wool",
    "alpaca": "alpaca",
    "alpaka": "alpaca",
    "mohair": "mohair",
    # ZH
    "羊毛": "wool",
    "美利奴": "wool",
    "开士米": "cashmere",

    # SILK
    "silk": "silk",
    "soie": "silk",
    "seide": "silk",
    "seta": "silk",
    "seda": "silk",
    # ZH
    "蚕丝": "silk",
    "桑蚕丝": "silk",
    "丝": "silk",

    # LINEN
    "linen": "linen",
    "lin": "linen",
    "leinen": "linen",
    "lino": "linen",
    "vlas": "linen",
    "flax": "linen",
    # ZH
    "亚麻": "linen",

    # VISCOSE / RAYON
    "viscose": "viscose",
    "rayon": "viscose",
    "viscosa": "viscose",
    "viskose": "viscose",
    "kunstzijde": "viscose",
    "lenzing viscose": "viscose",
    "ecovero": "viscose",
    # ZH
    "粘纤": "viscose",
    "人造丝": "viscose",
    "粘胶纤维": "viscose",

    # MODAL
    "modal": "modal",
    "lenzing modal": "modal",
    # ZH
    "莫代尔": "modal",

    # LYOCELL / TENCEL
    "lyocell": "lyocell",
    "tencel": "lyocell",
    "lyocell tencel": "lyocell",
    # ZH
    "莱赛尔": "lyocell",
    "天丝": "lyocell",

    # ACRYLIC
    "acrylic": "acrylic",
    "acrylique": "acrylic",
    "acryl": "acrylic",
    "acrylico": "acrylic",
    # ZH
    "腈纶": "acrylic",

    # HEMP
    "hemp": "hemp",
    "chanvre": "hemp",
    "hanf": "hemp",
    "canapa": "hemp",
    "cáñamo": "hemp",
    # ZH
    "大麻": "hemp",

    # BAMBOO
    "bamboo": "bamboo",
    "bambou": "bamboo",
    "bambus": "bamboo",
    # ZH
    "竹纤维": "bamboo",

    # POLYPROPYLENE
    "polypropylene": "polypropylene",
    "polypropylene fiber": "polypropylene",
    "pp fiber": "polypropylene",

    # COPPER / COOLMAX / etc. (trade names — treat as polyester unless more specific)
    "coolmax": "polyester",
    "dri-fit": "polyester",
    "climacool": "polyester",

    # RECYCLED VARIANTS — keep canonical but note recycled
    "recycled polyester": "polyester",
    "recycled nylon": "polyamide",
    "rpet": "polyester",
    "econyl": "polyamide",
}

# Regex patterns to detect and extract percentage + fibre pairs
# Handles "85% Polyester", "Polyester 85%", "85 % Polyester"
# Negative lookahead prevents matching temperature indicators like "30°C"
_PCT_THEN_FIBRE = re.compile(
    r"(\d{1,3}(?:[.,]\d+)?)\s*%\s+([A-Za-zÀ-ÖØ-öø-ÿ\u4e00-\u9fff][A-Za-zÀ-ÖØ-öø-ÿ\u4e00-\u9fff\s\-]*?)(?=\s*(?:\d|,|;|/|\.|$))",
    re.IGNORECASE,
)
_FIBRE_THEN_PCT = re.compile(
    r"([A-Za-zÀ-ÖØ-öø-ÿ\u4e00-\u9fff][A-Za-zÀ-ÖØ-öø-ÿ\u4e00-\u9fff\s\-]*?)\s+(\d{1,3}(?:[.,]\d+)?)\s*%(?![°\w])",
    re.IGNORECASE,
)

# Matches temperature / non-fibre contexts to strip before parsing
_WASH_INSTRUCTIONS = re.compile(
    r'\b(wash|lavar|waschen|laver|lavare|tumble|iron|dry|bleach|cycle|machine|hand|'
    r'at\s+\d+|à\s+\d+|bei\s+\d+|\d+\s*°[cCfF])\b[^,;]*',
    re.IGNORECASE,
)

# Language-specific percentage words
_PERCENT_WORDS = re.compile(
    r"\b(percent|pour cent|prozent|percento|por ciento|pourcent)\b", re.IGNORECASE
)


@dataclass
class FibreEntry:
    fibre: str
    percentage: float


@dataclass
class CompositionResult:
    fibres: list[FibreEntry]
    normalized_key: str
    confidence: float
    warnings: list[str] = field(default_factory=list)
    raw_input: str = ""
    total_percentage: float = 0.0

    def to_dict(self) -> dict:
        return {
            "fibres": [{"fibre": f.fibre, "percentage": f.percentage} for f in self.fibres],
            "normalized_key": self.normalized_key,
            "confidence": self.confidence,
            "warnings": self.warnings,
            "raw_input": self.raw_input,
            "total_percentage": self.total_percentage,
        }


class CompositionParser:
    """
    Parses garment fabric composition strings into normalized physics-ready output.
    Thread-safe and stateless — safe to share across workers.
    """

    def __init__(self, extra_aliases: Optional[dict[str, str]] = None):
        self._aliases = {**FIBRE_ALIASES}
        if extra_aliases:
            self._aliases.update({k.lower(): v for k, v in extra_aliases.items()})

    def parse(self, raw: str) -> CompositionResult:
        """Parse a raw composition string and return a normalized CompositionResult."""
        warnings: list[str] = []
        original = raw

        # --- Pre-processing ---
        text = raw.strip()
        # Strip wash/care instructions so "30°C" doesn't get parsed as "30% C"
        text = _WASH_INSTRUCTIONS.sub(" ", text)
        # Replace common separators with comma for uniform parsing
        text = re.sub(r"[;\|/]", ",", text)
        # Normalize percent symbols
        text = _PERCENT_WORDS.sub("%", text)
        # Normalize decimal separator: European comma → period (but only in numbers)
        text = re.sub(r"(\d),(\d)", r"\1.\2", text)
        # Collapse whitespace
        text = re.sub(r"\s+", " ", text)

        # --- Extract fibre/percentage pairs ---
        entries = self._extract_pairs(text)

        if not entries:
            warnings.append("No fibre/percentage pairs could be extracted from input.")
            return CompositionResult(
                fibres=[],
                normalized_key="",
                confidence=0.0,
                warnings=warnings,
                raw_input=original,
            )

        # --- Canonicalize fibre names ---
        resolved: list[tuple[str, float, bool]] = []  # (canonical_name, pct, known)
        for name, pct in entries:
            canonical, known = self._resolve_fibre(name)
            if not known:
                warnings.append(f"Unknown fibre name '{name}' — kept as-is.")
            resolved.append((canonical, pct, known))

        # --- Percentage normalization ---
        total = sum(pct for _, pct, _ in resolved)
        if abs(total - 100.0) > 0.5:
            warnings.append(f"Percentages sum to {total:.1f}% (expected 100%). Normalizing.")
            if total > 0:
                resolved = [(n, round(p / total * 100, 2), k) for n, p, k in resolved]
                total = 100.0

        # --- Confidence score ---
        known_count = sum(1 for _, _, k in resolved if k)
        base_conf = known_count / len(resolved)
        # Penalize if sum was way off
        if abs(total - 100.0) > 5:
            base_conf *= 0.9
        # Penalize for unknown fibres weighted by their percentage contribution
        for name, pct, known in resolved:
            if not known:
                base_conf -= (pct / 100.0) * 0.5  # Unknown at X% removes X/200 from confidence
        confidence = round(min(1.0, max(0.0, base_conf)), 4)

        # --- Build output ---
        fibres = [FibreEntry(fibre=n, percentage=p) for n, p, _ in resolved]
        # Sort by percentage desc for normalized_key
        sorted_fibres = sorted(fibres, key=lambda f: (f.fibre,))  # alpha sort for stable key
        normalized_key = "|".join(f"{f.fibre}:{f.percentage:.0f}" for f in sorted_fibres)

        return CompositionResult(
            fibres=fibres,
            normalized_key=normalized_key,
            confidence=confidence,
            warnings=warnings,
            raw_input=original,
            total_percentage=round(sum(f.percentage for f in fibres), 2),
        )

    def _extract_pairs(self, text: str) -> list[tuple[str, float]]:
        """Extract (fibre_name, percentage) tuples from normalized text."""
        pairs: list[tuple[str, float]] = []
        seen_spans: set[tuple[int, int]] = set()

        # Try "XX% Fibre" pattern first (most common in EN/FR/DE)
        for m in _PCT_THEN_FIBRE.finditer(text):
            pct = float(m.group(1))
            name = m.group(2).strip().lower()
            if self._is_valid_pair(pct, name):
                span = (m.start(), m.end())
                if not any(self._spans_overlap(span, s) for s in seen_spans):
                    pairs.append((name, pct))
                    seen_spans.add(span)

        # Try "Fibre XX%" pattern (common in IT, ZH, some EN)
        for m in _FIBRE_THEN_PCT.finditer(text):
            name = m.group(1).strip().lower()
            pct = float(m.group(2))
            if self._is_valid_pair(pct, name):
                span = (m.start(), m.end())
                if not any(self._spans_overlap(span, s) for s in seen_spans):
                    pairs.append((name, pct))
                    seen_spans.add(span)

        # Deduplicate by fibre name (keep highest pct in case of duplicate)
        deduped: dict[str, float] = {}
        for name, pct in pairs:
            if name not in deduped or pct > deduped[name]:
                deduped[name] = pct

        return list(deduped.items())

    def _is_valid_pair(self, pct: float, name: str) -> bool:
        """Basic sanity check on a parsed pair."""
        if not (0 < pct <= 100):
            return False
        if len(name) < 2:
            return False
        # Filter out noise words
        noise = {"the", "and", "or", "de", "du", "der", "die", "das", "le", "la", "di"}
        if name in noise:
            return False
        return True

    def _resolve_fibre(self, name: str) -> tuple[str, bool]:
        """Resolve a raw fibre name to its canonical form."""
        cleaned = name.strip().lower()
        # Direct lookup
        if cleaned in self._aliases:
            return self._aliases[cleaned], True
        # Partial match — try stripping trailing qualifier words
        cleaned_stripped = re.sub(r"\s+(fiber|fibre|yarn|thread|based)$", "", cleaned).strip()
        if cleaned_stripped in self._aliases:
            return self._aliases[cleaned_stripped], True
        # Fuzzy match: check if any alias is a substring of the input or vice versa
        for alias, canonical in self._aliases.items():
            if alias in cleaned or cleaned in alias:
                return canonical, True
        # Unknown — return as-is (normalized)
        return cleaned, False

    @staticmethod
    def _spans_overlap(a: tuple[int, int], b: tuple[int, int]) -> bool:
        return a[0] < b[1] and b[0] < a[1]

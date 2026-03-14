"""
Tests for fabric composition parser and physics estimator.
These are the most critical tests — physics is the core technical moat.
"""

import pytest
from pipeline.physics.composition_parser import CompositionParser, CompositionResult
from pipeline.physics.physics_estimator import (
    PhysicsEstimator,
    PhysicsParameters,
    ConfidenceLevel,
    FIBRE_PHYSICS_BASE,
)


# ---------------------------------------------------------------------------
# CompositionParser Tests
# ---------------------------------------------------------------------------

class TestCompositionParser:
    def setup_method(self):
        self.parser = CompositionParser()

    def test_simple_english_polyester_elastane(self):
        result = self.parser.parse("85% Polyester, 15% Elastane")
        assert result.confidence > 0.9
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "polyester" in fibres
        assert "elastane" in fibres
        assert fibres["polyester"] == pytest.approx(85, abs=1)
        assert fibres["elastane"] == pytest.approx(15, abs=1)

    def test_100_percent_cotton(self):
        result = self.parser.parse("Cotton 100%")
        assert len(result.fibres) == 1
        assert result.fibres[0].fibre == "cotton"
        assert result.fibres[0].percentage == pytest.approx(100, abs=1)

    def test_fibre_then_percent_format(self):
        """Test 'Fibre XX%' format common in Italian labels."""
        result = self.parser.parse("Poliestere 55%, Cotone 45%")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "polyester" in fibres
        assert "cotton" in fibres

    def test_french_composition(self):
        result = self.parser.parse("85% Polyestère, 15% Élasthanne")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "polyester" in fibres
        assert "elastane" in fibres

    def test_german_composition(self):
        result = self.parser.parse("95% Baumwolle, 5% Elasthan")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "cotton" in fibres
        assert "elastane" in fibres

    def test_chinese_composition(self):
        """Test Chinese fibre names (common on garment labels)."""
        result = self.parser.parse("80% 涤纶, 20% 棉")
        # At least one fibre should be recognized
        assert len(result.fibres) >= 1

    def test_trade_name_lycra_maps_to_elastane(self):
        result = self.parser.parse("85% Polyester, 15% Lycra")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "elastane" in fibres, "Lycra should map to elastane"

    def test_trade_name_spandex_maps_to_elastane(self):
        result = self.parser.parse("85% Nylon, 15% Spandex")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "elastane" in fibres, "Spandex should map to elastane"
        assert "polyamide" in fibres, "Nylon should map to polyamide"

    def test_tencel_maps_to_lyocell(self):
        result = self.parser.parse("100% Tencel")
        assert result.fibres[0].fibre == "lyocell"

    def test_nylon_maps_to_polyamide(self):
        result = self.parser.parse("80% Nylon, 20% Cotton")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "polyamide" in fibres

    def test_ocr_error_percentages_dont_sum_to_100(self):
        """OCR might misread percentages — should normalize and warn."""
        result = self.parser.parse("87% Polyester, 18% Elastane")  # Sums to 105%
        assert len(result.warnings) > 0
        assert any("sum" in w.lower() or "normaliz" in w.lower() for w in result.warnings)
        total = sum(f.percentage for f in result.fibres)
        assert total == pytest.approx(100.0, abs=0.5)

    def test_ocr_error_low_total(self):
        """OCR might drop a digit."""
        result = self.parser.parse("8% Polyester, 92% Cotton")  # Could be 85% OCR'd as 8%
        # Should parse but might warn
        assert len(result.fibres) == 2

    def test_normalized_key_is_alphabetically_sorted(self):
        result = self.parser.parse("85% Polyester, 15% Elastane")
        # Key should be alphabetically sorted for stable DB lookup
        assert result.normalized_key.startswith("elastane:"), \
            f"Expected elastane first (alphabetically), got: {result.normalized_key}"

    def test_linen_cotton_blend(self):
        result = self.parser.parse("55% Linen 45% Cotton")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "linen" in fibres
        assert "cotton" in fibres
        assert fibres["linen"] == pytest.approx(55, abs=2)

    def test_complex_blend(self):
        result = self.parser.parse("45% Cotton, 30% Polyester, 20% Wool, 5% Lycra")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert len(result.fibres) == 4
        assert "cotton" in fibres
        assert "polyester" in fibres
        assert "wool" in fibres
        assert "elastane" in fibres  # Lycra → elastane

    def test_unknown_fibre_flagged(self):
        result = self.parser.parse("60% Mytextile, 40% Cotton")
        assert any("unknown" in w.lower() or "mytextile" in w.lower() for w in result.warnings)
        assert result.confidence < 1.0

    def test_empty_string_returns_empty(self):
        result = self.parser.parse("")
        assert len(result.fibres) == 0
        assert result.confidence == 0.0

    def test_noise_in_string(self):
        """Simulate OCR garbage."""
        result = self.parser.parse("Care label: 85% Polyester, 15% Elastane. Wash at 30°C.")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "polyester" in fibres
        assert "elastane" in fibres

    def test_semicolon_separator(self):
        result = self.parser.parse("80% Cotton; 20% Polyester")
        assert len(result.fibres) == 2

    def test_slash_separator(self):
        result = self.parser.parse("80% Cotton / 20% Polyester")
        assert len(result.fibres) == 2

    def test_recycled_polyester_maps_correctly(self):
        result = self.parser.parse("100% Recycled Polyester")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "polyester" in fibres


# ---------------------------------------------------------------------------
# PhysicsEstimator Tests
# ---------------------------------------------------------------------------

class TestPhysicsEstimator:
    def setup_method(self):
        self.parser = CompositionParser()
        self.estimator = PhysicsEstimator()

    def _estimate(self, composition_str: str) -> PhysicsParameters:
        comp = self.parser.parse(composition_str)
        return self.estimator.estimate(comp)

    def test_all_common_fibres_in_database(self):
        """Verify all expected fibres are in the physics database."""
        expected = [
            "cotton", "polyester", "elastane", "wool", "silk", "linen",
            "polyamide", "viscose", "modal", "lyocell", "acrylic",
            "cashmere", "alpaca", "mohair", "hemp", "bamboo",
        ]
        for fibre in expected:
            assert fibre in FIBRE_PHYSICS_BASE, f"Fibre '{fibre}' missing from physics database"

    def test_pure_cotton_physics(self):
        params = self._estimate("100% Cotton")
        assert params.confidence_level == ConfidenceLevel.HIGH
        assert 0.3 <= params.drape_coefficient <= 0.6
        assert params.stretch_x < 0.2  # Cotton barely stretches
        assert params.recovery_rate < 0.8  # Cotton has poor recovery

    def test_pure_silk_high_drape(self):
        params = self._estimate("100% Silk")
        assert params.drape_coefficient > 0.8  # Silk drapes extremely well
        assert params.sheen_level > 0.7  # High sheen

    def test_pure_linen_low_drape(self):
        params = self._estimate("100% Linen")
        assert params.drape_coefficient < 0.4  # Linen is stiff
        assert params.stiffness_bending > 0.6

    def test_elastane_stretch_multiplier(self):
        """Even 5% elastane should dramatically increase stretch."""
        pure_cotton = self._estimate("100% Cotton")
        cotton_with_elastane = self._estimate("95% Cotton, 5% Elastane")
        assert cotton_with_elastane.stretch_x > pure_cotton.stretch_x * 1.5, \
            "5% elastane should at least 1.5x the stretch of pure cotton"

    def test_elastane_15pct_high_stretch(self):
        params = self._estimate("85% Polyester, 15% Elastane")
        assert params.stretch_x > 0.5  # Should be substantial stretch
        assert params.recovery_rate > 0.9  # Good recovery

    def test_silk_drape_boost_in_blend(self):
        """30% silk in a blend should push drape coefficient up significantly."""
        pure_polyester = self._estimate("100% Polyester")
        silk_polyester = self._estimate("70% Polyester, 30% Silk")
        assert silk_polyester.drape_coefficient > pure_polyester.drape_coefficient + 0.05

    def test_linen_stiffening_in_blend(self):
        """Linen should stiffen even a 50% blend vs pure cotton."""
        pure_cotton = self._estimate("100% Cotton")
        linen_cotton = self._estimate("50% Linen, 50% Cotton")
        assert linen_cotton.stiffness_bending > pure_cotton.stiffness_bending

    def test_confidence_high_for_known_fibres(self):
        params = self._estimate("100% Cotton")
        assert params.confidence_level == ConfidenceLevel.HIGH

    def test_confidence_low_for_unknown_fibres(self):
        params = self._estimate("100% Mytextile")
        assert params.confidence_level == ConfidenceLevel.LOW

    def test_confidence_medium_for_partial_known(self):
        params = self._estimate("80% Cotton, 20% Mytextile")
        assert params.confidence_level in (ConfidenceLevel.MEDIUM, ConfidenceLevel.LOW)

    def test_physics_params_are_normalized(self):
        """All physics params should be in valid ranges."""
        params = self._estimate("85% Polyester, 15% Elastane")
        assert 0.0 <= params.drape_coefficient <= 1.0
        assert 0.0 <= params.sheen_level <= 1.0
        assert 0.0 <= params.roughness_pbr <= 1.0
        assert 0.0 <= params.recovery_rate <= 1.0
        assert 0.0 <= params.breathability <= 1.0
        assert params.weight_gsm_estimate > 0

    def test_wool_physics(self):
        params = self._estimate("100% Wool")
        assert params.confidence_level == ConfidenceLevel.HIGH
        assert params.weight_gsm_estimate > 150
        assert params.breathability > 0.7

    def test_viscose_high_drape(self):
        params = self._estimate("100% Viscose")
        assert params.drape_coefficient > 0.6

    def test_to_dict_is_serializable(self):
        """Physics params should be JSON-serializable."""
        import json
        params = self._estimate("100% Cotton")
        d = params.to_dict()
        json_str = json.dumps(d)
        loaded = json.loads(json_str)
        assert loaded["confidence_level"] == "HIGH"

    def test_estimate_from_string_convenience(self):
        """Test the convenience one-shot method."""
        params = self.estimator.estimate_from_string("100% Cotton")
        assert params.drape_coefficient > 0

    def test_blend_weight_gsm_is_reasonable(self):
        """Estimated GSM should be in realistic fabric range."""
        params = self._estimate("100% Cotton")
        # 100% cotton woven: 120–300 g/m²
        assert 80 <= params.weight_gsm_estimate <= 350

    def test_fibre_breakdown_in_output(self):
        params = self._estimate("85% Polyester, 15% Elastane")
        assert len(params.fibre_breakdown) == 2
        fibres = {fb["fibre"]: fb["percentage"] for fb in params.fibre_breakdown}
        assert "polyester" in fibres
        assert "elastane" in fibres

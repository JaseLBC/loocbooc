"""
Edge case tests for the composition parser.
Covers OCR artifacts, non-standard formats, and security/robustness scenarios.
"""
import pytest
from pipeline.physics.composition_parser import CompositionParser


class TestAllCapsInput:
    """Test all-caps input (common from OCR on care labels)."""

    def setup_method(self):
        self.parser = CompositionParser()

    def test_all_caps_polyester_elastane(self):
        result = self.parser.parse("85% POLYESTER, 15% ELASTANE")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "polyester" in fibres
        assert "elastane" in fibres

    def test_all_caps_cotton(self):
        result = self.parser.parse("100% COTTON")
        assert len(result.fibres) == 1
        assert result.fibres[0].fibre == "cotton"

    def test_all_caps_mixed_fibres(self):
        result = self.parser.parse("60% LINEN, 40% COTTON")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "linen" in fibres
        assert "cotton" in fibres

    def test_all_caps_trade_name_lycra(self):
        result = self.parser.parse("85% POLYESTER, 15% LYCRA")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "elastane" in fibres, "LYCRA in all-caps should map to elastane"

    def test_all_caps_wool(self):
        result = self.parser.parse("80% WOOL, 20% CASHMERE")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "wool" in fibres
        assert "cashmere" in fibres


class TestReversedOrderInput:
    """Test 'Fibre XX%' reversed format."""

    def setup_method(self):
        self.parser = CompositionParser()

    def test_reversed_single_fibre(self):
        result = self.parser.parse("Cotton 100%")
        assert len(result.fibres) >= 1
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "cotton" in fibres

    def test_reversed_two_fibres(self):
        result = self.parser.parse("Polyester 85%, Elastane 15%")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "polyester" in fibres
        assert "elastane" in fibres

    def test_reversed_all_caps(self):
        result = self.parser.parse("ELASTANE 15%, POLYESTER 85%")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "elastane" in fibres
        assert fibres.get("elastane", 0) == pytest.approx(15, abs=2)

    def test_reversed_no_comma(self):
        """Some labels omit the comma between entries."""
        result = self.parser.parse("Wool 80% Cashmere 20%")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        # At least one fibre should be found
        assert len(result.fibres) >= 1


class TestFractionFormat:
    """Test '100% Cotton' style (already in existing tests) — confirm edge cases."""

    def setup_method(self):
        self.parser = CompositionParser()

    def test_100_percent_single_fibre(self):
        for fibre, canonical in [
            ("Cotton", "cotton"),
            ("Silk", "silk"),
            ("Linen", "linen"),
            ("Wool", "wool"),
            ("Polyester", "polyester"),
            ("Viscose", "viscose"),
            ("Modal", "modal"),
            ("Lyocell", "lyocell"),
        ]:
            result = self.parser.parse(f"100% {fibre}")
            assert len(result.fibres) == 1, f"Expected 1 fibre for 100% {fibre}"
            assert result.fibres[0].fibre == canonical, f"Expected '{canonical}' for {fibre}"
            assert result.fibres[0].percentage == pytest.approx(100, abs=1)

    def test_decimal_percentage(self):
        """Some labels show decimal percentages."""
        result = self.parser.parse("97.5% Cotton, 2.5% Elastane")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "cotton" in fibres
        assert fibres["cotton"] == pytest.approx(97.5, abs=1)


class TestUnknownFibres:
    """Test handling of fibres not in the database."""

    def setup_method(self):
        self.parser = CompositionParser()

    def test_completely_unknown_fibre(self):
        result = self.parser.parse("100% Quantumfibre")
        assert len(result.warnings) > 0
        assert result.confidence < 1.0
        # Should still return the fibre as-is
        assert len(result.fibres) == 1

    def test_partial_known_unknown(self):
        result = self.parser.parse("80% Cotton, 20% Unknownfibre")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "cotton" in fibres
        assert result.confidence < 1.0
        assert len(result.warnings) > 0

    def test_unknown_fibre_name_preserved(self):
        """Unknown fibre should be preserved as-is (normalized to lowercase)."""
        result = self.parser.parse("100% Superfabric2000")
        assert len(result.fibres) == 1
        assert result.fibres[0].fibre == "superfabric2000"

    def test_empty_input(self):
        result = self.parser.parse("")
        assert len(result.fibres) == 0
        assert result.confidence == 0.0
        assert result.normalized_key == ""

    def test_whitespace_only_input(self):
        result = self.parser.parse("   ")
        assert len(result.fibres) == 0
        assert result.confidence == 0.0


class TestNonUTF8AndOCRNoise:
    """Test handling of garbled OCR output."""

    def setup_method(self):
        self.parser = CompositionParser()

    def test_temperature_in_string_not_parsed_as_fibre(self):
        """'30°C' should not be parsed as '30% C'."""
        result = self.parser.parse("100% Cotton. Machine wash at 30°C.")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "cotton" in fibres
        # Should not have a fibre called "c" or "c." from the temperature
        for fibre in result.fibres:
            assert fibre.fibre != "c"

    def test_extra_whitespace_and_newlines(self):
        result = self.parser.parse("85%  Polyester\n15%  Elastane")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "polyester" in fibres
        assert "elastane" in fibres

    def test_mixed_separators(self):
        result = self.parser.parse("60% Cotton; 30% Polyester / 10% Elastane")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "cotton" in fibres
        assert "polyester" in fibres
        assert "elastane" in fibres

    def test_european_decimal_comma(self):
        """European labels use comma as decimal separator: '97,5% Cotton'."""
        result = self.parser.parse("97,5% Cotton, 2,5% Elastane")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "cotton" in fibres
        if "cotton" in fibres:
            assert fibres["cotton"] == pytest.approx(97.5, abs=2)

    def test_care_label_noise(self):
        """Full care label with wash instructions mixed in."""
        label = (
            "COMPOSITION: 85% Polyester, 15% Elastane. "
            "CARE: Machine wash cold. Tumble dry low. Do not iron. "
            "Wash at 30°C max."
        )
        result = self.parser.parse(label)
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "polyester" in fibres
        assert "elastane" in fibres

    def test_percent_with_space(self):
        """Some labels have space between number and percent: '85 % Polyester'."""
        result = self.parser.parse("85 % Polyester, 15 % Elastane")
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "polyester" in fibres
        assert "elastane" in fibres

    def test_chinese_composition(self):
        """Test multilingual Chinese input — fibres may be partially recognized."""
        result = self.parser.parse("80% 涤纶, 20% 氨纶")
        # At least one fibre should be recognized
        assert len(result.fibres) >= 1
        fibres = {f.fibre: f.percentage for f in result.fibres}
        assert "polyester" in fibres or len(result.fibres) > 0

    def test_does_not_crash_on_empty_segments(self):
        """Consecutive separators should not crash."""
        result = self.parser.parse(",,, 100% Cotton ,,,")
        assert len(result.fibres) >= 1


class TestNormalizedKey:
    """Test that the normalized key is stable and correctly sorted."""

    def setup_method(self):
        self.parser = CompositionParser()

    def test_key_alphabetically_sorted(self):
        """Normalized key should be alphabetical regardless of input order."""
        result1 = self.parser.parse("85% Polyester, 15% Elastane")
        result2 = self.parser.parse("15% Elastane, 85% Polyester")
        assert result1.normalized_key == result2.normalized_key

    def test_key_case_insensitive(self):
        result1 = self.parser.parse("85% POLYESTER, 15% ELASTANE")
        result2 = self.parser.parse("85% polyester, 15% elastane")
        assert result1.normalized_key == result2.normalized_key

    def test_key_format(self):
        result = self.parser.parse("85% Polyester, 15% Elastane")
        # Format: "fibre1:pct|fibre2:pct" alphabetically sorted
        assert "elastane:" in result.normalized_key
        assert "polyester:" in result.normalized_key
        assert "|" in result.normalized_key

    def test_single_fibre_key(self):
        result = self.parser.parse("100% Cotton")
        assert result.normalized_key == "cotton:100"

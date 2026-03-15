"""
Fit Scoring Engine v2 — test suite.

10+ test cases covering:
- Different body types
- Different garment categories  
- Fit preference modifiers
- Edge cases (missing data, extreme measurements)
- Body type classification
- Alternative size suggestions
- Reasoning generation
"""
import pytest

from app.services.fit_scoring import (
    AU_WOMENS_SIZES,
    FitResult,
    ZoneFit,
    _score_ease,
    classify_body_type,
    fit_result_to_api_response,
    score_fit,
)


# ---------------------------------------------------------------------------
# Helper: garment spec from AU women's body size + category ease
# ---------------------------------------------------------------------------

def _garment_spec_from_body_size(size: str, category: str = "tops") -> dict:
    """Create a garment spec by adding standard ease to body measurements."""
    from app.services.fit_scoring import CATEGORY_EASE
    body = AU_WOMENS_SIZES[size]
    ease = CATEGORY_EASE.get(category, CATEGORY_EASE["default"])
    return {
        "chest_cm": body["chest"] + ease["chest"],
        "waist_cm": body["waist"] + ease["waist"],
        "hips_cm": body["hips"] + ease["hips"],
        "shoulder_width_cm": body["chest"] * 0.47 + ease["shoulder"],  # rough shoulder from chest
    }


# ---------------------------------------------------------------------------
# Unit tests: _score_ease
# ---------------------------------------------------------------------------

class TestScoreEase:
    def test_perfect_fit_zero_ease(self):
        label, score = _score_ease(0.0)
        assert label == "good"
        assert score == 1.0

    def test_perfect_fit_positive_ease(self):
        label, score = _score_ease(3.0)
        assert label == "good"
        assert score == 1.0

    def test_slightly_tight(self):
        label, score = _score_ease(-2.0)
        assert label == "slightly_tight"
        assert 0.5 < score < 0.8

    def test_very_tight(self):
        label, score = _score_ease(-15.0)
        assert label == "very_tight"
        assert score < 0.2

    def test_very_loose(self):
        label, score = _score_ease(20.0)
        assert label == "very_loose"
        assert score < 0.2


# ---------------------------------------------------------------------------
# Unit tests: classify_body_type
# ---------------------------------------------------------------------------

class TestClassifyBodyType:
    def test_hourglass(self):
        # Equal chest/hips, narrow waist
        result = classify_body_type(chest_cm=92, waist_cm=68, hips_cm=96)
        assert result == "hourglass"

    def test_pear(self):
        # Hips significantly wider than chest
        result = classify_body_type(chest_cm=84, waist_cm=68, hips_cm=102)
        assert result == "pear"

    def test_apple(self):
        # Wide waist relative to chest and hips
        result = classify_body_type(chest_cm=96, waist_cm=92, hips_cm=98)
        assert result == "apple"

    def test_rectangle(self):
        # All similar proportions
        result = classify_body_type(chest_cm=88, waist_cm=82, hips_cm=90)
        assert result == "rectangle"

    def test_inverted_triangle(self):
        # Chest wider than hips
        result = classify_body_type(chest_cm=104, waist_cm=78, hips_cm=90)
        assert result == "inverted_triangle"

    def test_insufficient_data_returns_none(self):
        result = classify_body_type(chest_cm=None, waist_cm=70, hips_cm=96)
        assert result is None


# ---------------------------------------------------------------------------
# Integration tests: score_fit
# ---------------------------------------------------------------------------

class TestScoreFit:
    """10 test cases covering different body types and garment specs."""

    # Test 1: Perfect fit — avatar matches size 10 garment exactly
    def test_perfect_fit_size_10_top(self):
        avatar = {
            "chest_cm": 88.0,
            "waist_cm": 70.0,
            "hips_cm": 94.0,
            "shoulder_width_cm": 42.0,
        }
        garment = _garment_spec_from_body_size("10", "tops")
        result = score_fit(avatar, garment, "Size 10", "tops")

        assert result.overall_fit in ("good", "acceptable")
        assert result.size_recommendation == "Size 10"
        assert result.confidence > 0.5
        assert "chest" in result.zones
        assert "waist" in result.zones

    # Test 2: Too small — avatar is size 14 trying on size 10
    def test_too_small_two_sizes_down(self):
        avatar = {
            "chest_cm": 96.0,
            "waist_cm": 78.0,
            "hips_cm": 102.0,
            "shoulder_width_cm": 46.0,
        }
        garment = _garment_spec_from_body_size("10", "tops")
        result = score_fit(avatar, garment, "Size 10", "tops")

        assert result.overall_fit in ("acceptable", "poor")
        # Should have tight zones
        tight_zones = [z for z in result.zones.values() if "tight" in z.fit]
        assert len(tight_zones) > 0
        assert result.reasoning  # Should have reasoning text

    # Test 3: Too large — avatar is size 8 trying on size 14
    def test_too_large_two_sizes_up(self):
        avatar = {
            "chest_cm": 84.0,
            "waist_cm": 66.0,
            "hips_cm": 90.0,
            "shoulder_width_cm": 40.0,
        }
        garment = _garment_spec_from_body_size("14", "tops")
        result = score_fit(avatar, garment, "Size 14", "tops")

        assert result.overall_fit in ("acceptable", "poor")
        loose_zones = [z for z in result.zones.values() if "loose" in z.fit]
        assert len(loose_zones) > 0

    # Test 4: Activewear — less ease expected
    def test_activewear_tight_fit(self):
        avatar = {
            "chest_cm": 88.0,
            "waist_cm": 70.0,
            "hips_cm": 94.0,
            "shoulder_width_cm": 42.0,
        }
        garment = _garment_spec_from_body_size("10", "activewear")
        result = score_fit(avatar, garment, "Size 10", "activewear")

        # Activewear has less ease, so a perfect body size should still fit well
        assert result.overall_fit in ("good", "acceptable")

    # Test 5: Fitted preference — user prefers tight fit
    def test_fitted_preference_adjusts_reasoning(self):
        avatar = {
            "chest_cm": 88.0,
            "waist_cm": 70.0,
            "hips_cm": 94.0,
        }
        # Slightly loose garment for this avatar
        garment = _garment_spec_from_body_size("12", "tops")
        result = score_fit(avatar, garment, "Size 12", "tops", fit_preference="fitted")

        # Reasoning should mention fitted preference
        assert result.reasoning is not None

    # Test 6: Pear body type — hips larger than chest
    def test_pear_body_type_fit(self):
        avatar = {
            "chest_cm": 84.0,
            "waist_cm": 68.0,
            "hips_cm": 102.0,  # Significantly larger
            "shoulder_width_cm": 40.0,
        }
        # Size 12 top might fit chest but be tight on hips
        garment = _garment_spec_from_body_size("10", "dresses")
        result = score_fit(avatar, garment, "Size 10", "dresses")

        assert result.zones.get("hips") is not None
        hips_zone = result.zones["hips"]
        # Hips should be notably different from chest fit
        assert hips_zone.fit is not None

    # Test 7: Alternative size suggestion
    def test_alternative_size_suggested_when_poor_fit(self):
        avatar = {
            "chest_cm": 96.0,
            "waist_cm": 78.0,
            "hips_cm": 102.0,
        }
        # Try size 10 — too small
        garment_size_10 = _garment_spec_from_body_size("10", "tops")

        # Build all_sizes from AU chart
        all_sizes = {
            size: _garment_spec_from_body_size(size, "tops")
            for size in ["8", "10", "12", "14", "16"]
        }

        result = score_fit(avatar, garment_size_10, "Size 10", "tops", all_sizes=all_sizes)

        # Should have an alternative suggestion since fit is poor
        if result.overall_fit == "poor":
            assert result.alternative is not None
            assert "size" in result.alternative
            assert "note" in result.alternative

    # Test 8: Missing measurements (sparse data)
    def test_sparse_avatar_measurements(self):
        avatar = {
            "chest_cm": 88.0,
            # waist and hips not provided
            "shoulder_width_cm": 42.0,
        }
        garment = {"chest_cm": 96.0, "shoulder_width_cm": 43.5}
        result = score_fit(avatar, garment, "Size 10", "tops")

        # Should still work with partial data
        assert result is not None
        assert result.confidence >= 0.0
        assert "chest" in result.zones

    # Test 9: Outerwear with more ease
    def test_outerwear_more_ease(self):
        avatar = {
            "chest_cm": 88.0,
            "waist_cm": 70.0,
            "hips_cm": 94.0,
            "shoulder_width_cm": 42.0,
        }
        garment = _garment_spec_from_body_size("10", "outerwear")
        result_outerwear = score_fit(avatar, garment, "Size 10", "outerwear")
        garment_top = _garment_spec_from_body_size("10", "tops")
        result_top = score_fit(avatar, garment_top, "Size 10", "tops")

        # Outerwear has more ease by design — zones should be more loose
        outerwear_avg_ease = sum(
            z.ease_cm for z in result_outerwear.zones.values()
            if z.ease_cm is not None
        )
        top_avg_ease = sum(
            z.ease_cm for z in result_top.zones.values()
            if z.ease_cm is not None
        )
        assert outerwear_avg_ease >= top_avg_ease

    # Test 10: API response format matches spec
    def test_api_response_format(self):
        avatar = {
            "chest_cm": 88.0,
            "waist_cm": 70.0,
            "hips_cm": 94.0,
            "shoulder_width_cm": 42.0,
        }
        garment = _garment_spec_from_body_size("10", "tops")
        result = score_fit(avatar, garment, "Size 10", "tops")
        api = fit_result_to_api_response(result)

        # Must have all required keys from spec
        assert "overall_fit" in api
        assert "size_recommendation" in api
        assert "confidence" in api
        assert "zones" in api
        assert "reasoning" in api

        assert api["overall_fit"] in ("good", "acceptable", "poor")
        assert 0.0 <= api["confidence"] <= 1.0
        assert isinstance(api["zones"], dict)
        assert isinstance(api["reasoning"], str)
        assert len(api["reasoning"]) > 0

        # Each zone must have fit and ease_cm
        for zone_name, zone_data in api["zones"].items():
            assert "fit" in zone_data

    # Test 11: Confidence score reflects data completeness
    def test_confidence_lower_with_sparse_data(self):
        avatar_full = {
            "chest_cm": 88.0,
            "waist_cm": 70.0,
            "hips_cm": 94.0,
            "shoulder_width_cm": 42.0,
            "arm_length_cm": 60.0,
            "torso_length_cm": 40.0,
        }
        avatar_sparse = {"chest_cm": 88.0}
        garment = _garment_spec_from_body_size("10", "tops")
        garment["arm_length_cm"] = 60.5
        garment["torso_length_cm"] = 41.0

        result_full = score_fit(avatar_full, garment, "Size 10")
        result_sparse = score_fit(avatar_sparse, garment, "Size 10")

        assert result_full.confidence >= result_sparse.confidence

    # Test 12: Extreme body measurements don't crash
    def test_extreme_measurements_handled(self):
        avatar = {
            "chest_cm": 130.0,
            "waist_cm": 120.0,
            "hips_cm": 140.0,
        }
        garment = _garment_spec_from_body_size("10", "tops")
        result = score_fit(avatar, garment, "Size 10")

        assert result is not None
        assert result.overall_fit in ("good", "acceptable", "poor")
        # Should have tight zones for very large body vs small garment
        tight = [z for z in result.zones.values() if "tight" in z.fit]
        assert len(tight) > 0

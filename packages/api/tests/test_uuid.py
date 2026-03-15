"""
Tests for the Universal Garment Identifier (UGI) service.
This is the most critical component — tested thoroughly.
"""
import time

import pytest

from app.models.garment import GarmentCategory
from app.services.uuid_service import (
    _compute_checksum,
    _from_base36,
    _to_base36,
    generate_ugi,
    parse_ugi,
    validate_ugi,
)


class TestBase36Conversion:
    def test_to_base36_zero(self):
        assert _to_base36(0) == "00000000"

    def test_to_base36_known_values(self):
        assert _to_base36(35) == "0000000Z"  # 35 in base 36 = 'Z', padded to 8 chars
        assert _to_base36(36) == "00000010"  # 36 = 1*36 + 0

    def test_to_base36_roundtrip(self):
        for n in [0, 1, 100, 9999, 123456789, 999999999]:
            assert _from_base36(_to_base36(n)) == n

    def test_to_base36_width(self):
        result = _to_base36(100, width=10)
        assert len(result) == 10

    def test_from_base36_uppercase(self):
        assert _from_base36("A") == 10
        assert _from_base36("Z") == 35
        assert _from_base36("10") == 36


class TestUGIGeneration:
    def test_generate_ugi_format(self):
        ugi = generate_ugi("CHAR", GarmentCategory.TOPS)
        parts = ugi.split("-")
        assert len(parts) == 5
        assert parts[0] == "LB"
        assert parts[1] == "CHAR"
        assert parts[2] == "TO"
        assert len(parts[3]) == 8
        assert len(parts[4]) == 3

    def test_generate_ugi_all_categories(self):
        for category in GarmentCategory:
            ugi = generate_ugi("CHAR", category)
            assert ugi.startswith("LB-CHAR-")
            assert validate_ugi(ugi), f"Generated invalid UGI for {category}: {ugi}"

    def test_generate_ugi_string_category(self):
        ugi = generate_ugi("CHAR", "tops")
        assert "TO" in ugi
        assert validate_ugi(ugi)

    def test_generate_ugi_brand_code_uppercase(self):
        ugi = generate_ugi("char", GarmentCategory.TOPS)
        assert "CHAR" in ugi

    def test_generate_ugi_invalid_brand_code(self):
        with pytest.raises(ValueError, match="Invalid brand code"):
            generate_ugi("TOOLONG", GarmentCategory.TOPS)

    def test_generate_ugi_invalid_category(self):
        with pytest.raises(ValueError, match="Unknown garment category"):
            generate_ugi("CHAR", "invalid_category")

    def test_generate_ugi_unique(self):
        """Two rapidly generated UGIs should be different (different ms timestamps)."""
        ugis = set()
        for _ in range(10):
            ugis.add(generate_ugi("CHAR", GarmentCategory.TOPS))
            time.sleep(0.002)  # 2ms gap to ensure different timestamps
        assert len(ugis) > 1, "Expected UGIs to be unique"

    def test_example_ugi_format(self):
        """Test the spec example format: LB-CHAR-TO-K9F3M2A1-X7Q"""
        ugi = generate_ugi("CHAR", "tops")
        # Format: LB-CHAR-TO-XXXXXXXX-XXX
        import re
        assert re.match(r"^LB-CHAR-TO-[A-Z0-9]{8}-[A-Z0-9]{3}$", ugi)


class TestUGIValidation:
    def test_valid_ugi(self):
        ugi = generate_ugi("CHAR", GarmentCategory.TOPS)
        assert validate_ugi(ugi) is True

    def test_invalid_format(self):
        assert validate_ugi("") is False
        assert validate_ugi("not-a-ugi") is False
        assert validate_ugi("LB-CHAR-TO-TOOSHORT-XXX") is False

    def test_invalid_category_code(self):
        # Generate a valid UGI then mangle the category code
        ugi = generate_ugi("CHAR", GarmentCategory.TOPS)
        mangled = ugi.replace("-TO-", "-ZZ-")
        assert validate_ugi(mangled) is False

    def test_invalid_checksum(self):
        ugi = generate_ugi("CHAR", GarmentCategory.TOPS)
        # Mangle the checksum
        parts = ugi.split("-")
        parts[-1] = "XXX" if parts[-1] != "XXX" else "YYY"
        mangled = "-".join(parts)
        assert validate_ugi(mangled) is False

    def test_case_insensitive(self):
        ugi = generate_ugi("CHAR", GarmentCategory.TOPS)
        assert validate_ugi(ugi.lower()) is True


class TestUGIParsing:
    def test_parse_valid_ugi(self):
        ugi = generate_ugi("CHAR", GarmentCategory.DRESSES)
        parsed = parse_ugi(ugi)
        assert parsed.is_valid is True
        assert parsed.brand_code == "CHAR"
        assert parsed.category_code == "DR"
        assert parsed.category == "dresses"
        assert parsed.timestamp_ms > 0

    def test_parse_invalid_ugi(self):
        parsed = parse_ugi("not-valid-at-all")
        assert parsed.is_valid is False
        assert parsed.brand_code == ""

    def test_parse_timestamp_recovery(self):
        """Parsed timestamp should be within a few seconds of now."""
        from app.config import settings
        ugi = generate_ugi("TEST", GarmentCategory.BOTTOMS)
        parsed = parse_ugi(ugi)
        
        now_ms = int(time.time() * 1000)
        epoch_ms = settings.LOOCBOOC_EPOCH_MS
        ugi_absolute_ms = epoch_ms + parsed.timestamp_ms
        
        # Should be within 5 seconds
        assert abs(ugi_absolute_ms - now_ms) < 5000

    def test_parse_all_categories(self):
        from app.models.garment import CATEGORY_CODES
        for category, code in CATEGORY_CODES.items():
            ugi = generate_ugi("ACME", category)
            parsed = parse_ugi(ugi)
            assert parsed.is_valid is True
            assert parsed.category_code == code
            assert parsed.category == category.value

    def test_parse_roundtrip(self):
        """Parse → regenerate should produce same structure."""
        ugi = generate_ugi("LOOC", GarmentCategory.OUTERWEAR)
        parsed = parse_ugi(ugi)
        
        assert parsed.ugi == ugi.upper()
        assert parsed.brand_code == "LOOC"
        assert parsed.category_code == "OW"
        assert parsed.is_valid is True

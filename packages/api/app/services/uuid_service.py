"""
Universal Garment Identifier (UGI) Service.

Format: LB-[BRAND_CODE]-[CAT_CODE]-[TS36]-[CHK]
Example: LB-CHAR-TO-K9F3M2A1-X7Q

Components:
- LB:         Loocbooc prefix (fixed, 2 chars)
- BRAND_CODE: 4-char alphanumeric brand identifier (e.g. CHAR for Charcoal)
- CAT_CODE:   2-char category code (TO, BT, DR, OW, etc.)
- TS36:       8-char base-36 timestamp (ms since Loocbooc epoch = 2024-01-01T00:00:00Z)
              Gives ~200 year range before overflow
- CHK:        3-char checksum using a Luhn-style algorithm for error detection

This system provides:
- Human-readable brand and category at a glance
- Temporal ordering within a brand/category
- Error detection via checksum
- ~200 year range without overflow
- Guaranteed uniqueness via timestamp + collision detection
"""
import logging
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.garment import CATEGORY_CODE_REVERSE, CATEGORY_CODES, GarmentCategory

logger = logging.getLogger(__name__)

# Base-36 alphabet: 0-9 then A-Z (uppercase)
BASE36_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

# UGI regex for validation
UGI_PATTERN = re.compile(
    r"^LB-([A-Z0-9]{4})-([A-Z]{2})-([A-Z0-9]{8})-([A-Z0-9]{3})$"
)


@dataclass
class ParsedUGI:
    ugi: str
    brand_code: str
    category_code: str
    category: str | None
    timestamp_ms: int
    created_at: datetime
    checksum: str
    is_valid: bool


def _to_base36(n: int, width: int = 8) -> str:
    """Convert integer to base-36 string, zero-padded to width."""
    if n < 0:
        raise ValueError("Cannot convert negative number to base-36")
    if n == 0:
        return "0" * width
    chars = []
    while n:
        chars.append(BASE36_CHARS[n % 36])
        n //= 36
    result = "".join(reversed(chars))
    return result.zfill(width)


def _from_base36(s: str) -> int:
    """Convert base-36 string to integer."""
    return int(s, 36)


def _compute_checksum(brand_code: str, cat_code: str, ts36: str) -> str:
    """
    Luhn-style checksum over the alphanumeric parts of the UGI.
    Maps each character to its index in BASE36_CHARS, applies alternating
    weights, then encodes the result as 3 base-36 chars.

    Returns a 3-character uppercase string.
    """
    payload = brand_code + cat_code + ts36
    total = 0
    for i, char in enumerate(payload):
        val = BASE36_CHARS.index(char.upper())
        if i % 2 == 0:
            val *= 2
            if val >= 36:
                val = val // 36 + val % 36
        total += val
    # Encode checksum as 3 base-36 chars (max value = 36^3 - 1 = 46655)
    return _to_base36(total % 46656, width=3)


def generate_ugi(brand_code: str, category: GarmentCategory | str) -> str:
    """
    Generate a UGI for a garment.

    Args:
        brand_code: 4-char brand code (e.g. "CHAR")
        category: GarmentCategory enum or string (e.g. "tops")

    Returns:
        UGI string e.g. "LB-CHAR-TO-K9F3M2A1-X7Q"
    """
    brand_code = brand_code.upper()
    if len(brand_code) != 4 or not re.match(r"^[A-Z0-9]{4}$", brand_code):
        raise ValueError(f"Invalid brand code: {brand_code!r} (must be 4 alphanumeric chars)")

    # Resolve category code
    if isinstance(category, str):
        try:
            cat_enum = GarmentCategory(category)
        except ValueError:
            raise ValueError(f"Unknown garment category: {category!r}")
    else:
        cat_enum = category

    cat_code = CATEGORY_CODES[cat_enum]

    # Milliseconds since Loocbooc epoch
    now_ms = int(time.time() * 1000) - settings.LOOCBOOC_EPOCH_MS
    if now_ms < 0:
        now_ms = 0

    ts36 = _to_base36(now_ms, width=8)
    checksum = _compute_checksum(brand_code, cat_code, ts36)

    return f"LB-{brand_code}-{cat_code}-{ts36}-{checksum}"


def validate_ugi(ugi: str) -> bool:
    """
    Validate a UGI string.

    Checks:
    1. Format matches regex
    2. Category code is known
    3. Checksum matches

    Returns True if valid, False otherwise.
    """
    if not ugi:
        return False

    match = UGI_PATTERN.match(ugi.upper())
    if not match:
        return False

    brand_code, cat_code, ts36, checksum = match.groups()

    # Check category code is known
    if cat_code not in CATEGORY_CODE_REVERSE:
        return False

    # Verify checksum
    expected = _compute_checksum(brand_code, cat_code, ts36)
    return checksum == expected


def parse_ugi(ugi: str) -> ParsedUGI:
    """
    Parse a UGI string into its components.

    Returns a ParsedUGI dataclass. Check is_valid before using.
    """
    ugi = ugi.upper().strip()
    match = UGI_PATTERN.match(ugi)

    if not match:
        return ParsedUGI(
            ugi=ugi,
            brand_code="",
            category_code="",
            category=None,
            timestamp_ms=0,
            created_at=datetime.fromtimestamp(0, tz=timezone.utc),
            checksum="",
            is_valid=False,
        )

    brand_code, cat_code, ts36, checksum = match.groups()

    # Decode timestamp
    ts_ms = _from_base36(ts36)
    epoch_ms = settings.LOOCBOOC_EPOCH_MS
    created_at = datetime.fromtimestamp((epoch_ms + ts_ms) / 1000.0, tz=timezone.utc)

    # Resolve category
    category = CATEGORY_CODE_REVERSE.get(cat_code)

    # Verify checksum
    expected_chk = _compute_checksum(brand_code, cat_code, ts36)
    is_valid = checksum == expected_chk and category is not None

    return ParsedUGI(
        ugi=ugi,
        brand_code=brand_code,
        category_code=cat_code,
        category=category,
        timestamp_ms=ts_ms,
        created_at=created_at,
        checksum=checksum,
        is_valid=is_valid,
    )


async def generate_unique_ugi(
    db: AsyncSession,
    brand_code: str,
    category: GarmentCategory | str,
    max_attempts: int = 5,
) -> str:
    """
    Generate a UGI and verify it doesn't already exist in the database.
    Millisecond timestamps make collisions extremely unlikely but this is a safety net.

    Returns the unique UGI string.
    Raises RuntimeError if unable to generate unique UGI after max_attempts.
    """
    from app.models.garment import Garment

    for attempt in range(max_attempts):
        if attempt > 0:
            # Back off slightly on retry to advance the timestamp
            await __import__("asyncio").sleep(0.002)

        ugi = generate_ugi(brand_code, category)

        # Check for collision
        result = await db.execute(select(Garment).where(Garment.id == ugi))
        existing = result.scalar_one_or_none()

        if existing is None:
            logger.debug(f"Generated UGI {ugi} (attempt {attempt + 1})")
            return ugi

        logger.warning(f"UGI collision on attempt {attempt + 1}: {ugi}")

    raise RuntimeError(
        f"Failed to generate unique UGI after {max_attempts} attempts. "
        "This should be astronomically unlikely — check system clock."
    )

#!/usr/bin/env python3
"""
Loocbooc Seed Script
=====================
Creates test data for local development:
  - Brand: "CHAR" (Charcoal Clothing)
  - API Key: lb_live_testkey_charcoal
  - 3 sample garments

Usage (inside API container):
  python /app/scripts/seed.py

Or via docker-compose:
  docker-compose exec api python /app/scripts/seed.py
"""
import asyncio
import hashlib
import logging
import os
import sys

# Add the API package to path (when run inside the container)
sys.path.insert(0, "/app")

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# The raw API key we seed — must match lb_live_ prefix
SEED_API_KEY = "lb_live_testkey_charcoal"
BRAND_CODE = "CHAR"
BRAND_NAME = "Charcoal Clothing"
BRAND_SLUG = "charcoal-clothing"


def hash_api_key(raw_key: str) -> str:
    """Hash an API key for storage. Must match app/middleware/auth.py."""
    return hashlib.sha256(raw_key.encode()).hexdigest()


async def main():
    # Import here so path is set
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy import select, text

    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://loocbooc:loocbooc@postgres:5432/loocbooc",
    )

    engine = create_async_engine(db_url, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # --- Check if already seeded ---
        from sqlalchemy import select
        try:
            from app.models.brand import Brand, APIKey
        except ImportError:
            logger.error("Cannot import app models. Are you running inside the API container?")
            sys.exit(1)

        result = await session.execute(
            select(Brand).where(Brand.brand_code == BRAND_CODE)
        )
        existing_brand = result.scalar_one_or_none()

        if existing_brand:
            logger.info(f"Brand '{BRAND_CODE}' already exists — skipping seed")
            _print_credentials(existing_brand.id)
            await engine.dispose()
            return

        # --- Create brand ---
        brand = Brand(
            brand_code=BRAND_CODE,
            name=BRAND_NAME,
            slug=BRAND_SLUG,
            country="AU",
            is_active=True,
            is_verified=True,
            settings={},
        )
        session.add(brand)
        await session.flush()

        logger.info(f"Created brand: {BRAND_NAME} (id={brand.id})")

        # --- Create API key ---
        key_hash = hash_api_key(SEED_API_KEY)
        api_key = APIKey(
            brand_id=brand.id,
            key_hash=key_hash,
            key_prefix=SEED_API_KEY[:12],  # First 12 chars for display
            name="Dev Test Key",
            is_active=True,
        )
        session.add(api_key)
        await session.flush()

        logger.info(f"Created API key: {SEED_API_KEY[:20]}...")

        # --- Create sample garments ---
        from app.models.garment import Garment, GarmentCategory, GarmentStatus
        from app.services.uuid_service import generate_unique_ugi

        sample_garments = [
            {
                "name": "Tailored Blazer",
                "category": GarmentCategory.OUTERWEAR,
                "description": "Sharp tailored blazer for the modern woman",
                "sku": "CHAR-BLZ-001",
            },
            {
                "name": "Ribbed Knit Dress",
                "category": GarmentCategory.DRESSES,
                "description": "Elegant ribbed knit midi dress",
                "sku": "CHAR-DRS-001",
            },
            {
                "name": "Wide Leg Trousers",
                "category": GarmentCategory.BOTTOMS,
                "description": "High-rise wide leg trousers in premium fabric",
                "sku": "CHAR-TRS-001",
            },
        ]

        created_ugis = []
        for g_data in sample_garments:
            ugi = await generate_unique_ugi(session, BRAND_CODE, g_data["category"])
            garment = Garment(
                id=ugi,
                brand_id=brand.id,
                name=g_data["name"],
                category=g_data["category"],
                description=g_data["description"],
                sku=g_data["sku"],
                status=GarmentStatus.ACTIVE,
            )
            session.add(garment)
            created_ugis.append(ugi)
            logger.info(f"Created garment: {g_data['name']} → {ugi}")

        await session.commit()

    _print_credentials(brand.id, created_ugis)
    await engine.dispose()
    logger.info("Seed complete ✓")


def _print_credentials(brand_id: str = None, ugis: list = None):
    print("\n" + "=" * 60)
    print("  LOOCBOOC TEST CREDENTIALS")
    print("=" * 60)
    print(f"  Brand:      {BRAND_NAME} ({BRAND_CODE})")
    if brand_id:
        print(f"  Brand ID:   {brand_id}")
    print(f"  API Key:    {SEED_API_KEY}")
    print()
    print("  Usage:")
    print(f"    curl -H 'X-API-Key: {SEED_API_KEY}' \\")
    print("         http://localhost:8000/api/v1/garments")
    if ugis:
        print()
        print("  Sample UGIs:")
        for ugi in ugis:
            print(f"    {ugi}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())

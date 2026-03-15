"""
Manufacturer marketplace service layer.

Business logic for:
  - Slug generation and uniqueness enforcement
  - Rating recomputation (updates ManufacturerProfile.rating_avg after each write)
  - Response-time rolling average (updated when ENQUIRY → RESPONDED transition occurs)
  - Profile ↔ schema conversion helpers
"""
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.manufacturer import (
    BrandManufacturerConnection,
    ConnectionStatus,
    Manufacturer,
    ManufacturerProfile,
    ManufacturerRating,
)
from app.schemas.manufacturer import (
    BrandConnection,
    ManufacturerListItem,
    ManufacturerProfile as ManufacturerProfileSchema,
    ManufacturerRatingItem,
    ManufacturerSearchFilters,
)

if TYPE_CHECKING:
    from app.models.brand import Brand


# ─── Slug generation ──────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    """
    Convert text to a URL-safe slug.
    "Orient Textile — Hangzhou" → "orient-textile-hangzhou"
    """
    # Normalise unicode → ASCII
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    # Lowercase, strip non-alphanumeric (keep hyphens and spaces)
    text = re.sub(r"[^\w\s-]", "", text.lower())
    # Collapse whitespace and hyphens to single hyphen
    text = re.sub(r"[-\s]+", "-", text)
    return text.strip("-")


async def generate_unique_slug(
    db: AsyncSession,
    display_name: str,
    city: str | None,
) -> str:
    """
    Generate a slug from display_name + optional city.
    Appends a short random suffix if the base slug is already taken.

    Examples:
        "Orient Textile", "Hangzhou" → "orient-textile-hangzhou"
        "Orient Textile", None        → "orient-textile"
        collision                     → "orient-textile-hangzhou-a3f"
    """
    parts = [display_name]
    if city:
        parts.append(city)
    base_slug = _slugify(" ".join(parts))

    # Check if the base slug is available
    result = await db.execute(
        select(ManufacturerProfile).where(ManufacturerProfile.slug == base_slug)
    )
    if result.scalar_one_or_none() is None:
        return base_slug

    # Collision — append short random suffix and retry (max 5 attempts)
    for _ in range(5):
        suffix = uuid.uuid4().hex[:4]
        candidate = f"{base_slug}-{suffix}"
        result = await db.execute(
            select(ManufacturerProfile).where(ManufacturerProfile.slug == candidate)
        )
        if result.scalar_one_or_none() is None:
            return candidate

    # Extremely unlikely — fall back to full UUID suffix
    return f"{base_slug}-{uuid.uuid4().hex[:8]}"


# ─── Rating recomputation ─────────────────────────────────────────────────────

async def recompute_rating_avg(
    db: AsyncSession,
    profile_id: str,
) -> None:
    """
    Recompute ManufacturerProfile.rating_avg and rating_count from scratch.
    Called after every rating insert or update.
    """
    result = await db.execute(
        select(
            func.avg(ManufacturerRating.overall_score).label("avg"),
            func.count(ManufacturerRating.id).label("count"),
        ).where(ManufacturerRating.manufacturer_profile_id == profile_id)
    )
    row = result.one()

    profile_result = await db.execute(
        select(ManufacturerProfile).where(ManufacturerProfile.id == profile_id)
    )
    profile = profile_result.scalar_one_or_none()
    if profile is None:
        return

    profile.rating_avg = float(row.avg) if row.avg is not None else None
    profile.rating_count = int(row.count)
    await db.flush()


# ─── Response time rolling average ───────────────────────────────────────────

async def update_response_time(
    db: AsyncSession,
    profile: ManufacturerProfile,
    connection: BrandManufacturerConnection,
) -> None:
    """
    Update the rolling average response_time_hours on a profile after a manufacturer responds.
    Uses an exponential moving average with α=0.3 for recent-bias.
    """
    if connection.responded_at is None or connection.created_at is None:
        return

    delta_hours = (
        connection.responded_at - connection.created_at.replace(tzinfo=timezone.utc)
        if connection.created_at.tzinfo is None
        else connection.responded_at - connection.created_at
    ).total_seconds() / 3600

    alpha = 0.3
    if profile.response_time_hours is None:
        profile.response_time_hours = delta_hours
    else:
        # Exponential moving average
        profile.response_time_hours = alpha * delta_hours + (1 - alpha) * profile.response_time_hours

    await db.flush()


# ─── Schema conversion helpers ────────────────────────────────────────────────

def profile_to_list_item(
    profile: ManufacturerProfile,
) -> ManufacturerListItem:
    """Convert an ORM ManufacturerProfile to the lightweight list-item schema."""
    return ManufacturerListItem(
        id=profile.manufacturer_id,
        profile_id=profile.id,
        slug=profile.slug,
        display_name=profile.display_name,
        country=profile.country,
        city=profile.city,
        hero_image_url=profile.hero_image_url,
        specialisations=profile.specialisations or [],
        certifications=profile.certifications or [],
        price_tier=profile.price_tier,
        moq_min=profile.moq_min,
        bulk_lead_time_days=profile.bulk_lead_time_days,
        rating_avg=profile.rating_avg,
        rating_count=profile.rating_count,
        is_verified=profile.is_verified,
        is_featured=profile.is_featured,
        response_time_hours=profile.response_time_hours,
    )


def profile_to_full_schema(
    profile: ManufacturerProfile,
    connection_status: ConnectionStatus | None,
) -> ManufacturerProfileSchema:
    """Convert an ORM ManufacturerProfile + connection status to the full profile schema."""
    ratings = [
        ManufacturerRatingItem(
            id=r.id,
            brand_name=r.brand_name,
            overall_score=r.overall_score,
            quality_score=r.quality_score,
            communication_score=r.communication_score,
            timeliness_score=r.timeliness_score,
            review=r.review,
            orders_completed=r.orders_completed,
            is_verified_purchase=r.is_verified_purchase,
            created_at=r.created_at,
        )
        for r in (profile.ratings or [])
    ]

    return ManufacturerProfileSchema(
        id=profile.manufacturer_id,
        profile_id=profile.id,
        slug=profile.slug,
        display_name=profile.display_name,
        description=profile.description,
        hero_image_url=profile.hero_image_url,
        gallery_image_urls=profile.gallery_image_urls or [],
        video_url=profile.video_url,
        country=profile.country,
        city=profile.city,
        year_established=profile.year_established,
        employee_count=profile.employee_count,
        monthly_capacity_min=profile.monthly_capacity_min,
        monthly_capacity_max=profile.monthly_capacity_max,
        moq_min=profile.moq_min,
        moq_max=profile.moq_max,
        sample_lead_time_days=profile.sample_lead_time_days,
        bulk_lead_time_days=profile.bulk_lead_time_days,
        specialisations=profile.specialisations or [],
        materials=profile.materials or [],
        certifications=profile.certifications or [],
        export_markets=profile.export_markets or [],
        price_tier=profile.price_tier,
        tech_pack_formats=profile.tech_pack_formats or [],
        languages=profile.languages or [],
        is_verified=profile.is_verified,
        is_featured=profile.is_featured,
        response_time_hours=profile.response_time_hours,
        rating_avg=profile.rating_avg,
        rating_count=profile.rating_count,
        connection_status=connection_status.value if connection_status else None,
        ratings=ratings,
    )


def connection_to_schema(
    connection: BrandManufacturerConnection,
) -> BrandConnection:
    """Convert an ORM BrandManufacturerConnection to the BrandConnection schema."""
    profile = connection.manufacturer_profile
    return BrandConnection(
        id=connection.id,
        manufacturer_profile_id=connection.manufacturer_profile_id,
        manufacturer_slug=profile.slug,
        manufacturer_name=profile.display_name,
        manufacturer_country=profile.country,
        manufacturer_hero_image_url=profile.hero_image_url,
        status=connection.status.value,
        enquiry_message=connection.enquiry_message,
        responded_at=connection.responded_at,
        connected_at=connection.connected_at,
        created_at=connection.created_at,
    )


# ─── Search query builder ─────────────────────────────────────────────────────

async def search_profiles(
    db: AsyncSession,
    filters: ManufacturerSearchFilters,
) -> tuple[list[ManufacturerProfile], int]:
    """
    Apply all search filters and return (results, total_count).
    Only active (non-deleted) profiles with active parent manufacturers are returned.
    Featured profiles are sorted first, then by rating_avg descending.
    """
    from sqlalchemy import cast
    from sqlalchemy.dialects.postgresql import ARRAY
    from sqlalchemy import String as SAString

    base_q = (
        select(ManufacturerProfile)
        .join(Manufacturer, Manufacturer.id == ManufacturerProfile.manufacturer_id)
        .where(Manufacturer.is_active == True)  # noqa: E712
    )

    # Free-text search across name, description, city
    if filters.search:
        term = f"%{filters.search.strip()}%"
        base_q = base_q.where(
            ManufacturerProfile.display_name.ilike(term)
            | ManufacturerProfile.description.ilike(term)
            | ManufacturerProfile.city.ilike(term)
        )

    # Country filter (any of the provided countries)
    countries = filters.country_list()
    if countries:
        base_q = base_q.where(ManufacturerProfile.country.in_(countries))

    # Specialisations overlap — profile must match at least one
    specialisations = filters.specialisations_list()
    if specialisations:
        # PostgreSQL array overlap: profile.specialisations && ARRAY[...]
        base_q = base_q.where(
            ManufacturerProfile.specialisations.op("&&")(
                cast(specialisations, ARRAY(SAString()))
            )
        )

    # Price tier filter
    price_tiers = filters.price_tiers_list()
    if price_tiers:
        base_q = base_q.where(ManufacturerProfile.price_tier.in_(price_tiers))

    # Certifications overlap
    certifications = filters.certifications_list()
    if certifications:
        base_q = base_q.where(
            ManufacturerProfile.certifications.op("&&")(
                cast(certifications, ARRAY(SAString()))
            )
        )

    # MOQ ceiling
    if filters.max_moq is not None:
        base_q = base_q.where(ManufacturerProfile.moq_min <= filters.max_moq)

    # Verified only
    if filters.verified_only:
        base_q = base_q.where(ManufacturerProfile.is_verified == True)  # noqa: E712

    # Count total (before pagination)
    count_q = select(func.count()).select_from(base_q.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar_one()

    # Sort: featured first, then by rating_avg desc, then alphabetically
    ordered_q = base_q.order_by(
        ManufacturerProfile.is_featured.desc(),
        ManufacturerProfile.rating_avg.desc().nulls_last(),
        ManufacturerProfile.display_name.asc(),
    )

    # Paginate
    offset = (filters.page - 1) * filters.limit
    paginated_q = (
        ordered_q
        .offset(offset)
        .limit(filters.limit)
        .options(selectinload(ManufacturerProfile.manufacturer))
    )

    result = await db.execute(paginated_q)
    profiles = list(result.scalars().all())

    return profiles, total

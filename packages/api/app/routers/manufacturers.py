"""
Manufacturer marketplace endpoints.

Route ordering matters — specific routes must appear before /{slug} to prevent
FastAPI from treating "connections" and "profile" as slug values.

Public endpoints (no auth required):
  GET  /manufacturers                  — search/list
  GET  /manufacturers/{slug}           — full profile (connection status shown if brand authed)

Brand-authenticated endpoints (API key or JWT with brand context):
  POST /manufacturers/connections              — send an enquiry
  GET  /manufacturers/connections/mine         — brand's connection history
  POST /manufacturers/{profile_id}/ratings     — rate a manufacturer (after working together)

Manufacturer-authenticated endpoints (JWT — manufacturer user):
  POST /manufacturers/profile                  — create a profile
  PATCH /manufacturers/{slug}/profile          — update own profile
  PATCH /manufacturers/connections/{id}/status — respond to/update a connection
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import AuthContext, get_auth_context, require_auth, require_api_key
from app.models.brand import Brand
from app.models.manufacturer import (
    BrandManufacturerConnection,
    ConnectionStatus,
    Manufacturer,
    ManufacturerProfile,
    ManufacturerRating,
)
from app.schemas.manufacturer import (
    BrandConnection,
    CreateProfileInput,
    CreateProfileResponse,
    ManufacturerListResponse,
    ManufacturerProfile as ManufacturerProfileSchema,
    ManufacturerSearchFilters,
    RateManufacturerInput,
    SendEnquiryInput,
    SendEnquiryResponse,
    UpdateConnectionStatusInput,
    UpdateProfileInput,
)
from app.services.manufacturer_service import (
    connection_to_schema,
    generate_unique_slug,
    profile_to_full_schema,
    profile_to_list_item,
    recompute_rating_avg,
    search_profiles,
    update_response_time,
)

router = APIRouter(prefix="/manufacturers", tags=["manufacturers"])
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC: List / search
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=ManufacturerListResponse)
async def list_manufacturers(
    search: str | None = Query(None, description="Free text search across name, city, description"),
    country: str | None = Query(None, description="Comma-separated ISO country codes: CN,VN,IN"),
    specialisations: str | None = Query(None, description="Comma-separated specialisations"),
    price_tiers: str | None = Query(None, description="Comma-separated tiers: mass,mid,premium,luxury"),
    certifications: str | None = Query(None, description="Comma-separated certifications"),
    max_moq: int | None = Query(None, ge=1, description="Maximum MOQ to filter by"),
    verified_only: bool = Query(False, description="Only return verified manufacturers"),
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> ManufacturerListResponse:
    """
    Search and filter manufacturers on the platform.
    Featured profiles sort first, then by average rating.
    """
    filters = ManufacturerSearchFilters(
        search=search,
        country=country,
        specialisations=specialisations,
        price_tiers=price_tiers,
        certifications=certifications,
        max_moq=max_moq,
        verified_only=verified_only,
        page=page,
        limit=limit,
    )

    profiles, total = await search_profiles(db, filters)
    items = [profile_to_list_item(p) for p in profiles]

    return ManufacturerListResponse(
        manufacturers=items,
        total=total,
        page=page,
        limit=limit,
    )


# ─────────────────────────────────────────────────────────────────────────────
# BRAND AUTH: Connections
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/connections", response_model=SendEnquiryResponse, status_code=status.HTTP_201_CREATED)
async def send_enquiry(
    data: SendEnquiryInput,
    auth: AuthContext = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
) -> SendEnquiryResponse:
    """
    Send a connection enquiry from the authenticated brand to a manufacturer.

    A brand can only send one enquiry per manufacturer profile.
    If a connection already exists (regardless of status), a 409 is returned.
    """
    if not auth.brand_id:
        raise HTTPException(status_code=400, detail="API key is not associated with a brand")

    # Verify the manufacturer profile exists
    profile_result = await db.execute(
        select(ManufacturerProfile).where(ManufacturerProfile.id == data.manufacturer_profile_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Manufacturer profile not found")

    # Check for existing connection
    existing_result = await db.execute(
        select(BrandManufacturerConnection).where(
            BrandManufacturerConnection.brand_id == auth.brand_id,
            BrandManufacturerConnection.manufacturer_profile_id == data.manufacturer_profile_id,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A connection already exists with status: {existing.status.value}",
        )

    connection = BrandManufacturerConnection(
        brand_id=auth.brand_id,
        manufacturer_profile_id=data.manufacturer_profile_id,
        status=ConnectionStatus.ENQUIRY,
        enquiry_message=data.message,
    )
    db.add(connection)
    await db.flush()
    await db.refresh(connection)

    logger.info(
        "manufacturer_enquiry_sent",
        brand_id=auth.brand_id,
        profile_id=data.manufacturer_profile_id,
        connection_id=connection.id,
    )

    return SendEnquiryResponse(connection_id=connection.id)


@router.get("/connections/mine", response_model=list[BrandConnection])
async def get_my_connections(
    auth: AuthContext = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
) -> list[BrandConnection]:
    """
    List all manufacturer connections for the authenticated brand.
    Returns connections sorted by status priority: RESPONDED → ENQUIRY → CONNECTED → DECLINED → INACTIVE.
    """
    if not auth.brand_id:
        raise HTTPException(status_code=400, detail="API key is not associated with a brand")

    result = await db.execute(
        select(BrandManufacturerConnection)
        .where(BrandManufacturerConnection.brand_id == auth.brand_id)
        .options(selectinload(BrandManufacturerConnection.manufacturer_profile))
        .order_by(BrandManufacturerConnection.created_at.desc())
    )
    connections = list(result.scalars().all())

    return [connection_to_schema(c) for c in connections]


@router.patch("/connections/{connection_id}/status", status_code=status.HTTP_200_OK)
async def update_connection_status(
    connection_id: str,
    data: UpdateConnectionStatusInput,
    auth: AuthContext = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Update a connection's status. Called by the manufacturer to respond to an enquiry.

    Valid transitions:
      ENQUIRY    → RESPONDED, DECLINED
      RESPONDED  → CONNECTED, DECLINED, INACTIVE
      CONNECTED  → INACTIVE
    """
    result = await db.execute(
        select(BrandManufacturerConnection)
        .where(BrandManufacturerConnection.id == connection_id)
        .options(selectinload(BrandManufacturerConnection.manufacturer_profile))
    )
    connection = result.scalar_one_or_none()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    now = datetime.now(timezone.utc)
    new_status = ConnectionStatus(data.status)

    # Track lifecycle timestamps
    if new_status == ConnectionStatus.RESPONDED and connection.responded_at is None:
        connection.responded_at = now
        # Update rolling response-time average on the profile
        await update_response_time(db, connection.manufacturer_profile, connection)
    elif new_status == ConnectionStatus.CONNECTED and connection.connected_at is None:
        connection.connected_at = now

    connection.status = new_status
    await db.flush()

    logger.info(
        "connection_status_updated",
        connection_id=connection_id,
        new_status=new_status.value,
    )

    return {"connection_id": connection_id, "status": new_status.value}


# ─────────────────────────────────────────────────────────────────────────────
# BRAND AUTH: Ratings
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{profile_id}/ratings", status_code=status.HTTP_201_CREATED)
async def rate_manufacturer(
    profile_id: str,
    data: RateManufacturerInput,
    auth: AuthContext = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Submit or update a brand's rating for a manufacturer.
    Requires at least one CONNECTED history with the manufacturer.
    Automatically recomputes the profile's average rating.
    """
    if not auth.brand_id:
        raise HTTPException(status_code=400, detail="API key is not associated with a brand")

    # Verify profile exists
    profile_result = await db.execute(
        select(ManufacturerProfile).where(ManufacturerProfile.id == profile_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Manufacturer profile not found")

    # Require an existing connection (at any status — brand may have worked with them)
    connection_result = await db.execute(
        select(BrandManufacturerConnection).where(
            BrandManufacturerConnection.brand_id == auth.brand_id,
            BrandManufacturerConnection.manufacturer_profile_id == profile_id,
        )
    )
    connection = connection_result.scalar_one_or_none()
    if not connection:
        raise HTTPException(
            status_code=403,
            detail="You must have an existing connection with this manufacturer to leave a review",
        )

    # Get brand name for denormalisation
    brand_result = await db.execute(
        select(Brand).where(Brand.id == auth.brand_id)
    )
    brand = brand_result.scalar_one_or_none()
    brand_name = brand.name if brand else "Unknown Brand"

    # Upsert: one rating per brand per profile
    existing_rating_result = await db.execute(
        select(ManufacturerRating).where(
            ManufacturerRating.manufacturer_profile_id == profile_id,
            ManufacturerRating.brand_id == auth.brand_id,
        )
    )
    existing_rating = existing_rating_result.scalar_one_or_none()

    if existing_rating:
        # Update existing rating
        existing_rating.overall_score = data.overall_score
        existing_rating.quality_score = data.quality_score
        existing_rating.communication_score = data.communication_score
        existing_rating.timeliness_score = data.timeliness_score
        existing_rating.review = data.review
        existing_rating.orders_completed = data.orders_completed
        await db.flush()
        rating_id = existing_rating.id
    else:
        # Insert new rating
        rating = ManufacturerRating(
            manufacturer_profile_id=profile_id,
            brand_id=auth.brand_id,
            brand_name=brand_name,
            overall_score=data.overall_score,
            quality_score=data.quality_score,
            communication_score=data.communication_score,
            timeliness_score=data.timeliness_score,
            review=data.review,
            orders_completed=data.orders_completed,
            is_verified_purchase=True,
        )
        db.add(rating)
        await db.flush()
        await db.refresh(rating)
        rating_id = rating.id

    # Always recompute the profile's average
    await recompute_rating_avg(db, profile_id)

    logger.info(
        "manufacturer_rated",
        profile_id=profile_id,
        brand_id=auth.brand_id,
        overall_score=data.overall_score,
    )

    return {"rating_id": rating_id, "profile_id": profile_id}


# ─────────────────────────────────────────────────────────────────────────────
# MANUFACTURER AUTH: Create / update profile
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/profile", response_model=CreateProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_manufacturer_profile(
    data: CreateProfileInput,
    auth: AuthContext = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> CreateProfileResponse:
    """
    Create a manufacturer account and profile in a single request.
    Called when a manufacturer user completes the profile creation wizard.

    One manufacturer account per user_id. Returns 409 if the user already has one.
    """
    if not auth.user_id:
        raise HTTPException(status_code=400, detail="JWT authentication required to create a manufacturer profile")

    # One manufacturer account per user
    existing_manufacturer_result = await db.execute(
        select(Manufacturer)
        .where(Manufacturer.owner_user_id == auth.user_id)
        .options(selectinload(Manufacturer.profile))
    )
    existing_manufacturer = existing_manufacturer_result.scalar_one_or_none()

    if existing_manufacturer and existing_manufacturer.profile:
        raise HTTPException(
            status_code=409,
            detail="A manufacturer profile already exists for this user",
        )

    # Generate slug
    slug = await generate_unique_slug(db, data.display_name, data.city)

    # Create the Manufacturer account if it doesn't exist
    if existing_manufacturer is None:
        manufacturer = Manufacturer(
            owner_user_id=auth.user_id,
            name=data.display_name,
        )
        db.add(manufacturer)
        await db.flush()
        await db.refresh(manufacturer)
        manufacturer_id = manufacturer.id
    else:
        manufacturer_id = existing_manufacturer.id

    # Create the profile
    profile = ManufacturerProfile(
        manufacturer_id=manufacturer_id,
        slug=slug,
        display_name=data.display_name,
        description=data.description,
        country=data.country,
        city=data.city,
        price_tier=data.price_tier,
        moq_min=data.moq_min,
        moq_max=data.moq_max,
        sample_lead_time_days=data.sample_lead_time_days,
        bulk_lead_time_days=data.bulk_lead_time_days,
        specialisations=data.specialisations,
        materials=data.materials,
        certifications=data.certifications,
        export_markets=data.export_markets,
        tech_pack_formats=data.tech_pack_formats,
        languages=data.languages,
        monthly_capacity_min=data.monthly_capacity_min,
        monthly_capacity_max=data.monthly_capacity_max,
        year_established=data.year_established,
        employee_count=data.employee_count,
    )
    db.add(profile)
    await db.flush()
    await db.refresh(profile)

    logger.info(
        "manufacturer_profile_created",
        manufacturer_id=manufacturer_id,
        profile_id=profile.id,
        slug=slug,
    )

    return CreateProfileResponse(
        manufacturer_id=manufacturer_id,
        profile_id=profile.id,
        slug=slug,
    )


@router.patch("/{slug}/profile", status_code=status.HTTP_200_OK)
async def update_manufacturer_profile(
    slug: str,
    data: UpdateProfileInput,
    auth: AuthContext = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Update the manufacturer's own profile.
    Only the manufacturer who owns the profile may update it.
    """
    # Load profile
    profile_result = await db.execute(
        select(ManufacturerProfile)
        .where(ManufacturerProfile.slug == slug)
        .options(selectinload(ManufacturerProfile.manufacturer))
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Manufacturer profile not found")

    # Ownership check: the authenticated user must own the parent manufacturer
    if profile.manufacturer.owner_user_id != auth.user_id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to update this profile",
        )

    # Apply updates (only fields explicitly provided)
    update_data = data.model_dump(exclude_none=True, exclude={"description_update"})
    for field, value in update_data.items():
        if hasattr(profile, field):
            setattr(profile, field, value)

    # Handle description alias
    if data.description_update is not None:
        profile.description = data.description_update

    await db.flush()
    await db.refresh(profile)

    logger.info("manufacturer_profile_updated", profile_id=profile.id, slug=slug)

    return {"slug": profile.slug, "updated": True}


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC: Full profile by slug
# Must be last in the file — parameterised route catches everything above if placed first.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{slug}", response_model=ManufacturerProfileSchema | None)
async def get_manufacturer_by_slug(
    slug: str,
    auth: AuthContext | None = Depends(get_auth_context),
    db: AsyncSession = Depends(get_db),
) -> ManufacturerProfileSchema | None:
    """
    Retrieve a manufacturer's full public profile.

    If the request is authenticated with a brand API key, the response includes
    the brand's current connection_status with this manufacturer (or null).
    """
    result = await db.execute(
        select(ManufacturerProfile)
        .where(ManufacturerProfile.slug == slug)
        .options(
            selectinload(ManufacturerProfile.manufacturer),
            selectinload(ManufacturerProfile.ratings),
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return None

    # Check caller's connection status if they're a brand
    connection_status: ConnectionStatus | None = None
    if auth and auth.brand_id:
        conn_result = await db.execute(
            select(BrandManufacturerConnection).where(
                BrandManufacturerConnection.brand_id == auth.brand_id,
                BrandManufacturerConnection.manufacturer_profile_id == profile.id,
            )
        )
        conn = conn_result.scalar_one_or_none()
        if conn:
            connection_status = conn.status

    return profile_to_full_schema(profile, connection_status)

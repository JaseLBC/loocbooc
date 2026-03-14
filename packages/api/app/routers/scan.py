"""
Scan endpoints — care label OCR and fabric composition extraction.
Uses Claude claude-haiku-4-5 vision for fast, cheap, accurate extraction.
"""
import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.fabric import FabricPhysicsResponse, OCRScanResponse
from app.services.fabric_service import get_or_create_physics
from app.services.ocr_service import extract_composition_from_image, fibres_to_composition_string

router = APIRouter(prefix="/scan", tags=["scan"])
logger = logging.getLogger(__name__)

ALLOWED_SCAN_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SCAN_SIZE_BYTES = 10 * 1024 * 1024  # 10MB


@router.post("/label", response_model=OCRScanResponse)
async def scan_care_label(
    image: UploadFile = File(..., description="Care label photo (JPEG, PNG, or WebP)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Extract fabric composition from a care label photo using Claude vision.

    Process:
    1. Accept care label image
    2. Send to Claude claude-haiku-4-5 for OCR/vision extraction
    3. Parse composition percentages
    4. Look up or create physics parameters for this composition
    5. Return composition + physics parameters

    Handles:
    - Multilingual labels (auto-translates fibre names to English)
    - Worn/blurry labels (extracts what's visible, flags confidence)
    - New compositions (estimates physics from known fibre data)
    """
    # Validate file type
    content_type = image.content_type or ""
    if content_type not in ALLOWED_SCAN_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Image type {content_type!r} not supported. Use JPEG, PNG, or WebP.",
        )

    # Read and validate size
    content = await image.read()
    if len(content) > MAX_SCAN_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image too large. Maximum 10MB for label scans.",
        )

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty image file")

    # Run OCR
    ocr_result = await extract_composition_from_image(content, content_type)

    fibres = ocr_result.get("fibres", {})
    confidence = ocr_result.get("confidence", 0.0)
    raw_text = ocr_result.get("raw_text", "")

    if not fibres:
        raise HTTPException(
            status_code=422,
            detail="Could not extract fabric composition from this image. "
            "Ensure the care label is clearly visible.",
        )

    # Convert to composition string
    composition_raw = fibres_to_composition_string(fibres)

    # Look up or create physics entry
    try:
        physics, created = await get_or_create_physics(db, composition_raw)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid composition: {e}")

    logger.info(
        f"Label scan: {composition_raw} (confidence={confidence:.2f}, "
        f"physics={'new' if created else 'existing'})"
    )

    return OCRScanResponse(
        composition_raw=composition_raw,
        fibre_breakdown={k: v for k, v in physics.fibre_breakdown.items()},
        confidence=confidence,
        physics=FabricPhysicsResponse.model_validate(physics),
        is_estimated=physics.is_estimated,
        raw_ocr_text=raw_text,
    )

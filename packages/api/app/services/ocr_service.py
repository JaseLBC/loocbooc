"""
Care label OCR service using Anthropic claude-haiku-4-5 vision.
Extracts fabric composition from care label photos.
Fast and cheap — haiku model handles multilingual labels well.
"""
import base64
import json
import logging
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

OCR_SYSTEM_PROMPT = """You are a fabric composition extraction specialist. Your job is to extract ONLY the fabric composition percentage breakdown from care label images.

Rules:
1. Extract ONLY fabric composition data — fibre types and their percentages
2. Return ONLY valid JSON — no other text, no markdown, no explanation
3. Handle labels in any language — translate fibre names to English
4. If a label is worn, blurry, or partially visible — extract what you can, set confidence accordingly
5. If no composition is found — return {"fibres": {}, "confidence": 0.0, "raw_text": ""}

Common fibre translations:
- Polyester (French: polyester, German: polyester, Spanish: poliéster, Chinese: 聚酯纤维)
- Cotton (French: coton, German: Baumwolle, Spanish: algodón, Chinese: 棉)
- Elastane/Spandex (French: élasthanne, German: Elasthan, Spanish: elastano, Chinese: 弹力纤维)
- Nylon (French: nylon, German: nylon, Spanish: nailon, Chinese: 锦纶)
- Viscose/Rayon (French: viscose, German: Viskose, Spanish: viscosa, Chinese: 粘纤)
- Wool (French: laine, German: Wolle, Spanish: lana, Chinese: 羊毛)
- Silk (French: soie, German: Seide, Spanish: seda, Chinese: 蚕丝)
- Linen (French: lin, German: Leinen, Spanish: lino, Chinese: 亚麻)

Output format (strict JSON only):
{
  "fibres": {
    "polyester": 85,
    "elastane": 15
  },
  "confidence": 0.92,
  "raw_text": "85% Polyester 15% Elastane"
}

Percentages should be integers (e.g. 85, not 0.85).
Confidence: 0.0 = no data found, 0.5 = partial/uncertain, 0.9+ = high confidence clear label."""


async def extract_composition_from_image(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
) -> dict:
    """
    Extract fabric composition from a care label image using Claude vision.

    Args:
        image_bytes: Raw image bytes
        mime_type: Image MIME type (image/jpeg, image/png, image/webp)

    Returns:
        dict with keys: fibres (dict), confidence (float), raw_text (str)
        Example: {"fibres": {"polyester": 85, "elastane": 15}, "confidence": 0.92, "raw_text": "..."}
    """
    if not settings.ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set — returning mock OCR result")
        return {
            "fibres": {"cotton": 100},
            "confidence": 0.1,
            "raw_text": "Mock result — set ANTHROPIC_API_KEY for real OCR",
        }

    try:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

        image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

        message = await client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=256,
            system=OCR_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": mime_type,
                                "data": image_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": "Extract the fabric composition from this care label. Return only JSON.",
                        },
                    ],
                }
            ],
        )

        raw_response = message.content[0].text.strip()
        logger.debug(f"Claude OCR response: {raw_response}")

        # Parse JSON response
        try:
            result = json.loads(raw_response)
        except json.JSONDecodeError:
            # Try to extract JSON from response if Claude added any wrapper text
            import re
            json_match = re.search(r"\{.*\}", raw_response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                logger.error(f"Could not parse Claude OCR response as JSON: {raw_response}")
                result = {"fibres": {}, "confidence": 0.0, "raw_text": raw_response}

        # Normalise — ensure required keys present
        result.setdefault("fibres", {})
        result.setdefault("confidence", 0.5)
        result.setdefault("raw_text", "")

        logger.info(
            f"OCR extracted: {result['fibres']} (confidence={result['confidence']:.2f})"
        )
        return result

    except Exception as e:
        logger.error(f"OCR extraction failed: {e}", exc_info=True)
        return {"fibres": {}, "confidence": 0.0, "raw_text": "", "error": str(e)}


def fibres_to_composition_string(fibres: dict[str, int | float]) -> str:
    """
    Convert a fibres dict to a composition string.
    Example: {"polyester": 85, "elastane": 15} → "85% polyester 15% elastane"
    """
    if not fibres:
        return ""
    parts = []
    for fibre, pct in sorted(fibres.items(), key=lambda x: x[1], reverse=True):
        pct_val = int(pct) if isinstance(pct, float) and pct == int(pct) else pct
        parts.append(f"{pct_val}% {fibre}")
    return " ".join(parts)

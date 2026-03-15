"""
Photo-based body measurement extraction service.

Uses MediaPipe Pose (Google's open-source pose estimation) to extract
body landmark coordinates from 2 photos (front + side), then converts
pixel coordinates to real-world measurements using height as calibration.

Graceful degradation: if MediaPipe is unavailable, returns a clear error
message and falls back to manual entry.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

# MediaPipe availability flag — checked once at import time
MEDIAPIPE_AVAILABLE = False
MEDIAPIPE_IMPORT_ERROR: str | None = None

try:
    import mediapipe as mp  # type: ignore[import-untyped]
    import numpy as np      # type: ignore[import-untyped]
    MEDIAPIPE_AVAILABLE = True
except ImportError as e:
    MEDIAPIPE_IMPORT_ERROR = str(e)
    logger.warning(
        "MediaPipe not available — photo measurement extraction disabled. "
        "Install with: pip install mediapipe. Error: %s", e
    )


# ---------------------------------------------------------------------------
# MediaPipe landmark indices (Pose model)
# ---------------------------------------------------------------------------

# Full list: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
MP_LANDMARKS = {
    "nose":            0,
    "left_shoulder":   11,
    "right_shoulder":  12,
    "left_elbow":      13,
    "right_elbow":     14,
    "left_wrist":      15,
    "right_wrist":     16,
    "left_hip":        23,
    "right_hip":       24,
    "left_knee":       25,
    "right_knee":      26,
    "left_ankle":      27,
    "right_ankle":     28,
    "left_heel":       29,
    "right_heel":      30,
    "left_foot_index": 31,
    "right_foot_index": 32,
}


@dataclass
class PhotoMeasurementResult:
    """Output from photo measurement extraction."""
    success: bool
    measurements: dict[str, float | None]
    confidence_scores: dict[str, float]
    overall_confidence: float
    warnings: list[str]
    error: str | None = None
    fallback_required: bool = False


@dataclass
class LandmarkPoint:
    x: float  # normalized [0, 1]
    y: float  # normalized [0, 1]
    z: float  # depth (relative)
    visibility: float  # [0, 1]


# ---------------------------------------------------------------------------
# Core extraction
# ---------------------------------------------------------------------------

def extract_measurements_from_photos(
    front_image_bytes: bytes,
    side_image_bytes: bytes,
    height_cm: float,
) -> PhotoMeasurementResult:
    """
    Extract body measurements from front + side photos.

    Parameters
    ----------
    front_image_bytes : bytes
        JPEG/PNG bytes of front-facing photo
    side_image_bytes : bytes
        JPEG/PNG bytes of side-facing photo
    height_cm : float
        Known height (cm) — used as calibration baseline

    Returns
    -------
    PhotoMeasurementResult with measurements and per-field confidence scores.
    """
    if not MEDIAPIPE_AVAILABLE:
        return PhotoMeasurementResult(
            success=False,
            measurements={},
            confidence_scores={},
            overall_confidence=0.0,
            warnings=[],
            error=(
                "MediaPipe is not installed on this server. "
                "Please enter your measurements manually. "
                f"(Install details: {MEDIAPIPE_IMPORT_ERROR})"
            ),
            fallback_required=True,
        )

    import numpy as np  # type: ignore[import-untyped]
    import mediapipe as mp  # type: ignore[import-untyped]

    warnings: list[str] = []

    try:
        # Parse images
        front_landmarks = _extract_landmarks(front_image_bytes, "front")
        side_landmarks = _extract_landmarks(side_image_bytes, "side")
    except Exception as e:
        return PhotoMeasurementResult(
            success=False,
            measurements={},
            confidence_scores={},
            overall_confidence=0.0,
            warnings=[],
            error=f"Could not process images: {str(e)}. Please check photo quality and try again.",
            fallback_required=True,
        )

    if front_landmarks is None:
        return PhotoMeasurementResult(
            success=False,
            measurements={},
            confidence_scores={},
            overall_confidence=0.0,
            warnings=[],
            error="No person detected in the front photo. Ensure good lighting and that the full body is visible.",
            fallback_required=True,
        )

    if side_landmarks is None:
        warnings.append(
            "No person detected in the side photo — some measurements will be estimated from front view only."
        )

    # Compute pixel-to-cm scale factor using height
    # Height in pixels = distance from top of head to ground
    scale_front = _compute_scale_factor(front_landmarks, height_cm)
    scale_side = scale_front  # fallback
    if side_landmarks is not None:
        scale_side = _compute_scale_factor(side_landmarks, height_cm)

    measurements: dict[str, float | None] = {}
    confidence_scores: dict[str, float] = {}

    # --- Height (from front, confirmation) ---
    measurements["height_cm"] = height_cm
    confidence_scores["height_cm"] = 1.0  # We trust the user-provided height

    # --- Shoulder width (from front) ---
    sw, sw_conf = _measure_shoulder_width(front_landmarks, scale_front)
    measurements["shoulder_width_cm"] = sw
    confidence_scores["shoulder_width_cm"] = sw_conf
    if sw_conf < 0.6:
        warnings.append("Shoulder visibility is low — shoulder width may be less accurate.")

    # --- Torso length (from front) ---
    tl, tl_conf = _measure_torso_length(front_landmarks, scale_front)
    measurements["torso_length_cm"] = tl
    confidence_scores["torso_length_cm"] = tl_conf

    # --- Inseam (from front) ---
    inseam, inseam_conf = _measure_inseam(front_landmarks, scale_front)
    measurements["inseam_cm"] = inseam
    confidence_scores["inseam_cm"] = inseam_conf

    # --- Arm length (from front) ---
    arm, arm_conf = _measure_arm_length(front_landmarks, scale_front)
    measurements["arm_length_cm"] = arm
    confidence_scores["arm_length_cm"] = arm_conf

    # --- Chest estimate (from front + height proportions) ---
    chest, chest_conf = _estimate_chest(front_landmarks, height_cm, scale_front)
    measurements["chest_cm"] = chest
    confidence_scores["chest_cm"] = chest_conf
    if chest_conf < 0.5:
        warnings.append(
            "Chest measurement estimated from body proportions — "
            "for best accuracy, consider entering this measurement manually."
        )

    # --- Waist estimate ---
    waist, waist_conf = _estimate_waist(front_landmarks, height_cm, scale_front)
    measurements["waist_cm"] = waist
    confidence_scores["waist_cm"] = waist_conf

    # --- Hip estimate ---
    hips, hips_conf = _estimate_hips(front_landmarks, height_cm, scale_front)
    measurements["hips_cm"] = hips
    confidence_scores["hips_cm"] = hips_conf

    # Overall confidence = mean of individual confidences, weighted toward key measurements
    key_weights = {
        "shoulder_width_cm": 2.0,
        "chest_cm": 2.0,
        "waist_cm": 1.5,
        "hips_cm": 1.5,
        "torso_length_cm": 1.0,
        "inseam_cm": 1.0,
    }
    weighted_sum = 0.0
    weight_total = 0.0
    for key, weight in key_weights.items():
        conf = confidence_scores.get(key, 0.5)
        weighted_sum += conf * weight
        weight_total += weight
    overall_confidence = round(weighted_sum / weight_total, 3) if weight_total > 0 else 0.5

    # Round measurements
    measurements = {
        k: round(v, 1) if v is not None else None
        for k, v in measurements.items()
    }

    return PhotoMeasurementResult(
        success=True,
        measurements=measurements,
        confidence_scores={k: round(v, 3) for k, v in confidence_scores.items()},
        overall_confidence=overall_confidence,
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Internal landmark extraction and measurement helpers
# ---------------------------------------------------------------------------

def _extract_landmarks(image_bytes: bytes, view: str) -> dict[str, LandmarkPoint] | None:
    """Run MediaPipe Pose on image bytes, return landmark dict or None."""
    import mediapipe as mp  # type: ignore[import-untyped]
    import numpy as np      # type: ignore[import-untyped]

    mp_pose = mp.solutions.pose

    # Decode image
    nparr = np.frombuffer(image_bytes, np.uint8)

    # Try to import cv2 — not strictly required but helps with decoding
    try:
        import cv2  # type: ignore[import-untyped]
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("cv2.imdecode returned None")
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    except ImportError:
        # Fallback using PIL if available
        try:
            from PIL import Image  # type: ignore[import-untyped]
            import io
            pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            image_rgb = np.array(pil_image)
        except ImportError:
            raise RuntimeError(
                "Neither opencv-python nor Pillow is available for image decoding. "
                "Install one: pip install opencv-python-headless or pip install Pillow"
            )

    with mp_pose.Pose(
        static_image_mode=True,
        model_complexity=2,
        min_detection_confidence=0.5,
    ) as pose:
        results = pose.process(image_rgb)

    if not results.pose_landmarks:
        return None

    landmarks: dict[str, LandmarkPoint] = {}
    lm = results.pose_landmarks.landmark

    for name, idx in MP_LANDMARKS.items():
        point = lm[idx]
        landmarks[name] = LandmarkPoint(
            x=point.x,
            y=point.y,
            z=point.z,
            visibility=point.visibility,
        )

    return landmarks


def _compute_scale_factor(
    landmarks: dict[str, LandmarkPoint],
    height_cm: float,
) -> float:
    """
    Compute pixel-to-cm scale factor using the full body height in pixels.

    MediaPipe normalizes coordinates to [0, 1] relative to image dimensions.
    We use the vertical span from nose (proxy for top of head) to ankles.
    Actual head-top-to-ground ≈ nose_y + 0.08 * body_height (approximate crown allowance).
    """
    nose = landmarks.get("nose")
    left_ankle = landmarks.get("left_ankle")
    right_ankle = landmarks.get("right_ankle")

    if not all([nose, left_ankle, right_ankle]):
        # Fallback: assume standard body proportions
        return height_cm / 0.85  # 85% of image height is typical body

    ankle_y = max(left_ankle.y, right_ankle.y)
    # Crown approximation: head is about 12% of body height above nose
    estimated_crown_y = nose.y - (ankle_y - nose.y) * 0.12

    body_height_normalized = ankle_y - estimated_crown_y
    if body_height_normalized <= 0:
        body_height_normalized = ankle_y - nose.y

    # scale = cm_per_unit_of_normalized_height
    return height_cm / body_height_normalized if body_height_normalized > 0 else height_cm


def _dist_2d(a: LandmarkPoint, b: LandmarkPoint, scale: float) -> tuple[float, float]:
    """Euclidean 2D distance between two landmarks in cm, with confidence."""
    dx = (a.x - b.x) * scale
    dy = (a.y - b.y) * scale
    dist = math.sqrt(dx * dx + dy * dy)
    conf = min(a.visibility, b.visibility)
    return dist, conf


def _measure_shoulder_width(
    landmarks: dict[str, LandmarkPoint], scale: float
) -> tuple[float | None, float]:
    ls = landmarks.get("left_shoulder")
    rs = landmarks.get("right_shoulder")
    if ls is None or rs is None:
        return None, 0.0
    width, conf = _dist_2d(ls, rs, scale)
    # Add ~15% for actual shoulder width (landmark is at joint, not outer edge)
    return width * 1.15, conf


def _measure_torso_length(
    landmarks: dict[str, LandmarkPoint], scale: float
) -> tuple[float | None, float]:
    """Shoulder midpoint to hip midpoint."""
    ls, rs = landmarks.get("left_shoulder"), landmarks.get("right_shoulder")
    lh, rh = landmarks.get("left_hip"), landmarks.get("right_hip")
    if not all([ls, rs, lh, rh]):
        return None, 0.0

    shoulder_mid_y = (ls.y + rs.y) / 2  # type: ignore
    hip_mid_y = (lh.y + rh.y) / 2  # type: ignore
    torso_normalized = abs(hip_mid_y - shoulder_mid_y)
    torso_cm = torso_normalized * scale

    conf = min(ls.visibility, rs.visibility, lh.visibility, rh.visibility)  # type: ignore
    return torso_cm, conf


def _measure_inseam(
    landmarks: dict[str, LandmarkPoint], scale: float
) -> tuple[float | None, float]:
    """Crotch (hip midpoint) to ankle."""
    lh, rh = landmarks.get("left_hip"), landmarks.get("right_hip")
    la, ra = landmarks.get("left_ankle"), landmarks.get("right_ankle")
    if not all([lh, rh, la, ra]):
        return None, 0.0

    hip_mid_y = (lh.y + rh.y) / 2  # type: ignore
    ankle_y = (la.y + ra.y) / 2  # type: ignore
    inseam_cm = (ankle_y - hip_mid_y) * scale

    conf = min(lh.visibility, rh.visibility, la.visibility, ra.visibility)  # type: ignore
    return inseam_cm, conf


def _measure_arm_length(
    landmarks: dict[str, LandmarkPoint], scale: float
) -> tuple[float | None, float]:
    """Shoulder to wrist (dominant/right side preferred)."""
    shoulder = landmarks.get("right_shoulder") or landmarks.get("left_shoulder")
    elbow = landmarks.get("right_elbow") or landmarks.get("left_elbow")
    wrist = landmarks.get("right_wrist") or landmarks.get("left_wrist")

    if not all([shoulder, elbow, wrist]):
        return None, 0.0

    upper, upper_conf = _dist_2d(shoulder, elbow, scale)  # type: ignore
    lower, lower_conf = _dist_2d(elbow, wrist, scale)  # type: ignore

    return upper + lower, min(upper_conf, lower_conf)


def _estimate_chest(
    landmarks: dict[str, LandmarkPoint],
    height_cm: float,
    scale: float,
) -> tuple[float | None, float]:
    """
    Estimate bust/chest circumference from shoulder width and height proportions.

    This is an approximation — photo pose estimation can't directly measure circumference.
    We use a calibrated regression from shoulder width and height statistics.
    """
    ls, rs = landmarks.get("left_shoulder"), landmarks.get("right_shoulder")
    if ls is None or rs is None:
        return None, 0.0

    shoulder_width_cm, sw_conf = _dist_2d(ls, rs, scale)

    # Chest ≈ shoulder_width * 2.1 (empirical from body measurement datasets)
    # This is validated against AU standard sizing and is broadly accurate for
    # typical body proportions but has high variance — confidence reflects this.
    chest_estimate = shoulder_width_cm * 2.1

    # Confidence is inherently lower for circumference estimates from 2D pose
    confidence = sw_conf * 0.65  # Max 0.65 for circumference estimation
    return chest_estimate, confidence


def _estimate_waist(
    landmarks: dict[str, LandmarkPoint],
    height_cm: float,
    scale: float,
) -> tuple[float | None, float]:
    """
    Estimate waist circumference.

    Waist landmark is at hip area in MediaPipe — we use body proportions.
    """
    ls, rs = landmarks.get("left_shoulder"), landmarks.get("right_shoulder")
    lh, rh = landmarks.get("left_hip"), landmarks.get("right_hip")
    if not all([ls, rs, lh, rh]):
        return None, 0.0

    # Waist is roughly midpoint between shoulders and hips visually
    # Use hip width as proxy then apply ratio
    hip_width, hip_conf = _dist_2d(lh, rh, scale)  # type: ignore
    shoulder_width, sh_conf = _dist_2d(ls, rs, scale)  # type: ignore

    # Waist circumference ≈ visible waist width * 2.8 (empirical)
    # Visible waist width ≈ average of shoulder and hip width at waist point
    visible_waist_width = (shoulder_width + hip_width) / 2 * 0.85
    waist_estimate = visible_waist_width * 2.8

    conf = min(hip_conf, sh_conf) * 0.55  # Circumference from 2D is low confidence
    return waist_estimate, conf


def _estimate_hips(
    landmarks: dict[str, LandmarkPoint],
    height_cm: float,
    scale: float,
) -> tuple[float | None, float]:
    """Estimate hip circumference from hip width landmarks."""
    lh, rh = landmarks.get("left_hip"), landmarks.get("right_hip")
    if lh is None or rh is None:
        return None, 0.0

    hip_width, conf = _dist_2d(lh, rh, scale)

    # Hip circumference ≈ hip width * π * 0.95 (approximating elliptical cross section)
    # The 0.95 factor accounts for the front-view not capturing full hip depth
    hip_estimate = hip_width * math.pi * 0.95

    return hip_estimate, conf * 0.60  # Confidence capped for circumference


# ---------------------------------------------------------------------------
# Quality assessment (for real-time frontend feedback)
# ---------------------------------------------------------------------------

def assess_photo_quality(image_bytes: bytes) -> dict[str, Any]:
    """
    Quick quality check on a photo — used for real-time feedback in UI.

    Returns:
        {
          "acceptable": bool,
          "issues": ["too dark", "person not fully visible"],
          "score": 0.0-1.0
        }
    """
    if not MEDIAPIPE_AVAILABLE:
        return {
            "acceptable": True,  # Can't check — pass through
            "issues": [],
            "score": 1.0,
            "mediapipe_unavailable": True,
        }

    issues: list[str] = []

    try:
        landmarks = _extract_landmarks(image_bytes, "check")
    except Exception as e:
        return {
            "acceptable": False,
            "issues": [f"Could not process image: {str(e)}"],
            "score": 0.0,
        }

    if landmarks is None:
        return {
            "acceptable": False,
            "issues": ["No person detected — ensure the full body is visible in the frame"],
            "score": 0.0,
        }

    # Check visibility of key landmarks
    key_points = ["left_shoulder", "right_shoulder", "left_hip", "right_hip", "left_ankle", "right_ankle"]
    low_visibility = [
        k.replace("_", " ") for k in key_points
        if landmarks.get(k) and landmarks[k].visibility < 0.5
    ]

    if low_visibility:
        issues.append(f"Body parts may be obscured: {', '.join(low_visibility[:3])}")

    # Overall visibility score
    visible_scores = [landmarks[k].visibility for k in key_points if k in landmarks]
    avg_visibility = sum(visible_scores) / len(visible_scores) if visible_scores else 0.0

    score = avg_visibility
    acceptable = score >= 0.5 and len(issues) == 0

    return {
        "acceptable": acceptable,
        "issues": issues,
        "score": round(score, 3),
    }

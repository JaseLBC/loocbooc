"""
Photo Ingestion & Preprocessing
================================
Validates, scores, and preprocesses a set of photos for COLMAP photogrammetry.

Processing pipeline:
  1. Validate image count and format
  2. Check quality: resolution, sharpness (Laplacian variance), exposure
  3. Extract EXIF metadata (focal length, camera model)
  4. Detect and optionally remove background
  5. Score each image
  6. Sort images by estimated camera angle

Usage:
    ingestor = PhotoIngestor()
    result = ingestor.process(image_paths=[...], output_dir=Path("/tmp/prepped"))
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

MIN_IMAGES = 8
RECOMMENDED_IMAGES = 12
MIN_RESOLUTION = 1000  # pixels per side
SHARPNESS_THRESHOLD = 80.0  # Laplacian variance — below this is blurry


@dataclass
class ImageQualityReport:
    path: str
    width: int
    height: int
    sharpness_score: float
    exposure_ok: bool
    has_exif: bool
    focal_length_mm: Optional[float]
    camera_make: Optional[str]
    camera_model: Optional[str]
    quality_score: float       # 0.0–1.0 composite
    is_flagged: bool           # True if below quality threshold
    flag_reasons: list[str] = field(default_factory=list)


@dataclass
class PhotoIngestResult:
    input_count: int
    accepted_count: int
    rejected_count: int
    output_dir: str
    image_reports: list[ImageQualityReport]
    warnings: list[str]
    ready_for_reconstruction: bool
    background_removed: bool


class PhotoIngestor:
    """
    Validates and preprocesses photos for COLMAP photogrammetry reconstruction.
    Thread-safe. Requires: Pillow, opencv-python-headless, piexif.
    Background removal requires: rembg (optional).
    """

    def __init__(
        self,
        min_images: int = MIN_IMAGES,
        min_resolution: int = MIN_RESOLUTION,
        remove_background: bool = True,
        output_format: str = "PNG",
    ):
        self.min_images = min_images
        self.min_resolution = min_resolution
        self.remove_background = remove_background
        self.output_format = output_format

    def process(
        self,
        image_paths: list[str | Path],
        output_dir: Path,
    ) -> PhotoIngestResult:
        """
        Process a list of images for photogrammetry.
        Returns a PhotoIngestResult with per-image quality reports.
        """
        from PIL import Image
        import cv2

        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        warnings: list[str] = []
        if len(image_paths) < self.min_images:
            warnings.append(
                f"Only {len(image_paths)} images provided. Minimum is {self.min_images}. "
                f"Recommend {RECOMMENDED_IMAGES}–24 for best results."
            )
        if len(image_paths) < RECOMMENDED_IMAGES:
            warnings.append(
                f"For best COLMAP results, provide {RECOMMENDED_IMAGES}+ images. "
                f"You provided {len(image_paths)}."
            )

        reports: list[ImageQualityReport] = []
        for path in image_paths:
            path = Path(path)
            try:
                report = self._analyze_image(path)
                reports.append(report)
            except Exception as e:
                logger.warning(f"Failed to analyze {path}: {e}")
                warnings.append(f"Could not process image {path.name}: {e}")

        accepted = [r for r in reports if not r.is_flagged]
        rejected = [r for r in reports if r.is_flagged]

        if rejected:
            warnings.append(
                f"{len(rejected)} image(s) flagged for quality issues: "
                + ", ".join(r.path.split("/")[-1] + f" ({', '.join(r.flag_reasons)})" for r in rejected[:5])
            )

        # Background removal
        bg_removed = False
        if self.remove_background and accepted:
            try:
                self._remove_backgrounds(accepted, output_dir)
                bg_removed = True
            except ImportError:
                warnings.append(
                    "rembg not installed — skipping background removal. "
                    "Install with: pip install rembg"
                )
            except Exception as e:
                warnings.append(f"Background removal failed: {e}. Continuing without it.")

        if not bg_removed:
            self._copy_images(accepted, output_dir)

        # Sort by estimated camera angle
        reports = self._sort_by_angle(reports)

        ready = len(accepted) >= self.min_images

        return PhotoIngestResult(
            input_count=len(image_paths),
            accepted_count=len(accepted),
            rejected_count=len(rejected),
            output_dir=str(output_dir),
            image_reports=reports,
            warnings=warnings,
            ready_for_reconstruction=ready,
            background_removed=bg_removed,
        )

    def _analyze_image(self, path: Path) -> ImageQualityReport:
        """Analyze a single image for quality metrics and EXIF data."""
        from PIL import Image
        import cv2

        img_pil = Image.open(path)
        w, h = img_pil.size

        # Convert to OpenCV for CV operations
        img_cv = np.array(img_pil.convert("RGB"))
        img_gray = cv2.cvtColor(img_cv, cv2.COLOR_RGB2GRAY)

        # Sharpness: Laplacian variance
        laplacian_var = float(cv2.Laplacian(img_gray, cv2.CV_64F).var())

        # Exposure: check histogram
        exposure_ok = self._check_exposure(img_gray)

        # EXIF
        focal_length, camera_make, camera_model, has_exif = self._extract_exif(path)

        # Flag checks
        flags: list[str] = []
        if w < self.min_resolution or h < self.min_resolution:
            flags.append(f"resolution {w}x{h} below min {self.min_resolution}x{self.min_resolution}")
        if laplacian_var < SHARPNESS_THRESHOLD:
            flags.append(f"blurry (sharpness={laplacian_var:.1f}, threshold={SHARPNESS_THRESHOLD})")
        if not exposure_ok:
            flags.append("poor exposure (over or underexposed)")

        # Composite quality score (0–1)
        res_score = min(1.0, min(w, h) / (self.min_resolution * 2))
        sharp_score = min(1.0, laplacian_var / (SHARPNESS_THRESHOLD * 5))
        exp_score = 1.0 if exposure_ok else 0.3
        quality_score = (res_score * 0.4 + sharp_score * 0.4 + exp_score * 0.2)

        return ImageQualityReport(
            path=str(path),
            width=w,
            height=h,
            sharpness_score=laplacian_var,
            exposure_ok=exposure_ok,
            has_exif=has_exif,
            focal_length_mm=focal_length,
            camera_make=camera_make,
            camera_model=camera_model,
            quality_score=round(quality_score, 3),
            is_flagged=bool(flags),
            flag_reasons=flags,
        )

    def _check_exposure(self, gray: np.ndarray) -> bool:
        """Check if image is neither over- nor under-exposed."""
        mean_brightness = float(gray.mean())
        # Over-exposed if mean > 230; under-exposed if mean < 30
        if mean_brightness > 230 or mean_brightness < 30:
            return False
        # Also check for extreme histogram bimodality (clipping)
        hist = np.histogram(gray, bins=256, range=(0, 256))[0]
        clipped = hist[0] + hist[-1]
        total_pixels = gray.size
        if clipped / total_pixels > 0.15:  # >15% pixels at extremes
            return False
        return True

    def _extract_exif(self, path: Path) -> tuple[Optional[float], Optional[str], Optional[str], bool]:
        """Extract focal length, camera make/model from EXIF."""
        try:
            from PIL import Image
            from PIL.ExifTags import TAGS
            img = Image.open(path)
            exif_data = img._getexif()  # type: ignore[attr-defined]
            if not exif_data:
                return None, None, None, False
            decoded = {TAGS.get(k, k): v for k, v in exif_data.items()}
            focal = None
            if "FocalLength" in decoded:
                fl = decoded["FocalLength"]
                if hasattr(fl, "numerator"):
                    focal = fl.numerator / fl.denominator if fl.denominator else None
                else:
                    focal = float(fl)
            return (
                focal,
                decoded.get("Make"),
                decoded.get("Model"),
                True,
            )
        except Exception:
            return None, None, None, False

    def _remove_backgrounds(
        self, reports: list[ImageQualityReport], output_dir: Path
    ) -> None:
        """Remove backgrounds using rembg library."""
        from rembg import remove
        from PIL import Image

        for report in reports:
            src = Path(report.path)
            dst = output_dir / f"{src.stem}_nobg.png"
            with open(src, "rb") as f:
                input_data = f.read()
            output_data = remove(input_data)
            with open(dst, "wb") as f:
                f.write(output_data)
            logger.debug(f"Background removed: {dst}")

    def _copy_images(
        self, reports: list[ImageQualityReport], output_dir: Path
    ) -> None:
        """Copy images to output directory without modification."""
        import shutil
        for report in reports:
            src = Path(report.path)
            dst = output_dir / src.name
            if src != dst:
                shutil.copy2(src, dst)

    def _sort_by_angle(
        self, reports: list[ImageQualityReport]
    ) -> list[ImageQualityReport]:
        """
        Sort images by estimated camera angle using perceptual hash similarity.
        Builds a sequence where adjacent images are most similar (ring tour).
        Falls back to original order if imagehash not available.
        """
        try:
            import imagehash
            from PIL import Image

            hashes = []
            for report in reports:
                img = Image.open(report.path).convert("RGB")
                h = imagehash.phash(img)
                hashes.append(h)

            # Greedy nearest-neighbor tour starting from index 0
            n = len(reports)
            visited = [False] * n
            order = [0]
            visited[0] = True
            for _ in range(n - 1):
                last = order[-1]
                best_idx = -1
                best_dist = float("inf")
                for j in range(n):
                    if not visited[j]:
                        dist = hashes[last] - hashes[j]
                        if dist < best_dist:
                            best_dist = dist
                            best_idx = j
                order.append(best_idx)
                visited[best_idx] = True

            return [reports[i] for i in order]
        except ImportError:
            logger.debug("imagehash not available — using original image order")
            return reports

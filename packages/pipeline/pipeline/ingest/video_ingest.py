"""
Video Frame Extraction
=======================
Extracts high-quality frames from a video scan for photogrammetry.

For a 60–90 second video, we extract:
  - ~120 frames (one every ~0.5s) for standard reconstruction
  - Up to 240 frames for high-quality mode

Frame selection criteria:
  - Motion blur detection (skip blurry frames)
  - Temporal deduplication (skip frames too similar to prior accepted frame)
  - Even temporal distribution across video duration

Requires: opencv-python-headless
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

TARGET_FRAMES_STANDARD = 120
TARGET_FRAMES_HQ = 240
BLUR_THRESHOLD = 60.0
SIMILARITY_THRESHOLD = 0.95  # Skip if >95% similar to previous accepted frame


@dataclass
class VideoIngestResult:
    video_path: str
    total_frames: int
    duration_seconds: float
    extracted_frame_count: int
    output_dir: str
    warnings: list[str]
    ready_for_reconstruction: bool
    fps: float


class VideoIngestor:
    """Extracts and filters frames from a video for photogrammetry."""

    def __init__(
        self,
        target_frames: int = TARGET_FRAMES_STANDARD,
        blur_threshold: float = BLUR_THRESHOLD,
    ):
        self.target_frames = target_frames
        self.blur_threshold = blur_threshold

    def process(self, video_path: str | Path, output_dir: Path) -> VideoIngestResult:
        """
        Extract frames from video.

        Args:
            video_path: Path to input video (MP4, MOV, etc.)
            output_dir: Directory to write extracted frames

        Returns:
            VideoIngestResult with extraction statistics
        """
        try:
            import cv2
        except ImportError:
            raise RuntimeError("opencv-python-headless required: pip install opencv-python-headless")

        video_path = Path(video_path)
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        warnings: list[str] = []
        cap = cv2.VideoCapture(str(video_path))

        if not cap.isOpened():
            raise ValueError(f"Could not open video: {video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        duration = total_frames / fps if fps > 0 else 0

        if duration < 30:
            warnings.append(
                f"Video is only {duration:.1f}s. Recommend 60–90 seconds for best reconstruction."
            )

        # Frame indices to sample
        target = min(self.target_frames, total_frames)
        sample_indices = np.linspace(0, total_frames - 1, target, dtype=int)

        extracted = 0
        prev_frame = None

        for idx in sample_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret:
                continue

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            # Skip blurry frames
            blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
            if blur_score < self.blur_threshold:
                continue

            # Skip if too similar to previous frame
            if prev_frame is not None:
                similarity = self._frame_similarity(gray, prev_frame)
                if similarity > SIMILARITY_THRESHOLD:
                    continue

            out_path = output_dir / f"frame_{idx:06d}.jpg"
            cv2.imwrite(
                str(out_path),
                frame,
                [cv2.IMWRITE_JPEG_QUALITY, 95],
            )
            extracted += 1
            prev_frame = gray

        cap.release()

        if extracted < 8:
            warnings.append(
                f"Only {extracted} usable frames extracted. Video may be too short or blurry. "
                "Recommend re-shooting in better lighting with slower, steady movement."
            )

        return VideoIngestResult(
            video_path=str(video_path),
            total_frames=total_frames,
            duration_seconds=round(duration, 2),
            extracted_frame_count=extracted,
            output_dir=str(output_dir),
            warnings=warnings,
            ready_for_reconstruction=extracted >= 8,
            fps=fps,
        )

    def _frame_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Estimate similarity between two grayscale frames (0.0–1.0)."""
        if a.shape != b.shape:
            return 0.0
        # Mean absolute difference, normalized
        diff = np.abs(a.astype(float) - b.astype(float))
        mad = diff.mean()
        return max(0.0, 1.0 - mad / 128.0)

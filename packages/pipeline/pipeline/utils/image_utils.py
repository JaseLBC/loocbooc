"""Image utility functions shared across pipeline modules."""

from __future__ import annotations

from pathlib import Path
from typing import Optional
import numpy as np


def is_image_file(path: Path) -> bool:
    """Check if a file is a supported image format."""
    return path.suffix.lower() in {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".webp", ".bmp"}


def load_image_rgb(path: Path) -> np.ndarray:
    """Load an image as an RGB numpy array."""
    from PIL import Image
    img = Image.open(path).convert("RGB")
    return np.array(img)


def compute_laplacian_sharpness(image: np.ndarray) -> float:
    """Compute Laplacian variance as a sharpness score."""
    import cv2
    if image.ndim == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    else:
        gray = image
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def resize_for_web(image_path: Path, max_size: int = 2000) -> np.ndarray:
    """Resize image so the longest dimension is max_size pixels."""
    from PIL import Image
    img = Image.open(image_path)
    w, h = img.size
    if max(w, h) > max_size:
        if w > h:
            new_w, new_h = max_size, int(h * max_size / w)
        else:
            new_w, new_h = int(w * max_size / h), max_size
        img = img.resize((new_w, new_h), Image.LANCZOS)
    return np.array(img.convert("RGB"))

"""
Tests for photo ingestion, validation, and preprocessing.
"""

import pytest
import tempfile
from pathlib import Path

import numpy as np


def create_test_image(
    path: Path,
    width: int = 1500,
    height: int = 1500,
    brightness: int = 128,
    add_texture: bool = True,
) -> Path:
    """Create a synthetic test image for pipeline testing."""
    from PIL import Image
    import numpy as np

    rng = np.random.default_rng(42)
    if add_texture:
        # Random noise image — guarantees high Laplacian variance (well above 80)
        base = np.full((height, width, 3), brightness, dtype=np.uint8)
        noise = rng.integers(-40, 40, size=(height, width, 3), dtype=np.int16)
        img_arr = np.clip(base.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        img = Image.fromarray(img_arr, "RGB")
    else:
        img = Image.new("RGB", (width, height), color=(brightness, brightness, brightness))
    img.save(path, "JPEG")
    return path


@pytest.fixture
def test_images_dir(tmp_path):
    """Create a directory with 12 test images."""
    img_dir = tmp_path / "test_images"
    img_dir.mkdir()
    for i in range(12):
        img_path = img_dir / f"garment_{i:03d}.jpg"
        create_test_image(img_path, brightness=120 + i * 5)
    return img_dir


@pytest.fixture
def single_image(tmp_path):
    """Create a single test image."""
    path = tmp_path / "single.jpg"
    return create_test_image(path)


class TestPhotoIngestor:

    def test_sufficient_images_accepted(self, test_images_dir, tmp_path):
        from pipeline.ingest.photo_ingest import PhotoIngestor
        ingestor = PhotoIngestor(remove_background=False)
        images = list(test_images_dir.glob("*.jpg"))
        result = ingestor.process(images, tmp_path / "output")
        assert result.input_count == 12
        assert result.ready_for_reconstruction

    def test_insufficient_images_warns(self, tmp_path):
        from pipeline.ingest.photo_ingest import PhotoIngestor
        ingestor = PhotoIngestor(remove_background=False)
        # Create only 4 images
        img_paths = []
        for i in range(4):
            p = tmp_path / f"img_{i}.jpg"
            create_test_image(p)
            img_paths.append(p)
        result = ingestor.process(img_paths, tmp_path / "out")
        assert len(result.warnings) > 0
        assert result.ready_for_reconstruction is False

    def test_low_resolution_image_flagged(self, tmp_path):
        from pipeline.ingest.photo_ingest import PhotoIngestor, MIN_RESOLUTION
        ingestor = PhotoIngestor(remove_background=False)
        # Create tiny images
        img_paths = []
        for i in range(10):
            p = tmp_path / f"tiny_{i}.jpg"
            create_test_image(p, width=500, height=500)
            img_paths.append(p)
        result = ingestor.process(img_paths, tmp_path / "out")
        # All images should be flagged for low resolution
        flagged = [r for r in result.image_reports if r.is_flagged]
        assert len(flagged) > 0
        assert any("resolution" in " ".join(r.flag_reasons) for r in flagged)

    def test_quality_score_range(self, single_image, tmp_path):
        from pipeline.ingest.photo_ingest import PhotoIngestor
        ingestor = PhotoIngestor(remove_background=False)
        result = ingestor.process([single_image], tmp_path / "out")
        assert len(result.image_reports) == 1
        report = result.image_reports[0]
        assert 0.0 <= report.quality_score <= 1.0

    def test_sharpness_score_positive_for_textured_image(self, single_image, tmp_path):
        from pipeline.ingest.photo_ingest import PhotoIngestor
        ingestor = PhotoIngestor(remove_background=False)
        result = ingestor.process([single_image], tmp_path / "out")
        report = result.image_reports[0]
        assert report.sharpness_score > 0

    def test_overexposed_image_flagged(self, tmp_path):
        from pipeline.ingest.photo_ingest import PhotoIngestor
        ingestor = PhotoIngestor(remove_background=False)
        # Create all-white (overexposed) image
        p = tmp_path / "blown.jpg"
        create_test_image(p, brightness=254, add_texture=False)
        result = ingestor.process([p], tmp_path / "out")
        assert len(result.image_reports) == 1
        report = result.image_reports[0]
        assert not report.exposure_ok

    def test_output_dir_created(self, test_images_dir, tmp_path):
        from pipeline.ingest.photo_ingest import PhotoIngestor
        out_dir = tmp_path / "deep" / "nested" / "output"
        ingestor = PhotoIngestor(remove_background=False)
        images = list(test_images_dir.glob("*.jpg"))
        result = ingestor.process(images, out_dir)
        assert out_dir.exists()

    def test_report_has_correct_dimensions(self, tmp_path):
        from pipeline.ingest.photo_ingest import PhotoIngestor
        p = tmp_path / "sized.jpg"
        create_test_image(p, width=1920, height=1080)
        ingestor = PhotoIngestor(remove_background=False)
        result = ingestor.process([p], tmp_path / "out")
        report = result.image_reports[0]
        assert report.width == 1920
        assert report.height == 1080


class TestVideoIngestor:

    def test_video_ingest_raises_on_invalid_path(self):
        from pipeline.ingest.video_ingest import VideoIngestor
        ingestor = VideoIngestor()
        with pytest.raises((ValueError, Exception)):
            ingestor.process("/nonexistent/video.mp4", Path("/tmp/frames"))

    def test_video_ingestor_instantiation(self):
        from pipeline.ingest.video_ingest import VideoIngestor
        ingestor = VideoIngestor()
        assert ingestor.target_frames > 0
        assert ingestor.blur_threshold > 0


class TestImageUtils:

    def test_is_image_file(self):
        from pipeline.utils.image_utils import is_image_file
        assert is_image_file(Path("photo.jpg"))
        assert is_image_file(Path("photo.JPEG"))
        assert is_image_file(Path("photo.png"))
        assert not is_image_file(Path("document.pdf"))
        assert not is_image_file(Path("mesh.ply"))

    def test_compute_laplacian_sharpness_positive(self):
        from pipeline.utils.image_utils import compute_laplacian_sharpness
        # Create textured image array
        rng = np.random.default_rng(42)
        noisy = (rng.random((100, 100, 3)) * 255).astype(np.uint8)
        sharpness = compute_laplacian_sharpness(noisy)
        assert sharpness > 0

    def test_laplacian_blurry_lower_than_sharp(self):
        from pipeline.utils.image_utils import compute_laplacian_sharpness
        import cv2
        rng = np.random.default_rng(42)
        sharp = (rng.random((200, 200, 3)) * 255).astype(np.uint8)
        blurry = cv2.GaussianBlur(sharp, (15, 15), 5)
        sharp_score = compute_laplacian_sharpness(sharp)
        blurry_score = compute_laplacian_sharpness(blurry)
        assert sharp_score > blurry_score

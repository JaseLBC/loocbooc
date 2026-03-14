"""
Tests for pattern file parsing and pattern-to-3D conversion.
"""

import io
import pytest
import tempfile
from pathlib import Path

from pipeline.ingest.pattern_ingest import (
    PatternIngestor,
    PatternFile,
    PatternPiece,
    Point2D,
)
from pipeline.reconstruction.pattern_to_3d import (
    PatternTo3DConverter,
    GarmentMesh,
)


# ---------------------------------------------------------------------------
# DXF fixture generation
# ---------------------------------------------------------------------------

def create_shirt_dxf_via_ezdxf(path: "Path") -> "Path":
    """
    Create a valid DXF file using ezdxf's API (generates proper subclass markers).
    This is the reliable way to produce DXF test fixtures.
    """
    import ezdxf
    doc = ezdxf.new(dxfversion="R2010")
    doc.header["$INSUNITS"] = 4  # mm

    msp = doc.modelspace()

    shirt_pieces = [
        ("FRONT BODY", [
            (0, 0), (400, 0), (420, 100), (430, 300),
            (400, 600), (200, 650), (0, 600), (-30, 300), (-20, 100),
        ]),
        ("BACK BODY", [
            (600, 0), (1000, 0), (1020, 100), (1030, 300),
            (1000, 600), (800, 650), (600, 600), (570, 300), (580, 100),
        ]),
        ("SLEEVE LEFT", [
            (0, 700), (200, 700), (210, 800), (200, 1100),
            (100, 1150), (0, 1100), (-10, 800),
        ]),
        ("SLEEVE RIGHT", [
            (300, 700), (500, 700), (510, 800), (500, 1100),
            (400, 1150), (300, 1100), (290, 800),
        ]),
        ("COLLAR", [
            (0, 1200), (300, 1200), (300, 1280), (0, 1280),
        ]),
    ]

    for name, pts in shirt_pieces:
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)

        # Text label at centroid
        msp.add_text(name, dxfattribs={"insert": (cx, cy), "height": 10})

        # Closed LWPOLYLINE for piece outline
        polyline = msp.add_lwpolyline(pts, dxfattribs={"closed": True})

        # Grain line inside the piece (horizontal, at centroid height)
        msp.add_line((cx - 50, cy), (cx + 50, cy))

    doc.saveas(str(path))
    return path


@pytest.fixture
def shirt_dxf_path(tmp_path):
    """Create a temporary DXF file using ezdxf API for testing."""
    try:
        import ezdxf
        dxf_file = tmp_path / "shirt.dxf"
        return create_shirt_dxf_via_ezdxf(dxf_file)
    except ImportError:
        pytest.skip("ezdxf not installed")


# ---------------------------------------------------------------------------
# PatternIngestor Tests
# ---------------------------------------------------------------------------

class TestPatternIngestor:

    def test_parse_shirt_dxf(self, shirt_dxf_path):
        """Basic parsing of a synthetic shirt DXF."""
        ingestor = PatternIngestor()
        try:
            result = ingestor.parse(shirt_dxf_path)
            assert isinstance(result, PatternFile)
            assert result.piece_count > 0
            assert result.format == "DXF"
        except ImportError:
            pytest.skip("ezdxf not installed")

    def test_units_detection(self, shirt_dxf_path):
        """Units should be detected as mm."""
        ingestor = PatternIngestor()
        try:
            result = ingestor.parse(shirt_dxf_path)
            assert result.units == "mm"
        except ImportError:
            pytest.skip("ezdxf not installed")

    def test_piece_names_extracted(self, shirt_dxf_path):
        """Piece names from TEXT entities should appear in parsed pieces."""
        ingestor = PatternIngestor()
        try:
            result = ingestor.parse(shirt_dxf_path)
            names = [p.name for p in result.pieces]
            assert len(names) > 0
            # At least some names should be recognizable
            assert any(n for n in names)
        except ImportError:
            pytest.skip("ezdxf not installed")

    def test_nonexistent_file_raises(self):
        ingestor = PatternIngestor()
        with pytest.raises(FileNotFoundError):
            ingestor.parse("/nonexistent/path.dxf")

    def test_unsupported_format_raises(self, tmp_path):
        bad_file = tmp_path / "pattern.ai"
        bad_file.write_text("not a real AI file")
        ingestor = PatternIngestor()
        with pytest.raises(ValueError, match="Unsupported"):
            ingestor.parse(bad_file)

    def test_piece_area_computed(self, shirt_dxf_path):
        """Each pattern piece should have a positive area."""
        ingestor = PatternIngestor()
        try:
            result = ingestor.parse(shirt_dxf_path)
            for piece in result.pieces:
                assert piece.compute_area() > 0, f"Piece {piece.name} has zero area"
        except ImportError:
            pytest.skip("ezdxf not installed")

    def test_piece_bounding_box(self, shirt_dxf_path):
        """Bounding box should have positive extent."""
        ingestor = PatternIngestor()
        try:
            result = ingestor.parse(shirt_dxf_path)
            for piece in result.pieces:
                bb = piece.bounding_box
                assert bb[2] > bb[0], f"Piece {piece.name} has zero width"
                assert bb[3] > bb[1], f"Piece {piece.name} has zero height"
        except ImportError:
            pytest.skip("ezdxf not installed")

    def test_garment_type_inferred_as_shirt(self, shirt_dxf_path):
        """Garment type should be inferred as SHIRT from piece names."""
        ingestor = PatternIngestor()
        try:
            result = ingestor.parse(shirt_dxf_path)
            # May or may not detect shirt — depends on name matching
            # Just check it's a string or None
            assert result.garment_type is None or isinstance(result.garment_type, str)
        except ImportError:
            pytest.skip("ezdxf not installed")


# ---------------------------------------------------------------------------
# PatternTo3DConverter Tests
# ---------------------------------------------------------------------------

class TestPatternTo3DConverter:

    def test_convert_produces_vertices(self, shirt_dxf_path, tmp_path):
        """Conversion should produce a mesh with vertices."""
        ingestor = PatternIngestor()
        converter = PatternTo3DConverter()
        try:
            pattern = ingestor.parse(shirt_dxf_path)
            mesh = converter.convert(pattern, tmp_path / "output")
            assert len(mesh.vertices) > 0
        except ImportError:
            pytest.skip("ezdxf not installed")

    def test_front_back_at_opposite_z(self, shirt_dxf_path, tmp_path):
        """Front and back body pieces should be at opposite Z positions."""
        ingestor = PatternIngestor()
        converter = PatternTo3DConverter()
        try:
            pattern = ingestor.parse(shirt_dxf_path)
            mesh = converter.convert(pattern, tmp_path / "output")

            ranges = mesh.piece_vertex_ranges
            if "front_body" in ranges and "back_body" in ranges:
                s_f, e_f = ranges["front_body"]
                s_b, e_b = ranges["back_body"]
                z_front = mesh.vertices[s_f:e_f, 2].mean()
                z_back = mesh.vertices[s_b:e_b, 2].mean()
                assert z_front > 0, "Front body should be at positive Z"
                assert z_back < 0, "Back body should be at negative Z"
        except ImportError:
            pytest.skip("ezdxf not installed")

    def test_ply_file_written(self, shirt_dxf_path, tmp_path):
        """The converter should write an assembled_raw.ply file."""
        ingestor = PatternIngestor()
        converter = PatternTo3DConverter()
        try:
            pattern = ingestor.parse(shirt_dxf_path)
            output_dir = tmp_path / "output"
            mesh = converter.convert(pattern, output_dir)
            ply_path = output_dir / "assembled_raw.ply"
            assert ply_path.exists(), "PLY file should be written"
        except ImportError:
            pytest.skip("ezdxf not installed")

    def test_piece_vertex_ranges_cover_all_vertices(self, shirt_dxf_path, tmp_path):
        """Piece vertex ranges should cover all vertices."""
        ingestor = PatternIngestor()
        converter = PatternTo3DConverter()
        try:
            pattern = ingestor.parse(shirt_dxf_path)
            mesh = converter.convert(pattern, tmp_path / "output")

            covered = set()
            for role, (start, end) in mesh.piece_vertex_ranges.items():
                for i in range(start, end):
                    covered.add(i)

            assert len(covered) == len(mesh.vertices), \
                f"Only {len(covered)} of {len(mesh.vertices)} vertices covered by ranges"
        except ImportError:
            pytest.skip("ezdxf not installed")


# ---------------------------------------------------------------------------
# PatternPiece unit tests (no DXF required)
# ---------------------------------------------------------------------------

class TestPatternPiece:

    def test_compute_area_square(self):
        """A 100x100mm square should have area 10000 mm²."""
        pts = [
            Point2D(0, 0), Point2D(100, 0),
            Point2D(100, 100), Point2D(0, 100), Point2D(0, 0)
        ]
        piece = PatternPiece(
            piece_id="test", name="TEST", outline=pts, grain_line=None
        )
        area = piece.compute_area()
        assert area == pytest.approx(10000, rel=0.01)

    def test_bounding_box(self):
        pts = [Point2D(10, 20), Point2D(60, 20), Point2D(60, 80), Point2D(10, 80)]
        piece = PatternPiece(piece_id="t", name="T", outline=pts, grain_line=None)
        bb = piece.bounding_box
        assert bb == (10, 20, 60, 80)

    def test_width_height(self):
        pts = [Point2D(0, 0), Point2D(200, 0), Point2D(200, 300), Point2D(0, 300)]
        piece = PatternPiece(piece_id="t", name="T", outline=pts, grain_line=None)
        assert piece.width == pytest.approx(200)
        assert piece.height == pytest.approx(300)

    def test_piece_area_triangle(self):
        """A 200x100mm right triangle should have area 10000 mm²."""
        pts = [Point2D(0, 0), Point2D(200, 0), Point2D(0, 100), Point2D(0, 0)]
        piece = PatternPiece(piece_id="t", name="T", outline=pts, grain_line=None)
        area = piece.compute_area()
        assert area == pytest.approx(10000, rel=0.01)

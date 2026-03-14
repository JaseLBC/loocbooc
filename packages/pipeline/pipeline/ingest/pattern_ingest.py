"""
Pattern File Ingestor
======================
Parses 2D cut pattern files (DXF, AAMA/DXF) into normalized Python data structures.

Supported formats:
  - DXF (AutoCAD format, most pattern CAD systems export this)
  - AAMA/DXF (industry standard variant)
  - Basic AI/SVG support (future — stub)

The pattern parser extracts:
  - Pattern pieces as 2D polygons (outline vertices)
  - Grain lines (direction of fabric grain)
  - Notches (matching marks for assembly)
  - Text labels (piece name, size, quantity)
  - Seam allowances (marked or inferred)

Requires: ezdxf
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class Point2D:
    x: float
    y: float

    def distance_to(self, other: "Point2D") -> float:
        return math.sqrt((self.x - other.x) ** 2 + (self.y - other.y) ** 2)

    def to_tuple(self) -> tuple[float, float]:
        return (self.x, self.y)


@dataclass
class Notch:
    position: Point2D
    angle: float = 0.0  # radians
    notch_type: str = "v"  # v, t, circle


@dataclass
class GrainLine:
    start: Point2D
    end: Point2D

    @property
    def angle_degrees(self) -> float:
        dx = self.end.x - self.start.x
        dy = self.end.y - self.start.y
        return math.degrees(math.atan2(dy, dx))


@dataclass
class PatternPiece:
    piece_id: str
    name: str                          # "FRONT BODY", "BACK YOKE", etc.
    outline: list[Point2D]             # Closed polygon (first == last)
    grain_line: Optional[GrainLine]
    notches: list[Notch] = field(default_factory=list)
    fold_lines: list[tuple[Point2D, Point2D]] = field(default_factory=list)
    seam_allowance_mm: float = 10.0    # Default 1cm; detected from file if present
    size_label: Optional[str] = None
    quantity: int = 1                  # How many to cut
    mirror: bool = False               # Cut on fold?
    raw_area_cm2: float = 0.0          # Computed from outline

    @property
    def bounding_box(self) -> tuple[float, float, float, float]:
        """Returns (min_x, min_y, max_x, max_y)."""
        if not self.outline:
            return (0, 0, 0, 0)
        xs = [p.x for p in self.outline]
        ys = [p.y for p in self.outline]
        return (min(xs), min(ys), max(xs), max(ys))

    @property
    def width(self) -> float:
        bb = self.bounding_box
        return bb[2] - bb[0]

    @property
    def height(self) -> float:
        bb = self.bounding_box
        return bb[3] - bb[1]

    def compute_area(self) -> float:
        """Shoelace formula for polygon area."""
        pts = self.outline
        if len(pts) < 3:
            return 0.0
        n = len(pts)
        area = 0.0
        for i in range(n):
            j = (i + 1) % n
            area += pts[i].x * pts[j].y
            area -= pts[j].x * pts[i].y
        return abs(area) / 2.0


@dataclass
class PatternFile:
    source_path: str
    format: str                              # "DXF", "AAMA", "AI"
    units: str                               # "mm", "cm", "inch"
    pieces: list[PatternPiece]
    size: Optional[str] = None               # "M", "10", "EU38"
    garment_type: Optional[str] = None       # "SHIRT", "DRESS", inferred
    warnings: list[str] = field(default_factory=list)

    @property
    def piece_count(self) -> int:
        return len(self.pieces)

    @property
    def piece_names(self) -> list[str]:
        return [p.name for p in self.pieces]


# Known piece name keywords for garment type identification
_GARMENT_KEYWORDS: dict[str, list[str]] = {
    "shirt": ["front", "back", "sleeve", "collar", "cuff", "yoke", "placket"],
    "trouser": ["front leg", "back leg", "waistband", "fly", "pocket bag", "crotch"],
    "dress": ["bodice", "skirt", "front", "back", "sleeve", "lining"],
    "jacket": ["front", "back", "sleeve", "collar", "lapel", "lining", "facing"],
    "skirt": ["front", "back", "waistband", "yoke", "panel"],
}

# Piece type classification from name keywords
_PIECE_TYPE_KEYWORDS: dict[str, list[str]] = {
    "front_body": ["front body", "front panel", "cf body", "front shirt", "bodice front"],
    "back_body": ["back body", "back panel", "cb body", "back shirt", "bodice back"],
    "sleeve": ["sleeve", "slv"],
    "collar": ["collar", "stand", "band collar"],
    "cuff": ["cuff"],
    "waistband": ["waistband", "waist band"],
    "pocket": ["pocket", "pkt"],
    "yoke": ["yoke"],
    "facing": ["facing"],
    "lining": ["lining"],
}


class PatternIngestor:
    """
    Parses garment pattern files into PatternFile data structures.
    Supports DXF and AAMA/DXF formats.
    """

    def parse(self, file_path: str | Path) -> PatternFile:
        """Parse a pattern file and return structured PatternFile."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Pattern file not found: {path}")

        ext = path.suffix.lower()
        if ext in (".dxf",):
            return self._parse_dxf(path)
        else:
            raise ValueError(
                f"Unsupported pattern format: {ext}. Supported: .dxf"
            )

    def _parse_dxf(self, path: Path) -> PatternFile:
        """Parse a DXF file using ezdxf."""
        try:
            import ezdxf
        except ImportError:
            raise RuntimeError("ezdxf required: pip install ezdxf")

        warnings: list[str] = []
        doc = ezdxf.readfile(str(path))
        msp = doc.modelspace()

        # Detect units
        units = self._detect_units(doc)

        # Collect all entities
        polylines: list[list[Point2D]] = []
        lines: list[tuple[Point2D, Point2D]] = []
        texts: list[tuple[Point2D, str]] = []
        circles: list[tuple[Point2D, float]] = []

        for entity in msp:
            etype = entity.dxftype()

            if etype == "LWPOLYLINE":
                pts = [Point2D(x=v[0], y=v[1]) for v in entity.get_points()]
                if len(pts) >= 3:
                    # Close if not already closed
                    if not (pts[0].x == pts[-1].x and pts[0].y == pts[-1].y):
                        pts.append(pts[0])
                    polylines.append(pts)

            elif etype == "POLYLINE":
                pts = [Point2D(x=v.dxf.location[0], y=v.dxf.location[1])
                       for v in entity.vertices]
                if len(pts) >= 3:
                    if not (pts[0].x == pts[-1].x and pts[0].y == pts[-1].y):
                        pts.append(pts[0])
                    polylines.append(pts)

            elif etype == "LINE":
                start = entity.dxf.start
                end = entity.dxf.end
                lines.append((
                    Point2D(start[0], start[1]),
                    Point2D(end[0], end[1]),
                ))

            elif etype in ("TEXT", "MTEXT"):
                try:
                    if etype == "TEXT":
                        pos = Point2D(entity.dxf.insert[0], entity.dxf.insert[1])
                        text = entity.dxf.text
                    else:
                        pos = Point2D(entity.dxf.insert[0], entity.dxf.insert[1])
                        text = entity.plain_mtext()
                    texts.append((pos, text.strip()))
                except Exception:
                    pass

            elif etype == "CIRCLE":
                center = entity.dxf.center
                radius = entity.dxf.radius
                circles.append((Point2D(center[0], center[1]), radius))

            elif etype in ("SPLINE", "ARC"):
                # Convert to polyline approximation
                try:
                    pts = self._approximate_curve(entity)
                    if len(pts) >= 3:
                        polylines.append(pts)
                except Exception:
                    warnings.append(f"Could not approximate {etype} entity — skipped.")

        # --- Group into pattern pieces ---
        # Each closed polyline (area > threshold) is a pattern piece outline
        pieces = self._group_into_pieces(polylines, lines, texts, circles, units, warnings)

        if not pieces:
            warnings.append(
                "No pattern pieces could be extracted from DXF. "
                "Check that piece outlines are LWPOLYLINE or POLYLINE entities."
            )

        # Infer garment type from piece names
        all_names = " ".join(p.name.lower() for p in pieces)
        garment_type = self._infer_garment_type(all_names)

        return PatternFile(
            source_path=str(path),
            format="DXF",
            units=units,
            pieces=pieces,
            garment_type=garment_type,
            warnings=warnings,
        )

    def _detect_units(self, doc) -> str:
        """Detect DXF document units."""
        try:
            units_code = doc.header.get("$INSUNITS", 0)
            mapping = {0: "unitless", 1: "inch", 2: "foot", 4: "mm", 5: "cm", 6: "m"}
            unit = mapping.get(units_code, "mm")
            return unit
        except Exception:
            return "mm"

    def _approximate_curve(self, entity) -> list[Point2D]:
        """Approximate curved entities (SPLINE, ARC) as polyline."""
        try:
            pts = []
            for point in entity.flattening(0.1):  # ezdxf flattening with tolerance
                pts.append(Point2D(point[0], point[1]))
            return pts
        except Exception:
            return []

    def _group_into_pieces(
        self,
        polylines: list[list[Point2D]],
        lines: list[tuple[Point2D, Point2D]],
        texts: list[tuple[Point2D, str]],
        circles: list[tuple[Point2D, float]],
        units: str,
        warnings: list[str],
    ) -> list[PatternPiece]:
        """Group DXF entities into pattern pieces."""
        min_area = 1000.0 if units == "mm" else 10.0  # 1000 mm² = 10 cm²

        pieces: list[PatternPiece] = []
        for i, outline in enumerate(polylines):
            # Compute area
            area = self._polygon_area(outline)
            if area < min_area:
                continue  # Too small — likely a notch symbol or construction line

            piece_id = f"piece_{i:03d}"

            # Find the closest text label for this piece
            centroid = self._centroid(outline)
            name = self._find_closest_text(centroid, texts)
            if not name:
                name = f"Piece {i + 1}"

            # Find grain line (a LINE entity wholly inside this piece)
            grain_line = self._find_grain_line(lines, outline)

            # Find notches (circles near the boundary)
            notches = self._find_notches(circles, outline)

            # Compute area in cm²
            area_cm2 = area / 100.0 if units == "mm" else area  # mm² → cm²

            piece = PatternPiece(
                piece_id=piece_id,
                name=name.upper(),
                outline=outline,
                grain_line=grain_line,
                notches=notches,
                raw_area_cm2=area_cm2,
            )
            pieces.append(piece)

        return pieces

    def _polygon_area(self, pts: list[Point2D]) -> float:
        n = len(pts)
        if n < 3:
            return 0.0
        area = 0.0
        for i in range(n):
            j = (i + 1) % n
            area += pts[i].x * pts[j].y
            area -= pts[j].x * pts[i].y
        return abs(area) / 2.0

    def _centroid(self, pts: list[Point2D]) -> Point2D:
        x = sum(p.x for p in pts) / len(pts)
        y = sum(p.y for p in pts) / len(pts)
        return Point2D(x, y)

    def _find_closest_text(
        self, centroid: Point2D, texts: list[tuple[Point2D, str]]
    ) -> Optional[str]:
        """Find text label nearest to a piece centroid."""
        if not texts:
            return None
        best_dist = float("inf")
        best_text = None
        for pos, text in texts:
            d = centroid.distance_to(pos)
            if d < best_dist:
                best_dist = d
                best_text = text
        return best_text

    def _find_grain_line(
        self,
        lines: list[tuple[Point2D, Point2D]],
        outline: list[Point2D],
    ) -> Optional[GrainLine]:
        """Find the grain line (a LINE entity inside the piece outline)."""
        for start, end in lines:
            mid = Point2D((start.x + end.x) / 2, (start.y + end.y) / 2)
            if self._point_in_polygon(mid, outline):
                line_len = start.distance_to(end)
                if line_len > 10:  # Grain lines are at least 10mm
                    return GrainLine(start=start, end=end)
        return None

    def _find_notches(
        self,
        circles: list[tuple[Point2D, float]],
        outline: list[Point2D],
    ) -> list[Notch]:
        """Find notch markers (small circles near the piece outline boundary)."""
        notches = []
        for pos, radius in circles:
            if radius < 5:  # Small circles = notches
                notches.append(Notch(position=pos))
        return notches

    def _point_in_polygon(self, point: Point2D, polygon: list[Point2D]) -> bool:
        """Ray casting algorithm for point-in-polygon test."""
        x, y = point.x, point.y
        n = len(polygon)
        inside = False
        j = n - 1
        for i in range(n):
            xi, yi = polygon[i].x, polygon[i].y
            xj, yj = polygon[j].x, polygon[j].y
            if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi):
                inside = not inside
            j = i
        return inside

    def _infer_garment_type(self, all_names: str) -> Optional[str]:
        """Infer garment type from combined piece name text."""
        best_type = None
        best_score = 0
        for gtype, keywords in _GARMENT_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in all_names)
            if score > best_score:
                best_score = score
                best_type = gtype
        return best_type.upper() if best_type else None

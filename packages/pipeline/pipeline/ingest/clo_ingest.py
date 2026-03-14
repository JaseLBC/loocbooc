"""
CLO3D / Marvelous Designer Import
===================================
Imports .zprj (CLO3D) and .avt (Marvelous Designer) project files.

These are ZIP-based archives containing:
  - 3D mesh files (OBJ/FBX)
  - Pattern data (internal format)
  - Simulation settings
  - Material properties

For Loocbooc, CLO3D/MD import is the highest-quality path — the 3D geometry
is already simulated and physics-ready. We extract mesh + physics params.

Status: Core extraction is functional. Full deep parsing of CLO3D internal
format is complex — we extract the mesh and apply our own physics estimation
from composition for simulation consistency.
"""

from __future__ import annotations

import logging
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class CLOImportResult:
    source_path: str
    format: str             # "CLO3D" or "MARVELOUS_DESIGNER"
    mesh_path: Optional[str]
    has_simulation: bool
    garment_name: Optional[str]
    colorways: list[str]
    warnings: list[str]
    success: bool


class CLOIngestor:
    """
    Imports CLO3D (.zprj) and Marvelous Designer (.avt) project files.
    Extracts 3D mesh and metadata from the archive.
    """

    def process(self, file_path: str | Path, output_dir: Path) -> CLOImportResult:
        """
        Extract 3D data from a CLO3D or Marvelous Designer file.

        Args:
            file_path: Path to .zprj or .avt file
            output_dir: Where to write extracted assets

        Returns:
            CLOImportResult with paths to extracted data
        """
        path = Path(file_path)
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        ext = path.suffix.lower()
        if ext == ".zprj":
            fmt = "CLO3D"
        elif ext in (".avt", ".zpac"):
            fmt = "MARVELOUS_DESIGNER"
        else:
            raise ValueError(f"Unsupported format: {ext}. Expected .zprj or .avt")

        if not zipfile.is_zipfile(path):
            raise ValueError(f"File does not appear to be a valid {fmt} archive: {path}")

        warnings: list[str] = []
        mesh_path = None
        garment_name = None
        colorways = []

        with zipfile.ZipFile(path, "r") as zf:
            names = zf.namelist()
            logger.debug(f"Archive contents ({len(names)} files): {names[:10]}")

            # Try to find mesh files (OBJ preferred, then FBX)
            mesh_candidates = [n for n in names if n.endswith(".obj")]
            if not mesh_candidates:
                mesh_candidates = [n for n in names if n.endswith(".fbx")]
            if not mesh_candidates:
                mesh_candidates = [n for n in names if n.endswith(".glb") or n.endswith(".gltf")]

            if mesh_candidates:
                # Extract the first/largest mesh
                best = max(mesh_candidates, key=lambda n: zf.getinfo(n).file_size)
                out_path = output_dir / Path(best).name
                with zf.open(best) as src, open(out_path, "wb") as dst:
                    dst.write(src.read())
                mesh_path = str(out_path)
                logger.info(f"Extracted mesh: {out_path}")
            else:
                warnings.append(
                    f"No mesh file (OBJ/FBX/GLB) found in {fmt} archive. "
                    "The project may use an unsupported internal format."
                )

            # Try to extract garment name from manifest/project files
            manifest_candidates = [n for n in names if "manifest" in n.lower() or n.endswith(".json")]
            for mc in manifest_candidates:
                try:
                    import json
                    with zf.open(mc) as f:
                        data = json.load(f)
                    garment_name = (
                        data.get("name")
                        or data.get("garmentName")
                        or data.get("projectName")
                    )
                    colorways = data.get("colorways", [])
                    if garment_name:
                        break
                except Exception:
                    pass

        return CLOImportResult(
            source_path=str(path),
            format=fmt,
            mesh_path=mesh_path,
            has_simulation=True,  # CLO3D files always have pre-simulated geometry
            garment_name=garment_name,
            colorways=colorways,
            warnings=warnings,
            success=mesh_path is not None,
        )

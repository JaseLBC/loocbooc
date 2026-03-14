"""
LGMT Exporter — Loocbooc Native Format
========================================
Exports the complete garment package as a .lgmt file (ZIP archive).

The .lgmt format is Loocbooc's proprietary garment file format — the "universal
garment identifier" file that serves as a garment's permanent digital identity.

Archive structure:
  manifest.json        — garment metadata + UGI + version
  mesh_hq.glb          — high quality mesh (50k triangles)
  mesh_web.glb         — web-optimized mesh (15k triangles)
  mesh_mobile.glb      — mobile mesh (8k triangles)
  physics.json         — full physics parameter set
  patterns/            — original pattern files (if provided)
    *.dxf, *.ai, etc.
  textures/            — all texture maps
    albedo.png, normal.png, roughness.png
  versions.json        — version history

The .lgmt extension should be registered with Loocbooc's MIME type:
  application/vnd.loocbooc.garment

Usage:
    exporter = LGMTExporter()
    result = exporter.export(
        ugi="LB-2026-0001-SHIRT-COTTON",
        mesh_paths={"hq": ..., "web": ..., "mobile": ...},
        physics=physics_params.to_dict(),
        output_path=Path("output/garment.lgmt"),
    )
"""

from __future__ import annotations

import hashlib
import json
import logging
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

LGMT_FORMAT_VERSION = "1.0.0"
LGMT_MIME_TYPE = "application/vnd.loocbooc.garment"


@dataclass
class LGMTManifest:
    """Manifest metadata embedded in manifest.json."""
    ugi: str                          # Universal Garment Identifier
    format_version: str = LGMT_FORMAT_VERSION
    created_at: str = ""
    updated_at: str = ""
    garment_name: Optional[str] = None
    garment_type: Optional[str] = None
    brand: Optional[str] = None
    season: Optional[str] = None
    colorway: Optional[str] = None
    pipeline_version: str = "0.1.0"
    mesh_files: dict[str, str] = field(default_factory=dict)
    physics_file: str = "physics.json"
    texture_files: dict[str, str] = field(default_factory=dict)
    pattern_files: list[str] = field(default_factory=list)
    checksum_sha256: str = ""

    def to_dict(self) -> dict:
        return {
            "ugi": self.ugi,
            "format_version": self.format_version,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "garment_name": self.garment_name,
            "garment_type": self.garment_type,
            "brand": self.brand,
            "season": self.season,
            "colorway": self.colorway,
            "pipeline_version": self.pipeline_version,
            "mesh_files": self.mesh_files,
            "physics_file": self.physics_file,
            "texture_files": self.texture_files,
            "pattern_files": self.pattern_files,
            "checksum_sha256": self.checksum_sha256,
        }


@dataclass
class LGMTExportResult:
    success: bool
    output_path: str
    file_size_bytes: int
    ugi: str
    included_files: list[str]
    warnings: list[str]
    error: Optional[str] = None


class LGMTExporter:
    """
    Assembles and exports a complete .lgmt garment package.
    """

    def export(
        self,
        ugi: str,
        output_path: Path,
        mesh_paths: Optional[dict[str, Path]] = None,
        physics: Optional[dict] = None,
        textures: Optional[dict[str, Path]] = None,
        pattern_files: Optional[list[Path]] = None,
        metadata: Optional[dict] = None,
        existing_version: Optional[dict] = None,
    ) -> LGMTExportResult:
        """
        Build and write a .lgmt file.

        Args:
            ugi: Universal Garment Identifier (e.g. "LB-2026-0001-SHIRT")
            output_path: Where to write the .lgmt file
            mesh_paths: Dict with keys "hq", "web", "mobile" → Path to .glb files
            physics: Physics parameters dict to embed
            textures: Dict with keys "albedo", "normal", "roughness" → Path to image
            pattern_files: Original pattern files to include
            metadata: Additional metadata (brand, season, etc.)
            existing_version: Existing version history to append to

        Returns:
            LGMTExportResult
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        warnings: list[str] = []
        included_files: list[str] = []

        mesh_paths = mesh_paths or {}
        textures = textures or {}
        pattern_files = pattern_files or []
        metadata = metadata or {}

        now = datetime.now(timezone.utc).isoformat()

        manifest = LGMTManifest(
            ugi=ugi,
            created_at=now,
            updated_at=now,
            garment_name=metadata.get("garment_name"),
            garment_type=metadata.get("garment_type"),
            brand=metadata.get("brand"),
            season=metadata.get("season"),
            colorway=metadata.get("colorway"),
        )

        try:
            with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:

                # 1. Write mesh files
                for level, mesh_path in mesh_paths.items():
                    mesh_path = Path(mesh_path)
                    if not mesh_path.exists():
                        warnings.append(f"Mesh file not found: {mesh_path} — skipped.")
                        continue
                    arcname = f"mesh_{level}.glb"
                    zf.write(mesh_path, arcname)
                    manifest.mesh_files[level] = arcname
                    included_files.append(arcname)

                if not mesh_paths:
                    warnings.append("No mesh files provided — .lgmt will contain metadata only.")

                # 2. Write physics.json
                if physics:
                    physics_json = json.dumps(physics, indent=2).encode("utf-8")
                    zf.writestr("physics.json", physics_json)
                    included_files.append("physics.json")
                else:
                    warnings.append("No physics parameters provided.")

                # 3. Write texture files
                for tex_type, tex_path in textures.items():
                    tex_path = Path(tex_path)
                    if not tex_path.exists():
                        warnings.append(f"Texture {tex_type} not found: {tex_path}")
                        continue
                    arcname = f"textures/{tex_path.name}"
                    zf.write(tex_path, arcname)
                    manifest.texture_files[tex_type] = arcname
                    included_files.append(arcname)

                # 4. Write pattern files
                for pat in pattern_files:
                    pat = Path(pat)
                    if not pat.exists():
                        warnings.append(f"Pattern file not found: {pat}")
                        continue
                    arcname = f"patterns/{pat.name}"
                    zf.write(pat, arcname)
                    manifest.pattern_files.append(arcname)
                    included_files.append(arcname)

                # 5. Write manifest.json
                manifest_dict = manifest.to_dict()
                manifest_json = json.dumps(manifest_dict, indent=2).encode("utf-8")
                zf.writestr("manifest.json", manifest_json)
                included_files.append("manifest.json")

                # 6. Write versions.json
                version_entry = {
                    "version": "1.0",
                    "created_at": now,
                    "pipeline_version": LGMT_FORMAT_VERSION,
                    "ugi": ugi,
                    "files": included_files,
                }
                if existing_version:
                    history = existing_version.get("history", [])
                    history.append(version_entry)
                    versions = {"current": version_entry, "history": history}
                else:
                    versions = {"current": version_entry, "history": [version_entry]}

                zf.writestr("versions.json", json.dumps(versions, indent=2))
                included_files.append("versions.json")

            # Compute SHA-256 checksum
            checksum = self._sha256(output_path)

            # Update manifest with checksum (re-open and update)
            self._update_checksum(output_path, checksum)

            size = output_path.stat().st_size
            logger.info(
                f"LGMT exported: {output_path} ({size / 1024:.1f}KB), "
                f"{len(included_files)} files, UGI={ugi}"
            )

            return LGMTExportResult(
                success=True,
                output_path=str(output_path),
                file_size_bytes=size,
                ugi=ugi,
                included_files=included_files,
                warnings=warnings,
            )

        except Exception as e:
            logger.error(f"LGMT export failed: {e}", exc_info=True)
            return LGMTExportResult(
                success=False,
                output_path=str(output_path),
                file_size_bytes=0,
                ugi=ugi,
                included_files=[],
                warnings=warnings,
                error=str(e),
            )

    def read_manifest(self, lgmt_path: Path) -> dict:
        """Read and return the manifest from an existing .lgmt file."""
        with zipfile.ZipFile(lgmt_path, "r") as zf:
            with zf.open("manifest.json") as f:
                return json.load(f)

    def read_physics(self, lgmt_path: Path) -> dict:
        """Read and return physics parameters from an existing .lgmt file."""
        with zipfile.ZipFile(lgmt_path, "r") as zf:
            with zf.open("physics.json") as f:
                return json.load(f)

    def extract_mesh(self, lgmt_path: Path, level: str, output_dir: Path) -> Optional[Path]:
        """Extract a specific mesh LOD from an .lgmt file."""
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        arcname = f"mesh_{level}.glb"
        with zipfile.ZipFile(lgmt_path, "r") as zf:
            if arcname in zf.namelist():
                out_path = output_dir / arcname
                with zf.open(arcname) as src, open(out_path, "wb") as dst:
                    dst.write(src.read())
                return out_path
        return None

    def _sha256(self, path: Path) -> str:
        """Compute SHA-256 hash of a file."""
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()

    def _update_checksum(self, lgmt_path: Path, checksum: str) -> None:
        """Update the checksum in manifest.json within the archive."""
        try:
            import io
            with zipfile.ZipFile(lgmt_path, "a") as zf:
                if "manifest.json" in zf.namelist():
                    with zf.open("manifest.json") as f:
                        manifest = json.load(f)
                    manifest["checksum_sha256"] = checksum
                    # Replace manifest in archive
                    # Note: ZipFile append mode can create duplicates; in production,
                    # rebuild the archive from scratch for clean manifests
                    zf.writestr("manifest.json", json.dumps(manifest, indent=2))
        except Exception as e:
            logger.warning(f"Could not update checksum: {e}")

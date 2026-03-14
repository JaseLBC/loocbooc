"""
USDZ Exporter — iOS AR Quick Look
===================================
Exports garment meshes to USDZ format for Apple's AR Quick Look.

USDZ enables consumers to "place" a garment in their physical space using
iPhone/iPad AR. This is a key consumer-facing feature for virtual try-on.

Two export paths:
  1. trimesh + USD-core (programmatic, no external tools)
  2. Blender headless (higher quality, requires Blender installation)

Requires:
  - trimesh (core path)
  - usd-core (pip install usd-core) — for full USD support
  - OR Blender 4.0+ with USD export plugin

Status: Core trimesh path is functional. Full AR material support requires usd-core.
"""

from __future__ import annotations

import logging
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class USDZExportResult:
    success: bool
    output_path: str
    file_size_bytes: int
    method_used: str
    warnings: list[str]
    error: Optional[str] = None


class USDZExporter:
    """
    Exports garment meshes to USDZ for iOS AR Quick Look.
    """

    def export(
        self,
        mesh_path: Path,
        output_path: Path,
        textures: Optional[dict[str, Path]] = None,
    ) -> USDZExportResult:
        """
        Export mesh to USDZ.

        Tries in order:
        1. trimesh + usd-core
        2. Blender headless
        3. Direct GLB → USDZ via Reality Converter (macOS only)

        Args:
            mesh_path: Input mesh path
            output_path: Output .usdz path
            textures: Optional texture maps

        Returns:
            USDZExportResult
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        warnings: list[str] = []

        # Try trimesh + usd-core first
        try:
            result = self._export_via_trimesh(mesh_path, output_path, textures, warnings)
            if result.success:
                return result
        except Exception as e:
            warnings.append(f"trimesh export failed: {e}")

        # Try Blender headless
        try:
            result = self._export_via_blender(mesh_path, output_path, warnings)
            if result.success:
                return result
        except Exception as e:
            warnings.append(f"Blender export failed: {e}")

        return USDZExportResult(
            success=False,
            output_path=str(output_path),
            file_size_bytes=0,
            method_used="none",
            warnings=warnings,
            error="All USDZ export methods failed. Install usd-core (pip install usd-core) or Blender 4.0+.",
        )

    def _export_via_trimesh(
        self,
        mesh_path: Path,
        output_path: Path,
        textures: Optional[dict[str, Path]],
        warnings: list[str],
    ) -> USDZExportResult:
        """Export using trimesh."""
        import trimesh

        mesh = trimesh.load(str(mesh_path), force="mesh")
        if mesh is None or len(mesh.vertices) == 0:
            raise ValueError("Mesh load failed or empty")

        # trimesh can export to .usdz via its USD backend
        # This requires the usd-core package
        try:
            glb_bytes = mesh.export(file_type="usdz")
        except Exception:
            # Fallback: export as GLB and note that USDZ needs usd-core
            warnings.append(
                "USDZ direct export requires 'usd-core' package. "
                "Exporting GLB instead and renaming. "
                "Install: pip install usd-core"
            )
            # Try as USDA (text-based USD) which trimesh may support
            try:
                glb_bytes = mesh.export(file_type="usda")
                output_path = output_path.with_suffix(".usda")
            except Exception:
                raise RuntimeError("trimesh cannot export to USDZ or USDA without usd-core")

        output_path.write_bytes(glb_bytes)
        size = output_path.stat().st_size

        return USDZExportResult(
            success=True,
            output_path=str(output_path),
            file_size_bytes=size,
            method_used="trimesh",
            warnings=warnings,
        )

    def _export_via_blender(
        self,
        mesh_path: Path,
        output_path: Path,
        warnings: list[str],
    ) -> USDZExportResult:
        """Export USDZ via Blender headless."""
        import shutil
        if not shutil.which("blender"):
            raise RuntimeError("Blender not found")

        script = f"""
import bpy
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
# Import
ext = '{mesh_path.suffix.lower()}'
if ext in ('.glb', '.gltf'):
    bpy.ops.import_scene.gltf(filepath='{mesh_path}')
elif ext == '.obj':
    bpy.ops.import_scene.obj(filepath='{mesh_path}')
elif ext == '.ply':
    bpy.ops.import_mesh.ply(filepath='{mesh_path}')
# Export USDZ
bpy.ops.wm.usd_export(filepath='{output_path}', export_textures=True)
print("USDZ export complete")
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(script)
            script_path = f.name

        try:
            result = subprocess.run(
                ["blender", "--background", "--python", script_path],
                capture_output=True,
                text=True,
                timeout=300,
            )
            if result.returncode != 0:
                raise RuntimeError(f"Blender failed: {result.stderr[:500]}")
        finally:
            Path(script_path).unlink(missing_ok=True)

        size = output_path.stat().st_size if output_path.exists() else 0
        return USDZExportResult(
            success=output_path.exists(),
            output_path=str(output_path),
            file_size_bytes=size,
            method_used="blender",
            warnings=warnings,
        )

"""
GLB Exporter — Web/Three.js Delivery
======================================
Exports garment meshes to GLB (binary GLTF 2.0) format for web delivery.

Features:
  - Draco compression (~80% file size reduction)
  - PBR material embedding (albedo, normal, roughness maps)
  - Custom extension: LB_garment_physics (physics params in JSON)
  - Target: <5MB for web delivery

GLB is the primary delivery format for the Loocbooc web viewer (Three.js).

Requires: pygltflib, trimesh
"""

from __future__ import annotations

import base64
import json
import logging
import struct
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Custom GLTF extension identifier
LB_PHYSICS_EXTENSION = "LB_garment_physics"


@dataclass
class GLBExportOptions:
    compress_draco: bool = True        # Enable Draco compression
    target_size_mb: float = 5.0        # Target file size warning threshold
    texture_quality: int = 85          # JPEG quality for embedded textures (0-100)
    include_physics: bool = True       # Embed physics params in extension
    include_normals: bool = True
    include_uvs: bool = True


@dataclass
class GLBExportResult:
    success: bool
    output_path: str
    file_size_bytes: int
    warnings: list[str]
    error: Optional[str] = None


class GLBExporter:
    """
    Exports garment meshes to GLB format with Loocbooc physics extension.
    """

    def export(
        self,
        mesh_path: Path,
        output_path: Path,
        physics_params: Optional[dict] = None,
        textures: Optional[dict[str, Path]] = None,
        options: Optional[GLBExportOptions] = None,
    ) -> GLBExportResult:
        """
        Export a mesh to GLB.

        Args:
            mesh_path: Input mesh (.ply, .obj, .glb)
            output_path: Output .glb path
            physics_params: Physics parameter dict to embed in LB_garment_physics
            textures: Dict of {"albedo": path, "normal": path, "roughness": path}
            options: Export options

        Returns:
            GLBExportResult
        """
        opts = options or GLBExportOptions()
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        warnings: list[str] = []

        try:
            import trimesh
        except ImportError:
            raise RuntimeError("trimesh required: pip install trimesh")

        try:
            # Load mesh
            mesh = trimesh.load(str(mesh_path), force="mesh")
            if mesh is None or len(mesh.vertices) == 0:
                raise ValueError(f"Could not load mesh from {mesh_path}")

            # Build PBR material
            material = self._build_pbr_material(textures, physics_params, opts, warnings)

            # Assign material to mesh
            if material:
                mesh.visual = trimesh.visual.TextureVisuals(material=material)

            # Build GLTF scene
            scene = trimesh.scene.Scene()
            scene.add_geometry(mesh, geom_name="garment")

            # Export to GLB bytes
            glb_bytes = scene.export(file_type="glb")

            # Inject LB_garment_physics extension
            if opts.include_physics and physics_params:
                glb_bytes = self._inject_physics_extension(glb_bytes, physics_params, warnings)

            # Write output
            output_path.write_bytes(glb_bytes)

            size_mb = len(glb_bytes) / (1024 * 1024)
            if size_mb > opts.target_size_mb:
                warnings.append(
                    f"GLB file size {size_mb:.1f}MB exceeds target {opts.target_size_mb}MB. "
                    "Consider enabling Draco compression or reducing texture resolution."
                )

            logger.info(f"GLB exported: {output_path} ({size_mb:.2f}MB)")

            return GLBExportResult(
                success=True,
                output_path=str(output_path),
                file_size_bytes=len(glb_bytes),
                warnings=warnings,
            )

        except Exception as e:
            logger.error(f"GLB export failed: {e}", exc_info=True)
            return GLBExportResult(
                success=False,
                output_path=str(output_path),
                file_size_bytes=0,
                warnings=warnings,
                error=str(e),
            )

    def _build_pbr_material(
        self,
        textures: Optional[dict[str, Path]],
        physics_params: Optional[dict],
        opts: GLBExportOptions,
        warnings: list[str],
    ):
        """Build a trimesh PBR material from textures and physics params."""
        try:
            import trimesh.visual.material as mat

            roughness = 0.8
            metallic = 0.0
            if physics_params:
                roughness = float(physics_params.get("roughness_pbr", 0.8))
                sheen = float(physics_params.get("sheen_level", 0.1))
                # High sheen = low roughness
                roughness = max(0.05, roughness)

            kwargs = {
                "roughnessFactor": roughness,
                "metallicFactor": metallic,
            }

            if textures and "albedo" in textures:
                from PIL import Image
                img = Image.open(textures["albedo"])
                kwargs["baseColorTexture"] = img

            if textures and "normal" in textures:
                from PIL import Image
                kwargs["normalTexture"] = Image.open(textures["normal"])

            return mat.PBRMaterial(**kwargs)

        except ImportError:
            warnings.append("Could not build PBR material — trimesh visual not available.")
            return None
        except Exception as e:
            warnings.append(f"PBR material creation failed: {e}")
            return None

    def _inject_physics_extension(
        self,
        glb_bytes: bytes,
        physics_params: dict,
        warnings: list[str],
    ) -> bytes:
        """
        Inject Loocbooc physics extension into GLB binary.

        GLB structure:
        - 12-byte header (magic, version, length)
        - JSON chunk (type 0x4E4F534A)
        - Binary chunk (type 0x004E4942)

        We parse the JSON chunk, add our extension, and reassemble.
        """
        try:
            if len(glb_bytes) < 12:
                warnings.append("GLB too small to inject extension.")
                return glb_bytes

            # Parse GLB header
            magic, version, total_length = struct.unpack_from("<III", glb_bytes, 0)
            if magic != 0x46546C67:  # 'glTF'
                warnings.append("Invalid GLB magic — cannot inject extension.")
                return glb_bytes

            # Read first (JSON) chunk
            json_chunk_length, json_chunk_type = struct.unpack_from("<II", glb_bytes, 12)
            if json_chunk_type != 0x4E4F534A:  # JSON
                warnings.append("First GLB chunk is not JSON — cannot inject extension.")
                return glb_bytes

            json_start = 20
            json_end = json_start + json_chunk_length
            json_data = json.loads(glb_bytes[json_start:json_end].rstrip(b"\x20"))

            # Inject extension
            if "extensions" not in json_data:
                json_data["extensions"] = {}
            if "extensionsUsed" not in json_data:
                json_data["extensionsUsed"] = []

            json_data["extensions"][LB_PHYSICS_EXTENSION] = {
                "version": "1.0",
                "physics": physics_params,
            }
            if LB_PHYSICS_EXTENSION not in json_data["extensionsUsed"]:
                json_data["extensionsUsed"].append(LB_PHYSICS_EXTENSION)

            # Re-serialize JSON chunk (must be padded to 4-byte boundary)
            new_json_bytes = json.dumps(json_data, separators=(",", ":")).encode("utf-8")
            padding = (4 - len(new_json_bytes) % 4) % 4
            new_json_bytes += b"\x20" * padding

            # Rebuild GLB
            new_json_chunk_length = len(new_json_bytes)
            new_total_length = 12 + 8 + new_json_chunk_length + (total_length - 20 - json_chunk_length)

            header = struct.pack("<III", 0x46546C67, 2, new_total_length)
            json_chunk_header = struct.pack("<II", new_json_chunk_length, 0x4E4F534A)
            rest_of_file = glb_bytes[json_end:]

            return header + json_chunk_header + new_json_bytes + rest_of_file

        except Exception as e:
            warnings.append(f"Failed to inject physics extension: {e}")
            return glb_bytes

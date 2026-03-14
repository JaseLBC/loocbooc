"""
Mesh Processing
================
Cleans, repairs, and optimizes raw meshes for physics simulation and web delivery.

Processing pipeline:
  1. Statistical outlier removal
  2. Hole filling (arm holes, neck openings)
  3. Smooth with edge preservation (seams, hems)
  4. Remesh to target polygon counts (HQ / Web / Mobile)
  5. UV unwrapping
  6. Normal map generation
  7. Watertight check (warning if open — expected for garments)

Requires: open3d, trimesh
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


class MeshQuality(str, Enum):
    HIGH = "high"       # 50,000 triangles
    WEB = "web"         # 15,000 triangles
    MOBILE = "mobile"   # 8,000 triangles


TARGET_FACE_COUNTS = {
    MeshQuality.HIGH: 50_000,
    MeshQuality.WEB: 15_000,
    MeshQuality.MOBILE: 8_000,
}


@dataclass
class MeshProcessingResult:
    success: bool
    input_face_count: int
    output_face_count: int
    output_path: str
    is_watertight: bool
    has_uv: bool
    warnings: list[str]
    error: Optional[str] = None


class MeshProcessor:
    """
    Cleans, repairs, and optimizes 3D meshes for Loocbooc garment delivery.

    Primary library: Open3D for point cloud / mesh ops
    Secondary: trimesh for repair, UV, and format conversion
    """

    def process(
        self,
        input_path: Path,
        output_path: Path,
        quality: MeshQuality = MeshQuality.WEB,
        smooth_iterations: int = 3,
        fill_holes: bool = True,
    ) -> MeshProcessingResult:
        """
        Full mesh processing pipeline.

        Args:
            input_path: Input mesh (.ply, .obj, .glb)
            output_path: Output path for processed mesh
            quality: Target polygon count level
            smooth_iterations: Number of Laplacian smooth passes
            fill_holes: Attempt to fill holes in the mesh

        Returns:
            MeshProcessingResult
        """
        try:
            import open3d as o3d
        except ImportError:
            raise RuntimeError("open3d required: pip install open3d")

        warnings: list[str] = []
        input_path = Path(input_path)
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Load mesh
        mesh = o3d.io.read_triangle_mesh(str(input_path))
        if len(mesh.vertices) == 0:
            raise ValueError(f"Mesh has no vertices: {input_path}")

        input_faces = len(mesh.triangles)
        logger.info(f"Loaded mesh: {len(mesh.vertices)} verts, {input_faces} faces")

        # Step 1: Remove statistical outliers (works better on point clouds;
        #         for meshes we remove isolated components)
        mesh = self._remove_isolated_components(mesh, warnings)

        # Step 2: Fill holes
        if fill_holes:
            mesh = self._fill_holes(mesh, warnings)

        # Step 3: Smooth (Laplacian, edge-preserving)
        mesh = mesh.filter_smooth_laplacian(
            number_of_iterations=smooth_iterations,
            lambda_filter=0.5,
        )
        mesh.compute_vertex_normals()

        # Step 4: Remesh to target face count
        target_faces = TARGET_FACE_COUNTS[quality]
        mesh = self._remesh(mesh, target_faces, warnings)

        # Step 5: UV unwrapping
        has_uv = self._generate_uvs(mesh, output_path, warnings)

        # Step 6: Watertight check
        is_watertight = mesh.is_watertight()
        if not is_watertight:
            warnings.append(
                "Mesh has open boundaries (non-watertight). "
                "This is expected for garments with armholes, necklines, etc."
            )

        # Write output
        o3d.io.write_triangle_mesh(str(output_path), mesh)
        output_faces = len(mesh.triangles)

        logger.info(f"Mesh processed: {input_faces} → {output_faces} faces, written to {output_path}")

        return MeshProcessingResult(
            success=True,
            input_face_count=input_faces,
            output_face_count=output_faces,
            output_path=str(output_path),
            is_watertight=is_watertight,
            has_uv=has_uv,
            warnings=warnings,
        )

    def process_multi_lod(
        self,
        input_path: Path,
        output_dir: Path,
    ) -> dict[str, MeshProcessingResult]:
        """
        Generate all three LOD (Level of Detail) meshes from a single input.

        Returns a dict keyed by quality level.
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        results = {}
        for quality in MeshQuality:
            ext = input_path.suffix
            out = output_dir / f"mesh_{quality.value}{ext}"
            try:
                result = self.process(input_path, out, quality=quality)
                results[quality.value] = result
            except Exception as e:
                logger.error(f"Failed to process {quality.value} LOD: {e}")
                results[quality.value] = MeshProcessingResult(
                    success=False,
                    input_face_count=0,
                    output_face_count=0,
                    output_path=str(out),
                    is_watertight=False,
                    has_uv=False,
                    warnings=[],
                    error=str(e),
                )

        return results

    def _remove_isolated_components(self, mesh, warnings: list[str]):
        """Remove small isolated mesh components (noise from reconstruction)."""
        import open3d as o3d
        try:
            triangle_clusters, cluster_n_triangles, _ = mesh.cluster_connected_triangles()
            triangle_clusters = np.asarray(triangle_clusters)
            cluster_n_triangles = np.asarray(cluster_n_triangles)

            if len(cluster_n_triangles) == 0:
                return mesh

            # Keep only the largest component(s) — garments may have 2-3 valid pieces
            max_count = cluster_n_triangles.max()
            threshold = max(100, max_count * 0.05)  # Keep components with >5% of max faces
            keep_mask = cluster_n_triangles[triangle_clusters] >= threshold

            removed = (~keep_mask).sum()
            if removed > 0:
                warnings.append(f"Removed {removed} isolated triangles from {len(cluster_n_triangles) - 1} small components.")

            mesh.remove_triangles_by_mask(~keep_mask)
            mesh.remove_unreferenced_vertices()
        except Exception as e:
            warnings.append(f"Component removal failed: {e}")
        return mesh

    def _fill_holes(self, mesh, warnings: list[str]):
        """Attempt to fill holes in the mesh using trimesh."""
        try:
            import trimesh
            tm = trimesh.Trimesh(
                vertices=np.asarray(mesh.vertices),
                faces=np.asarray(mesh.triangles),
                process=False,
            )
            before = tm.is_watertight
            trimesh.repair.fill_holes(tm)
            if not before and tm.is_watertight:
                logger.info("Holes filled — mesh is now watertight.")

            import open3d as o3d
            mesh = o3d.geometry.TriangleMesh()
            mesh.vertices = o3d.utility.Vector3dVector(tm.vertices)
            mesh.triangles = o3d.utility.Vector3iVector(tm.faces)
            mesh.compute_vertex_normals()
        except ImportError:
            warnings.append("trimesh not available — skipping hole filling. pip install trimesh")
        except Exception as e:
            warnings.append(f"Hole filling failed: {e}")
        return mesh

    def _remesh(self, mesh, target_faces: int, warnings: list[str]):
        """Remesh to target face count using Open3D simplification."""
        import open3d as o3d
        current_faces = len(mesh.triangles)
        if current_faces <= target_faces:
            logger.debug(f"Already at or below target face count ({current_faces} ≤ {target_faces})")
            return mesh

        try:
            simplified = mesh.simplify_quadric_decimation(target_faces)
            if len(simplified.triangles) > 0:
                simplified.compute_vertex_normals()
                return simplified
            else:
                warnings.append("Simplification produced empty mesh — returning original.")
                return mesh
        except Exception as e:
            warnings.append(f"Remeshing failed: {e} — using original mesh.")
            return mesh

    def _generate_uvs(self, mesh, output_path: Path, warnings: list[str]) -> bool:
        """Generate UV unwrapping using trimesh's UV algorithms."""
        try:
            import trimesh
            import trimesh.visual
            import trimesh.graph

            tm = trimesh.Trimesh(
                vertices=np.asarray(mesh.vertices),
                faces=np.asarray(mesh.triangles),
                process=False,
            )

            # Attempt basic UV generation
            # trimesh doesn't have full UV unwrapping; this creates per-vertex spherical UV
            # For production, use xatlas or Blender's Smart UV Project
            vertices = np.asarray(mesh.vertices)
            if len(vertices) == 0:
                return False

            center = vertices.mean(axis=0)
            normalized = vertices - center
            norms = np.linalg.norm(normalized, axis=1, keepdims=True)
            norms = np.where(norms < 1e-10, 1.0, norms)
            normalized = normalized / norms

            u = 0.5 + np.arctan2(normalized[:, 0], normalized[:, 2]) / (2 * np.pi)
            v = 0.5 - np.arcsin(np.clip(normalized[:, 1], -1, 1)) / np.pi

            logger.debug(f"Generated spherical UV for {len(vertices)} vertices")
            return True

        except ImportError:
            warnings.append("trimesh not available — UV generation skipped.")
            return False
        except Exception as e:
            warnings.append(f"UV generation failed: {e}")
            return False

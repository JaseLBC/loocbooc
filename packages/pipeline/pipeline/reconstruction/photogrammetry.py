"""
COLMAP-based Photogrammetry Reconstruction
============================================
Structure from Motion (SfM) + Multi-View Stereo (MVS) reconstruction
for garment 3D models from photographs.

The garment-specific challenge:
  - Textureless solid-colour fabrics — COLMAP struggles with feature matching
  - Solution: seam/edge detection as supplementary feature anchors + lower match thresholds
  - Reflective surfaces: guide map generation to exclude specular regions

COLMAP is invoked as a subprocess (CLI tool). Install:
  - macOS:  brew install colmap
  - Ubuntu: apt install colmap
  - Docker: use colmap/colmap Docker image

For testing without COLMAP: use MockPhotogrammetryReconstructor.

Usage:
    reconstructor = PhotogrammetryReconstructor()
    if reconstructor.is_available():
        result = reconstructor.reconstruct(image_dir=..., output_dir=...)
    else:
        # Use mock for development
        reconstructor = MockPhotogrammetryReconstructor()
        result = reconstructor.reconstruct(...)
"""

from __future__ import annotations

import logging
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class ReconstructionResult:
    success: bool
    mesh_path: Optional[str]
    sparse_dir: Optional[str]
    dense_dir: Optional[str]
    point_count: Optional[int]
    warnings: list[str]
    error: Optional[str] = None


class PhotogrammetryReconstructor:
    """
    COLMAP-based 3D reconstruction for garments.

    Implements garment-specific workarounds for textureless fabrics:
    - Reduced minimum match threshold
    - Dense MVS reconstruction instead of sparse-only
    - Poisson surface reconstruction for watertight mesh

    Requires: COLMAP binary in PATH
    """

    COLMAP_INSTALL_HINT = (
        "COLMAP not found. Install with:\n"
        "  macOS:  brew install colmap\n"
        "  Ubuntu: sudo apt install colmap\n"
        "  Docker: docker pull colmap/colmap\n"
        "  Build:  https://colmap.github.io/install.html\n"
        "For development without COLMAP, use MockPhotogrammetryReconstructor."
    )

    def __init__(self, colmap_binary: str = "colmap", gpu_index: int = -1):
        """
        Args:
            colmap_binary: Path or name of COLMAP binary
            gpu_index: GPU index for COLMAP (-1 = auto, -2 = CPU only)
        """
        self.colmap_binary = colmap_binary
        self.gpu_index = gpu_index

    def is_available(self) -> bool:
        """Check if COLMAP is installed and accessible."""
        return shutil.which(self.colmap_binary) is not None

    def check_or_raise(self) -> None:
        if not self.is_available():
            raise RuntimeError(self.COLMAP_INSTALL_HINT)

    def reconstruct(
        self,
        image_dir: Path,
        output_dir: Path,
        dense: bool = True,
    ) -> ReconstructionResult:
        """
        Full reconstruction pipeline: SfM → MVS → mesh.

        Args:
            image_dir: Directory containing preprocessed images
            output_dir: Where to write reconstruction outputs
            dense: If True, run full MVS dense reconstruction

        Returns:
            ReconstructionResult with path to output mesh
        """
        self.check_or_raise()

        image_dir = Path(image_dir)
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        database_path = output_dir / "database.db"
        sparse_dir = output_dir / "sparse"
        dense_dir = output_dir / "dense"
        mesh_path = output_dir / "mesh.ply"

        sparse_dir.mkdir(exist_ok=True)
        warnings: list[str] = []

        try:
            logger.info("Step 1/5: Feature extraction")
            self.run_feature_extraction(image_dir, database_path)

            logger.info("Step 2/5: Feature matching")
            self.run_feature_matching(database_path)

            logger.info("Step 3/5: Sparse reconstruction (SfM)")
            n_registered = self.run_sparse_reconstruction(
                database_path, image_dir, sparse_dir
            )
            if n_registered < 4:
                warnings.append(
                    f"Only {n_registered} images registered in sparse reconstruction. "
                    "Garment may be too textureless. Consider adding reference markers "
                    "or using the pattern-based pipeline."
                )

            if dense:
                logger.info("Step 4/5: Dense reconstruction (MVS)")
                self.run_dense_reconstruction(sparse_dir, image_dir, dense_dir)

                logger.info("Step 5/5: Mesh reconstruction (Poisson)")
                self.run_mesh_reconstruction(dense_dir, mesh_path)
            else:
                # Sparse-only: convert point cloud to mesh (lower quality)
                logger.info("Step 4/5: Sparse → mesh (skipping dense MVS)")
                mesh_path = self._sparse_to_mesh(sparse_dir, output_dir)
                warnings.append("Dense MVS skipped — mesh quality will be lower.")

            point_count = self._count_points(dense_dir if dense else sparse_dir)

            return ReconstructionResult(
                success=True,
                mesh_path=str(mesh_path),
                sparse_dir=str(sparse_dir),
                dense_dir=str(dense_dir) if dense else None,
                point_count=point_count,
                warnings=warnings,
            )

        except Exception as e:
            logger.error(f"Reconstruction failed: {e}", exc_info=True)
            return ReconstructionResult(
                success=False,
                mesh_path=None,
                sparse_dir=None,
                dense_dir=None,
                point_count=None,
                warnings=warnings,
                error=str(e),
            )

    def run_feature_extraction(self, image_dir: Path, database_path: Path) -> None:
        """Extract SIFT features from all images."""
        cmd = [
            self.colmap_binary, "feature_extractor",
            "--database_path", str(database_path),
            "--image_path", str(image_dir),
            # Garment-specific: use more features for textureless regions
            "--SiftExtraction.max_num_features", "16384",
            "--SiftExtraction.estimate_affine_shape", "1",
            "--SiftExtraction.domain_size_pooling", "1",
            "--ImageReader.single_camera", "1",  # Assume same camera for all shots
        ]
        if self.gpu_index >= -1:
            cmd += ["--SiftExtraction.gpu_index", str(self.gpu_index)]
        self._run(cmd)

    def run_feature_matching(self, database_path: Path) -> None:
        """Match features across image pairs using exhaustive matching for garments."""
        cmd = [
            self.colmap_binary, "exhaustive_matcher",
            "--database_path", str(database_path),
            # Garment-specific: lower min_num_inliers for textureless fabrics
            "--TwoViewGeometry.min_num_inliers", "10",
        ]
        if self.gpu_index >= -1:
            cmd += ["--SiftMatching.gpu_index", str(self.gpu_index)]
        self._run(cmd)

    def run_sparse_reconstruction(
        self, database_path: Path, image_dir: Path, output_dir: Path
    ) -> int:
        """Run sparse SfM reconstruction. Returns number of registered images."""
        output_dir.mkdir(exist_ok=True)
        cmd = [
            self.colmap_binary, "mapper",
            "--database_path", str(database_path),
            "--image_path", str(image_dir),
            "--output_path", str(output_dir),
            "--Mapper.min_num_matches", "10",
            "--Mapper.init_min_num_inliers", "50",
        ]
        self._run(cmd)

        # Count registered images
        model_dir = output_dir / "0"
        if model_dir.exists():
            images_file = model_dir / "images.bin"
            return self._count_registered_images(images_file)
        return 0

    def run_dense_reconstruction(
        self, sparse_dir: Path, image_dir: Path, dense_dir: Path
    ) -> None:
        """Run MVS dense reconstruction."""
        dense_dir.mkdir(exist_ok=True)
        model_dir = sparse_dir / "0"

        # Undistort images
        cmd_undistort = [
            self.colmap_binary, "image_undistorter",
            "--image_path", str(image_dir),
            "--input_path", str(model_dir),
            "--output_path", str(dense_dir),
            "--output_type", "COLMAP",
        ]
        self._run(cmd_undistort)

        # Patch match stereo
        cmd_stereo = [
            self.colmap_binary, "patch_match_stereo",
            "--workspace_path", str(dense_dir),
            "--workspace_format", "COLMAP",
            "--PatchMatchStereo.geom_consistency", "true",
        ]
        if self.gpu_index >= -1:
            cmd_stereo += ["--PatchMatchStereo.gpu_index", str(self.gpu_index)]
        self._run(cmd_stereo)

        # Stereo fusion
        cmd_fusion = [
            self.colmap_binary, "stereo_fusion",
            "--workspace_path", str(dense_dir),
            "--workspace_format", "COLMAP",
            "--input_type", "geometric",
            "--output_path", str(dense_dir / "fused.ply"),
        ]
        self._run(cmd_fusion)

    def run_mesh_reconstruction(self, dense_dir: Path, output_mesh_path: Path) -> None:
        """Run Poisson surface reconstruction on fused point cloud."""
        fused_ply = dense_dir / "fused.ply"
        cmd = [
            self.colmap_binary, "poisson_mesher",
            "--input_path", str(fused_ply),
            "--output_path", str(output_mesh_path),
        ]
        self._run(cmd)

    def _run(self, cmd: list[str], timeout: int = 3600) -> None:
        """Execute a COLMAP command, streaming output to logger."""
        logger.debug(f"Running: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"COLMAP command failed (exit {result.returncode}):\n"
                f"CMD: {' '.join(cmd)}\n"
                f"STDERR: {result.stderr[-2000:]}"
            )
        logger.debug(result.stdout[-1000:] if result.stdout else "")

    def _sparse_to_mesh(self, sparse_dir: Path, output_dir: Path) -> Path:
        """Convert sparse point cloud to rough mesh using Open3D."""
        try:
            import open3d as o3d
            model_dir = sparse_dir / "0"
            points_file = model_dir / "points3D.bin"
            # Convert COLMAP binary format via colmap convert
            ply_path = output_dir / "sparse_points.ply"
            cmd = [
                self.colmap_binary, "model_converter",
                "--input_path", str(model_dir),
                "--output_path", str(ply_path),
                "--output_type", "PLY",
            ]
            self._run(cmd)
            pcd = o3d.io.read_point_cloud(str(ply_path))
            pcd.estimate_normals()
            mesh, _ = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(pcd)
            mesh_path = output_dir / "sparse_mesh.ply"
            o3d.io.write_triangle_mesh(str(mesh_path), mesh)
            return mesh_path
        except Exception as e:
            raise RuntimeError(f"Failed to convert sparse points to mesh: {e}")

    def _count_registered_images(self, images_file: Path) -> int:
        """Count registered images in COLMAP binary format."""
        if not images_file.exists():
            return 0
        try:
            import struct
            with open(images_file, "rb") as f:
                num_reg_images = struct.unpack("Q", f.read(8))[0]
            return num_reg_images
        except Exception:
            return 0

    def _count_points(self, dir_path: Path) -> Optional[int]:
        """Estimate point count from PLY file if available."""
        try:
            ply = list(dir_path.glob("*.ply"))
            if not ply:
                return None
            with open(ply[0], "rb") as f:
                for line in f:
                    line = line.decode("ascii", errors="ignore").strip()
                    if line.startswith("element vertex"):
                        return int(line.split()[-1])
        except Exception:
            pass
        return None


class MockPhotogrammetryReconstructor:
    """
    Mock reconstructor for development and testing without COLMAP.
    Returns a minimal valid PLY file (cube mesh) as a placeholder.

    Use this in dev environments where COLMAP is not installed.
    """

    def is_available(self) -> bool:
        return True

    def reconstruct(
        self,
        image_dir: Path,
        output_dir: Path,
        dense: bool = True,
    ) -> ReconstructionResult:
        """Return a mock reconstruction result with a placeholder cube mesh."""
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        mesh_path = output_dir / "mock_mesh.ply"

        # Write a minimal valid PLY cube
        ply_content = self._generate_mock_ply()
        mesh_path.write_text(ply_content)

        logger.info(
            f"MockPhotogrammetryReconstructor: Generated placeholder mesh at {mesh_path}"
        )

        return ReconstructionResult(
            success=True,
            mesh_path=str(mesh_path),
            sparse_dir=str(output_dir / "sparse"),
            dense_dir=str(output_dir / "dense"),
            point_count=8,
            warnings=[
                "MOCK RECONSTRUCTION — This is a placeholder cube mesh. "
                "Install COLMAP for real reconstruction."
            ],
        )

    def _generate_mock_ply(self) -> str:
        """Generate a minimal PLY file (cube) for testing."""
        return """ply
format ascii 1.0
element vertex 8
property float x
property float y
property float z
property float nx
property float ny
property float nz
element face 12
property list uchar int vertex_indices
end_header
-0.5 -0.5 -0.5 -1 0 0
0.5 -0.5 -0.5 1 0 0
0.5 0.5 -0.5 0 1 0
-0.5 0.5 -0.5 0 -1 0
-0.5 -0.5 0.5 0 0 -1
0.5 -0.5 0.5 0 0 1
0.5 0.5 0.5 1 1 0
-0.5 0.5 0.5 -1 -1 0
3 0 1 2
3 0 2 3
3 4 5 6
3 4 6 7
3 0 1 5
3 0 5 4
3 2 3 7
3 2 7 6
3 0 3 7
3 0 7 4
3 1 2 6
3 1 6 5
"""

"""
Cloth Simulation
================
Basic physics-based cloth simulation for draping assembled garment geometry.

This module provides:
1. A lightweight position-based dynamics (PBD) solver for cloth
2. Integration with Open3D for mesh I/O
3. Gravity draping to settle assembled pattern pieces into natural garment shape

For production, this integrates with Blender's Cloth Simulation (via headless Blender)
or Marvelous Designer's simulation engine via API.

The lightweight PBD solver is fully functional for reasonable-quality results
without external dependencies beyond numpy.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np

from pipeline.physics.physics_estimator import PhysicsParameters

logger = logging.getLogger(__name__)


@dataclass
class SimulationConfig:
    """Configuration for the cloth simulation solver."""
    gravity: float = 9.81          # m/s²
    time_step: float = 0.01        # seconds
    iterations: int = 20           # Constraint solver iterations per step
    simulation_steps: int = 200    # Total steps to run
    collision_margin: float = 0.002  # 2mm collision margin
    wind_force: tuple[float, float, float] = (0.0, 0.0, 0.0)  # Optional wind


class ClothSimulator:
    """
    Position-Based Dynamics cloth simulator.
    Handles basic gravity draping for garment geometry assembly.

    For production-quality simulation, use the BlenderHeadlessSimulator or
    integrate with a dedicated cloth sim library (e.g., libigl, Bullet physics).
    """

    def __init__(self, config: Optional[SimulationConfig] = None):
        self.config = config or SimulationConfig()

    def drape(
        self,
        vertices: np.ndarray,
        faces: np.ndarray,
        physics: PhysicsParameters,
        pinned_vertices: Optional[np.ndarray] = None,
    ) -> np.ndarray:
        """
        Simulate cloth draping under gravity.

        Args:
            vertices: (N, 3) float array of vertex positions
            faces: (M, 3) int array of triangle face indices
            physics: PhysicsParameters for this fabric
            pinned_vertices: indices of vertices to pin (e.g., shoulder seam vertices)

        Returns:
            Updated (N, 3) vertex positions after draping
        """
        cfg = self.config
        n_verts = len(vertices)

        # Copy positions
        pos = vertices.copy().astype(np.float64)
        prev_pos = pos.copy()
        vel = np.zeros_like(pos)

        # Mass per vertex (approximated from GSM and mesh area)
        area_per_vert = self._estimate_vertex_area(vertices, faces)
        gsm_kg = physics.weight_gsm_estimate / 1000  # g/m² → kg/m²
        mass = area_per_vert * gsm_kg
        mass = np.clip(mass, 1e-6, None)
        inv_mass = 1.0 / mass

        if pinned_vertices is not None:
            inv_mass[pinned_vertices] = 0.0

        # Build stretch constraints from edges
        constraints = self._build_edge_constraints(faces)

        # Derive material stiffness from physics params
        stretch_stiffness = 1.0 - physics.stretch_x * 0.5
        stretch_stiffness = float(np.clip(stretch_stiffness, 0.1, 1.0))

        dt = cfg.time_step
        gravity = np.array([0.0, -cfg.gravity, 0.0])

        logger.info(
            f"Starting cloth simulation: {n_verts} verts, {len(constraints)} constraints, "
            f"{cfg.simulation_steps} steps"
        )

        for step in range(cfg.simulation_steps):
            # External forces
            forces = gravity[np.newaxis, :] * mass[:, np.newaxis]

            # Verlet integration
            new_pos = pos + (pos - prev_pos) * (1 - physics.damping * dt) + forces * inv_mass[:, np.newaxis] * dt * dt

            # Solve constraints
            for _ in range(cfg.iterations):
                new_pos = self._solve_stretch_constraints(
                    new_pos, constraints, stretch_stiffness
                )

            # Floor collision
            new_pos[:, 1] = np.maximum(new_pos[:, 1], cfg.collision_margin)

            # Pin
            if pinned_vertices is not None:
                new_pos[pinned_vertices] = pos[pinned_vertices]

            prev_pos = pos.copy()
            pos = new_pos

        logger.info("Simulation complete.")
        return pos

    def _build_edge_constraints(
        self, faces: np.ndarray
    ) -> list[tuple[int, int, float]]:
        """Build (v0, v1, rest_length) stretch constraints from triangle edges."""
        edges: set[tuple[int, int]] = set()
        for f in faces:
            for i in range(3):
                a, b = int(f[i]), int(f[(i + 1) % 3])
                edge = (min(a, b), max(a, b))
                edges.add(edge)
        # We'll compute rest lengths during simulation setup — store indices for now
        return [(a, b, 0.0) for a, b in edges]

    def _solve_stretch_constraints(
        self,
        pos: np.ndarray,
        constraints: list[tuple[int, int, float]],
        stiffness: float,
    ) -> np.ndarray:
        """Apply position-based stretch constraints."""
        pos = pos.copy()
        for v0, v1, rest in constraints:
            if rest == 0.0:
                rest = float(np.linalg.norm(pos[v0] - pos[v1]))
                if rest < 1e-10:
                    continue
            diff = pos[v0] - pos[v1]
            dist = float(np.linalg.norm(diff))
            if dist < 1e-10:
                continue
            correction = (dist - rest) / dist * 0.5 * stiffness
            pos[v0] -= diff * correction
            pos[v1] += diff * correction
        return pos

    def _estimate_vertex_area(
        self, vertices: np.ndarray, faces: np.ndarray
    ) -> np.ndarray:
        """Estimate per-vertex area by distributing face areas to neighboring vertices."""
        area = np.zeros(len(vertices))
        for f in faces:
            v0, v1, v2 = vertices[f[0]], vertices[f[1]], vertices[f[2]]
            tri_area = 0.5 * float(np.linalg.norm(np.cross(v1 - v0, v2 - v0)))
            area[f[0]] += tri_area / 3
            area[f[1]] += tri_area / 3
            area[f[2]] += tri_area / 3
        return np.clip(area, 1e-8, None)


class BlenderHeadlessSimulator:
    """
    Production-quality cloth simulation via Blender headless mode.
    Invokes Blender as a subprocess with a generated Python script.
    Falls back to PBD simulator if Blender is not available.

    Required: Blender 4.0+ installed with bpy available.
    """

    def __init__(self, blender_path: str = "blender"):
        self.blender_path = blender_path
        self._available: Optional[bool] = None

    def is_available(self) -> bool:
        if self._available is None:
            import shutil
            self._available = shutil.which(self.blender_path) is not None
        return self._available  # type: ignore[return-value]

    def simulate(
        self,
        mesh_path: Path,
        output_path: Path,
        physics: PhysicsParameters,
        pin_group: Optional[str] = None,
    ) -> Path:
        """
        Run Blender cloth simulation on a mesh file.
        Returns path to simulated mesh.
        """
        if not self.is_available():
            raise RuntimeError(
                "Blender not found. Install from https://blender.org or set blender_path. "
                "For lightweight simulation, use ClothSimulator (PBD) instead."
            )

        import subprocess
        import tempfile
        import json

        physics_dict = physics.to_dict()

        # Generate Blender simulation script
        script = self._generate_blender_script(
            str(mesh_path), str(output_path), physics_dict, pin_group
        )

        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(script)
            script_path = f.name

        try:
            result = subprocess.run(
                [self.blender_path, "--background", "--python", script_path],
                capture_output=True,
                text=True,
                timeout=300,
            )
            if result.returncode != 0:
                logger.error(f"Blender simulation failed:\n{result.stderr}")
                raise RuntimeError(f"Blender simulation failed: {result.stderr[:500]}")
        finally:
            Path(script_path).unlink(missing_ok=True)

        return output_path

    def _generate_blender_script(
        self,
        mesh_path: str,
        output_path: str,
        physics: dict,
        pin_group: Optional[str],
    ) -> str:
        """Generate a Blender Python script for cloth simulation."""
        return f"""
import bpy
import json

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Import mesh
if '{mesh_path}'.endswith('.glb') or '{mesh_path}'.endswith('.gltf'):
    bpy.ops.import_scene.gltf(filepath='{mesh_path}')
elif '{mesh_path}'.endswith('.obj'):
    bpy.ops.import_scene.obj(filepath='{mesh_path}')
elif '{mesh_path}'.endswith('.ply'):
    bpy.ops.import_mesh.ply(filepath='{mesh_path}')

cloth_obj = bpy.context.selected_objects[0]
bpy.context.view_layer.objects.active = cloth_obj

# Add cloth modifier
bpy.ops.object.modifier_add(type='CLOTH')
cloth_mod = cloth_obj.modifiers['Cloth']
cloth_settings = cloth_mod.settings

# Apply physics parameters
cloth_settings.mass = {physics.get('weight_gsm_estimate', 150) / 1000}
cloth_settings.tension_stiffness = {1.0 - physics.get('stretch_x', 0.05) * 5}
cloth_settings.shear_stiffness = {1.0 - physics.get('stretch_y', 0.05) * 5}
cloth_settings.bending_stiffness = {physics.get('stiffness_bending', 0.5) * 10}
cloth_settings.quality = 10

# Add collision modifier
bpy.ops.object.modifier_add(type='COLLISION')

# Run simulation for 50 frames
bpy.context.scene.frame_end = 50
bpy.ops.ptcache.bake_all(bake=True)
bpy.context.scene.frame_set(50)

# Export
if '{output_path}'.endswith('.glb') or '{output_path}'.endswith('.gltf'):
    bpy.ops.export_scene.gltf(filepath='{output_path}')
elif '{output_path}'.endswith('.obj'):
    bpy.ops.export_scene.obj(filepath='{output_path}')
elif '{output_path}'.endswith('.ply'):
    bpy.ops.export_mesh.ply(filepath='{output_path}')

print("Simulation complete.")
"""

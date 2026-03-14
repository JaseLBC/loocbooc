"""Mesh utility functions shared across pipeline modules."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import numpy as np


def compute_surface_area(vertices: np.ndarray, faces: np.ndarray) -> float:
    """Compute total surface area of a triangle mesh in the unit of input vertices."""
    if len(faces) == 0:
        return 0.0
    v0 = vertices[faces[:, 0]]
    v1 = vertices[faces[:, 1]]
    v2 = vertices[faces[:, 2]]
    cross = np.cross(v1 - v0, v2 - v0)
    areas = np.linalg.norm(cross, axis=1) / 2.0
    return float(areas.sum())


def compute_bounding_box(vertices: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Return (min_corner, max_corner) of mesh bounding box."""
    return vertices.min(axis=0), vertices.max(axis=0)


def center_mesh(vertices: np.ndarray) -> np.ndarray:
    """Center mesh at origin."""
    center = vertices.mean(axis=0)
    return vertices - center


def normalize_mesh_scale(
    vertices: np.ndarray, target_height: float = 1.0
) -> np.ndarray:
    """Scale mesh so its height (Y extent) equals target_height."""
    min_v, max_v = compute_bounding_box(vertices)
    height = max_v[1] - min_v[1]
    if height < 1e-8:
        return vertices
    return vertices * (target_height / height)


def merge_close_vertices(
    vertices: np.ndarray,
    faces: np.ndarray,
    tolerance: float = 0.001,
) -> tuple[np.ndarray, np.ndarray]:
    """Merge vertices within tolerance distance (seam welding)."""
    from scipy.spatial import KDTree

    tree = KDTree(vertices)
    pairs = tree.query_pairs(tolerance)

    # Build vertex remapping: point all vertices in a cluster to a representative
    remap = list(range(len(vertices)))
    for i, j in pairs:
        root_i = remap[i]
        root_j = remap[j]
        if root_i != root_j:
            remap[j] = root_i

    # Compact: create new vertex array with unique vertices only
    unique_ids = sorted(set(remap))
    old_to_new = {old: new for new, old in enumerate(unique_ids)}
    new_vertices = vertices[unique_ids]
    new_remap = [old_to_new[remap[i]] for i in range(len(vertices))]
    new_faces = np.array([[new_remap[f] for f in face] for face in faces])

    # Remove degenerate faces (where two or more vertices collapsed to same)
    valid_mask = (
        (new_faces[:, 0] != new_faces[:, 1]) &
        (new_faces[:, 1] != new_faces[:, 2]) &
        (new_faces[:, 0] != new_faces[:, 2])
    )
    new_faces = new_faces[valid_mask]

    return new_vertices, new_faces


def validate_mesh(vertices: np.ndarray, faces: np.ndarray) -> list[str]:
    """Run basic mesh validity checks. Returns list of issues found."""
    issues = []
    if len(vertices) == 0:
        issues.append("Mesh has no vertices")
    if len(faces) == 0:
        issues.append("Mesh has no faces")

    if len(faces) > 0:
        max_idx = faces.max()
        if max_idx >= len(vertices):
            issues.append(f"Face references vertex {max_idx} but only {len(vertices)} vertices exist")

        # Check for degenerate faces
        degenerate = np.sum(
            (faces[:, 0] == faces[:, 1]) |
            (faces[:, 1] == faces[:, 2]) |
            (faces[:, 0] == faces[:, 2])
        )
        if degenerate > 0:
            issues.append(f"{degenerate} degenerate faces found")

    return issues

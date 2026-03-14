"""
Loocbooc 3D Garment Reconstruction Pipeline
============================================

Converts photos, videos, and pattern files into physics-accurate 3D garment models.

Two reconstruction paths:
  Path A — Pattern-based: 2D cut patterns + fabric composition → mathematically perfect 3D
  Path B — Photo/video: 12+ photos or video → photogrammetry → 3D mesh

The combination: Geometry (patterns or photos) + Physics (fabric composition) = complete model.

Usage:
    from pipeline.orchestrator import PipelineOrchestrator, PipelineJob
    from pipeline.physics.composition_parser import CompositionParser
    from pipeline.physics.physics_estimator import PhysicsEstimator
"""

__version__ = "0.1.0"
__author__ = "Loocbooc Engineering"

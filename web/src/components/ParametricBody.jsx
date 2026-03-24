/**
 * ParametricBody - Measurement-based 3D body model
 * Creates a body shape based on height, bust, waist, hips
 */

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Standard proportions for female body (as ratios of height)
const STANDARD_PROPORTIONS = {
  headHeight: 0.13,      // Head is ~13% of height
  neckHeight: 0.02,
  torsoUpperHeight: 0.15, // Shoulders to bust
  torsoMidHeight: 0.10,   // Bust to waist
  torsoLowerHeight: 0.12, // Waist to hips
  legUpperHeight: 0.24,   // Hips to knee
  legLowerHeight: 0.24,   // Knee to ankle
  
  shoulderWidth: 0.22,    // Shoulder width as ratio of height
  hipWidth: 0.18,
  
  // Standard measurements (cm) for reference sizing
  standardBust: 90,
  standardWaist: 70,
  standardHips: 95,
};

export function ParametricBody({ measurements, color = '#e8d4c4', showWireframe = false }) {
  const groupRef = useRef();
  
  // Calculate body dimensions from measurements
  const bodyDimensions = useMemo(() => {
    const {
      height = 165,
      bust = 90,
      waist = 70,
      hips = 95,
      inseam
    } = measurements || {};
    
    const heightM = height / 100; // Convert to meters
    
    // Scale factors based on measurements vs standard
    const bustScale = bust / STANDARD_PROPORTIONS.standardBust;
    const waistScale = waist / STANDARD_PROPORTIONS.standardWaist;
    const hipsScale = hips / STANDARD_PROPORTIONS.standardHips;
    
    // Calculate widths (circumference → diameter → radius)
    const bustRadius = (bust / Math.PI / 2) / 100;
    const waistRadius = (waist / Math.PI / 2) / 100;
    const hipsRadius = (hips / Math.PI / 2) / 100;
    
    // Calculate vertical positions
    const floorY = 0;
    const ankleY = heightM * 0.05;
    const kneeY = heightM * 0.27;
    const hipsY = heightM * 0.48;
    const waistY = heightM * 0.58;
    const bustY = heightM * 0.72;
    const shoulderY = heightM * 0.82;
    const neckY = heightM * 0.87;
    const headTopY = heightM;
    
    // Leg inseam override if provided
    const legLength = inseam ? (inseam / 100) : (hipsY - ankleY);
    
    return {
      heightM,
      bustRadius,
      waistRadius,
      hipsRadius,
      bustScale,
      waistScale,
      hipsScale,
      positions: {
        ankleY,
        kneeY,
        hipsY,
        waistY,
        bustY,
        shoulderY,
        neckY,
        headTopY
      },
      legLength
    };
  }, [measurements]);
  
  // Subtle breathing animation
  useFrame((state) => {
    if (groupRef.current) {
      const breathe = Math.sin(state.clock.elapsedTime * 1.5) * 0.002;
      groupRef.current.scale.x = 1 + breathe;
      groupRef.current.scale.z = 1 + breathe * 0.5;
    }
  });
  
  const { heightM, bustRadius, waistRadius, hipsRadius, positions } = bodyDimensions;
  const skinMaterial = useMemo(() => new THREE.MeshStandardMaterial({ 
    color,
    roughness: 0.8,
    metalness: 0.1,
    wireframe: showWireframe
  }), [color, showWireframe]);
  
  // Create torso profile using LatheGeometry for smooth shape
  const torsoGeometry = useMemo(() => {
    const points = [];
    const segments = 20;
    
    // Build profile from hips to shoulders
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      let radius, y;
      
      if (t < 0.2) {
        // Hips region
        const localT = t / 0.2;
        y = positions.hipsY;
        radius = hipsRadius * (1 - localT * 0.1);
      } else if (t < 0.4) {
        // Hips to waist
        const localT = (t - 0.2) / 0.2;
        y = positions.hipsY + (positions.waistY - positions.hipsY) * localT;
        radius = hipsRadius + (waistRadius - hipsRadius) * localT;
      } else if (t < 0.6) {
        // Waist to bust
        const localT = (t - 0.4) / 0.2;
        y = positions.waistY + (positions.bustY - positions.waistY) * localT;
        radius = waistRadius + (bustRadius - waistRadius) * localT;
      } else if (t < 0.8) {
        // Bust region
        const localT = (t - 0.6) / 0.2;
        y = positions.bustY + (positions.shoulderY - positions.bustY) * localT * 0.5;
        radius = bustRadius * (1 - localT * 0.2);
      } else {
        // Shoulders
        const localT = (t - 0.8) / 0.2;
        y = positions.bustY + (positions.shoulderY - positions.bustY) * (0.5 + localT * 0.5);
        radius = bustRadius * 0.8 * (1 - localT * 0.3);
      }
      
      points.push(new THREE.Vector2(radius, y));
    }
    
    return new THREE.LatheGeometry(points, 32);
  }, [positions, bustRadius, waistRadius, hipsRadius]);
  
  return (
    <group ref={groupRef}>
      {/* Head */}
      <mesh position={[0, positions.neckY + (positions.headTopY - positions.neckY) / 2, 0]}>
        <sphereGeometry args={[heightM * 0.065, 32, 32]} />
        <primitive object={skinMaterial} attach="material" />
      </mesh>
      
      {/* Neck */}
      <mesh position={[0, positions.neckY - 0.02, 0]}>
        <cylinderGeometry args={[heightM * 0.025, heightM * 0.03, 0.04, 16]} />
        <primitive object={skinMaterial} attach="material" />
      </mesh>
      
      {/* Torso (using lathe geometry for smooth curves) */}
      <mesh>
        <primitive object={torsoGeometry} attach="geometry" />
        <primitive object={skinMaterial} attach="material" />
      </mesh>
      
      {/* Left leg - upper */}
      <mesh position={[-hipsRadius * 0.4, (positions.hipsY + positions.kneeY) / 2, 0]}>
        <capsuleGeometry args={[hipsRadius * 0.35, positions.hipsY - positions.kneeY - 0.1, 8, 16]} />
        <primitive object={skinMaterial} attach="material" />
      </mesh>
      
      {/* Left leg - lower */}
      <mesh position={[-hipsRadius * 0.4, (positions.kneeY + positions.ankleY) / 2, 0]}>
        <capsuleGeometry args={[hipsRadius * 0.25, positions.kneeY - positions.ankleY - 0.05, 8, 16]} />
        <primitive object={skinMaterial} attach="material" />
      </mesh>
      
      {/* Right leg - upper */}
      <mesh position={[hipsRadius * 0.4, (positions.hipsY + positions.kneeY) / 2, 0]}>
        <capsuleGeometry args={[hipsRadius * 0.35, positions.hipsY - positions.kneeY - 0.1, 8, 16]} />
        <primitive object={skinMaterial} attach="material" />
      </mesh>
      
      {/* Right leg - lower */}
      <mesh position={[hipsRadius * 0.4, (positions.kneeY + positions.ankleY) / 2, 0]}>
        <capsuleGeometry args={[hipsRadius * 0.25, positions.kneeY - positions.ankleY - 0.05, 8, 16]} />
        <primitive object={skinMaterial} attach="material" />
      </mesh>
      
      {/* Left arm */}
      <group position={[-bustRadius * 1.2, positions.shoulderY - 0.05, 0]} rotation={[0, 0, 0.15]}>
        {/* Upper arm */}
        <mesh position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.035, 0.2, 8, 16]} />
          <primitive object={skinMaterial} attach="material" />
        </mesh>
        {/* Forearm */}
        <mesh position={[0.02, -0.34, 0]} rotation={[0, 0, -0.1]}>
          <capsuleGeometry args={[0.028, 0.2, 8, 16]} />
          <primitive object={skinMaterial} attach="material" />
        </mesh>
      </group>
      
      {/* Right arm */}
      <group position={[bustRadius * 1.2, positions.shoulderY - 0.05, 0]} rotation={[0, 0, -0.15]}>
        {/* Upper arm */}
        <mesh position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.035, 0.2, 8, 16]} />
          <primitive object={skinMaterial} attach="material" />
        </mesh>
        {/* Forearm */}
        <mesh position={[-0.02, -0.34, 0]} rotation={[0, 0, 0.1]}>
          <capsuleGeometry args={[0.028, 0.2, 8, 16]} />
          <primitive object={skinMaterial} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

export default ParametricBody;

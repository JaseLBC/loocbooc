/**
 * GarmentOverlay - Renders garment on top of body model
 * Adapts to body measurements and garment type
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';

// Garment type configs
const GARMENT_CONFIGS = {
  dress: {
    startY: 0.82, // shoulders
    endY: 0.35,   // above knee (midi)
    segments: 30,
    sleeves: true
  },
  'dress-maxi': {
    startY: 0.82,
    endY: 0.08,
    segments: 40,
    sleeves: true
  },
  'dress-mini': {
    startY: 0.82,
    endY: 0.45,
    segments: 25,
    sleeves: true
  },
  top: {
    startY: 0.82,
    endY: 0.55,
    segments: 20,
    sleeves: true
  },
  'bottom-pants': {
    startY: 0.58,
    endY: 0.08,
    segments: 30,
    legs: true
  },
  'bottom-skirt': {
    startY: 0.58,
    endY: 0.35,
    segments: 20
  }
};

export function GarmentOverlay({ 
  measurements, 
  garmentType = 'dress', 
  color = '#2d2519',
  fit = 'regular', // loose, regular, tight
  opacity = 0.95
}) {
  const bodyMeasurements = useMemo(() => {
    const {
      height = 165,
      bust = 90,
      waist = 70,
      hips = 95
    } = measurements || {};
    
    const heightM = height / 100;
    
    // Calculate radii from circumferences
    const bustRadius = (bust / Math.PI / 2) / 100;
    const waistRadius = (waist / Math.PI / 2) / 100;
    const hipsRadius = (hips / Math.PI / 2) / 100;
    
    // Fit adjustment
    const fitMultiplier = fit === 'loose' ? 1.15 : fit === 'tight' ? 1.02 : 1.08;
    
    return {
      heightM,
      bustRadius: bustRadius * fitMultiplier,
      waistRadius: waistRadius * fitMultiplier,
      hipsRadius: hipsRadius * fitMultiplier
    };
  }, [measurements, fit]);
  
  const config = GARMENT_CONFIGS[garmentType] || GARMENT_CONFIGS.dress;
  const { heightM, bustRadius, waistRadius, hipsRadius } = bodyMeasurements;
  
  // Create garment geometry
  const garmentGeometry = useMemo(() => {
    const points = [];
    const segments = config.segments;
    const startY = config.startY * heightM;
    const endY = config.endY * heightM;
    const totalHeight = startY - endY;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = startY - totalHeight * t;
      
      // Interpolate radius based on body position
      let radius;
      const bustY = heightM * 0.72;
      const waistY = heightM * 0.58;
      const hipsY = heightM * 0.48;
      
      if (y >= bustY) {
        // Above bust - shoulders
        radius = bustRadius * 0.9;
      } else if (y >= waistY) {
        // Bust to waist
        const localT = (bustY - y) / (bustY - waistY);
        radius = bustRadius + (waistRadius - bustRadius) * localT;
      } else if (y >= hipsY) {
        // Waist to hips
        const localT = (waistY - y) / (waistY - hipsY);
        radius = waistRadius + (hipsRadius - waistRadius) * localT;
      } else {
        // Below hips
        // For dresses: flare out slightly
        // For pants: taper to leg width
        if (garmentType.includes('pants')) {
          const legRadius = hipsRadius * 0.4;
          const localT = (hipsY - y) / (hipsY - endY);
          radius = hipsRadius + (legRadius - hipsRadius) * localT;
        } else {
          // Dress flare
          const flare = (hipsY - y) * 0.2;
          radius = hipsRadius + flare;
        }
      }
      
      points.push(new THREE.Vector2(radius, y));
    }
    
    return new THREE.LatheGeometry(points, 48);
  }, [config, heightM, bustRadius, waistRadius, hipsRadius, garmentType]);
  
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0.1,
    transparent: true,
    opacity,
    side: THREE.DoubleSide
  }), [color, opacity]);
  
  return (
    <group>
      {/* Main garment body */}
      <mesh>
        <primitive object={garmentGeometry} attach="geometry" />
        <primitive object={material} attach="material" />
      </mesh>
      
      {/* Sleeves for tops/dresses */}
      {config.sleeves && (
        <>
          {/* Left sleeve */}
          <mesh 
            position={[-bustRadius * 1.3, heightM * 0.74, 0]} 
            rotation={[0, 0, 0.3]}
          >
            <cylinderGeometry args={[0.04, 0.035, 0.25, 16, 1, true]} />
            <primitive object={material} attach="material" />
          </mesh>
          
          {/* Right sleeve */}
          <mesh 
            position={[bustRadius * 1.3, heightM * 0.74, 0]} 
            rotation={[0, 0, -0.3]}
          >
            <cylinderGeometry args={[0.04, 0.035, 0.25, 16, 1, true]} />
            <primitive object={material} attach="material" />
          </mesh>
        </>
      )}
      
      {/* Pant legs */}
      {config.legs && (
        <>
          {/* Left leg */}
          <mesh position={[-hipsRadius * 0.35, (heightM * 0.48 + heightM * config.endY) / 2, 0]}>
            <cylinderGeometry 
              args={[hipsRadius * 0.35, hipsRadius * 0.3, heightM * (0.48 - config.endY), 16, 1, true]} 
            />
            <primitive object={material} attach="material" />
          </mesh>
          
          {/* Right leg */}
          <mesh position={[hipsRadius * 0.35, (heightM * 0.48 + heightM * config.endY) / 2, 0]}>
            <cylinderGeometry 
              args={[hipsRadius * 0.35, hipsRadius * 0.3, heightM * (0.48 - config.endY), 16, 1, true]} 
            />
            <primitive object={material} attach="material" />
          </mesh>
        </>
      )}
    </group>
  );
}

export default GarmentOverlay;

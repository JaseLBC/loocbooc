/**
 * TryOnViewer - 3D try-on visualization component
 * Uses React Three Fiber for WebGL rendering
 */

import React, { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF, Html, ContactShadows } from '@react-three/drei';
import { ParametricBody } from './ParametricBody';
import { GarmentOverlay } from './GarmentOverlay';

// Avatar model component - now uses ParametricBody for realistic proportions
function Avatar({ modelUrl, measurements }) {
  return (
    <ParametricBody 
      measurements={measurements} 
      color="#e8d4c4"
    />
  );
}

// Garment overlay component - uses GarmentOverlay for realistic fit
function Garment({ modelUrl, properties, color, measurements }) {
  const garmentType = properties?.category || properties?.fit || 'dress';
  const fit = properties?.fit || 'regular';
  
  return (
    <GarmentOverlay
      measurements={measurements}
      garmentType={garmentType}
      color={color || '#2d2519'}
      fit={fit}
    />
  );
}

// Loading placeholder
function Loader() {
  return (
    <Html center>
      <div style={{ 
        color: '#3d3129', 
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px'
      }}>
        Loading...
      </div>
    </Html>
  );
}

// Main viewer component
export function TryOnViewer({ 
  avatar, 
  garment, 
  size, 
  color,
  onRotate,
  style 
}) {
  const controlsRef = useRef();
  
  return (
    <div style={{ 
      width: '100%', 
      height: '500px', 
      background: '#f5f5f5',
      borderRadius: '8px',
      overflow: 'hidden',
      ...style 
    }}>
      <Canvas
        camera={{ 
          position: [0, 1.2, 2.5], 
          fov: 45 
        }}
        shadows
      >
        <Suspense fallback={<Loader />}>
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight 
            position={[5, 5, 5]} 
            intensity={1} 
            castShadow 
          />
          <directionalLight 
            position={[-5, 5, -5]} 
            intensity={0.5} 
          />
          
          {/* Environment for reflections */}
          <Environment preset="studio" />
          
          {/* Avatar */}
          {avatar && (
            <Avatar 
              modelUrl={avatar.modelUrl} 
              measurements={avatar.measurements} 
            />
          )}
          
          {/* Garment overlay */}
          {garment && (
            <Garment 
              modelUrl={garment.modelUrl}
              properties={garment.properties}
              color={color}
              measurements={avatar?.measurements}
            />
          )}
          
          {/* Ground shadow */}
          <ContactShadows 
            position={[0, 0, 0]} 
            opacity={0.4} 
            scale={3} 
            blur={2} 
          />
          
          {/* Camera controls */}
          <OrbitControls 
            ref={controlsRef}
            target={[0, 0.9, 0]}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 1.5}
            minDistance={1.5}
            maxDistance={4}
            enablePan={false}
            onChange={() => onRotate && onRotate()}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default TryOnViewer;

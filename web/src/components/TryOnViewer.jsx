/**
 * TryOnViewer - 3D try-on visualization component
 * Uses React Three Fiber for WebGL rendering
 */

import React, { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF, Html, ContactShadows } from '@react-three/drei';

// Avatar model component
function Avatar({ modelUrl, measurements }) {
  // In production, load actual GLB model
  // For now, render a placeholder body shape
  
  const height = (measurements?.height || 165) / 100;
  const bustScale = (measurements?.bust || 90) / 90;
  const waistScale = (measurements?.waist || 70) / 70;
  const hipsScale = (measurements?.hips || 95) / 95;
  
  return (
    <group position={[0, 0, 0]}>
      {/* Head */}
      <mesh position={[0, height * 0.9, 0]}>
        <sphereGeometry args={[0.12, 32, 32]} />
        <meshStandardMaterial color="#e8d4c4" />
      </mesh>
      
      {/* Neck */}
      <mesh position={[0, height * 0.82, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.1, 16]} />
        <meshStandardMaterial color="#e8d4c4" />
      </mesh>
      
      {/* Torso - upper (bust) */}
      <mesh position={[0, height * 0.7, 0]} scale={[bustScale, 1, bustScale * 0.6]}>
        <capsuleGeometry args={[0.15, 0.15, 8, 16]} />
        <meshStandardMaterial color="#e8d4c4" />
      </mesh>
      
      {/* Torso - middle (waist) */}
      <mesh position={[0, height * 0.55, 0]} scale={[waistScale * 0.9, 1, waistScale * 0.5]}>
        <capsuleGeometry args={[0.12, 0.1, 8, 16]} />
        <meshStandardMaterial color="#e8d4c4" />
      </mesh>
      
      {/* Torso - lower (hips) */}
      <mesh position={[0, height * 0.42, 0]} scale={[hipsScale, 1, hipsScale * 0.6]}>
        <capsuleGeometry args={[0.16, 0.12, 8, 16]} />
        <meshStandardMaterial color="#e8d4c4" />
      </mesh>
      
      {/* Legs */}
      <mesh position={[-0.08, height * 0.2, 0]}>
        <capsuleGeometry args={[0.07, height * 0.35, 8, 16]} />
        <meshStandardMaterial color="#e8d4c4" />
      </mesh>
      <mesh position={[0.08, height * 0.2, 0]}>
        <capsuleGeometry args={[0.07, height * 0.35, 8, 16]} />
        <meshStandardMaterial color="#e8d4c4" />
      </mesh>
      
      {/* Arms */}
      <mesh position={[-0.25, height * 0.65, 0]} rotation={[0, 0, 0.2]}>
        <capsuleGeometry args={[0.04, 0.25, 8, 16]} />
        <meshStandardMaterial color="#e8d4c4" />
      </mesh>
      <mesh position={[0.25, height * 0.65, 0]} rotation={[0, 0, -0.2]}>
        <capsuleGeometry args={[0.04, 0.25, 8, 16]} />
        <meshStandardMaterial color="#e8d4c4" />
      </mesh>
    </group>
  );
}

// Garment overlay component
function Garment({ modelUrl, properties, color }) {
  // In production, load actual garment GLB
  // For now, render a placeholder dress shape
  
  const garmentColor = color || '#2d2519';
  
  return (
    <group position={[0, 0, 0]}>
      {/* Simple dress placeholder */}
      <mesh position={[0, 0.95, 0.02]}>
        <cylinderGeometry args={[0.18, 0.25, 0.7, 32, 1, true]} />
        <meshStandardMaterial 
          color={garmentColor} 
          side={2} // DoubleSide
          transparent
          opacity={0.95}
        />
      </mesh>
    </group>
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

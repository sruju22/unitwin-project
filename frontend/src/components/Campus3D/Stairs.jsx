import React from 'react';
import * as THREE from 'three';

const STAIR_WIDTH = 0.9;
const STAIR_DEPTH = 1.6; 
const STAIR_HEIGHT = 1.2; // Connects one floor to the next
const STEPS_PER_FLIGHT = 8;
const LANDING_DEPTH = 0.9;

const STAIR_COLOR = '#b8a99a';
const STAIR_MAT = new THREE.MeshStandardMaterial({ color: STAIR_COLOR, roughness: 0.9 });

export function Stairs({ position, rotation }) {
  const stepDepth = STAIR_DEPTH / STEPS_PER_FLIGHT;
  const stepHeight = (STAIR_HEIGHT / 2) / STEPS_PER_FLIGHT;

  return (
    <group position={position} rotation={rotation}>
      {/* Flight 1 (Up) */}
      <group position={[-STAIR_WIDTH/2, 0, 0]}>
        {Array.from({ length: STEPS_PER_FLIGHT }).map((_, i) => {
          const y = i * stepHeight + stepHeight / 2;
          const z = i * stepDepth + stepDepth / 2;
          return (
            <mesh key={`f1-${i}`} position={[0, y, z]} material={STAIR_MAT} castShadow receiveShadow userData={{ walkable: true }}>
              <boxGeometry args={[STAIR_WIDTH, stepHeight, stepDepth]} />
            </mesh>
          );
        })}
        {/* Invisible ramp 1 (slope up +Z) */}
        <mesh position={[0, STAIR_HEIGHT / 4, STAIR_DEPTH / 2]} rotation={[-Math.atan2(STAIR_HEIGHT/2, STAIR_DEPTH), 0, 0]} visible={false} userData={{ walkable: true, isStair: true }}>
          <boxGeometry args={[STAIR_WIDTH, 0.1, Math.sqrt(STAIR_DEPTH**2 + (STAIR_HEIGHT/2)**2)]} />
        </mesh>
      </group>

      {/* Landing */}
      <mesh position={[0, STAIR_HEIGHT / 2, STAIR_DEPTH + LANDING_DEPTH / 2]} material={STAIR_MAT} castShadow receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[STAIR_WIDTH * 2, 0.1, LANDING_DEPTH]} />
      </mesh>

      {/* Flight 2 (Up and Back) */}
      <group position={[STAIR_WIDTH/2, STAIR_HEIGHT / 2, 0]}>
        {Array.from({ length: STEPS_PER_FLIGHT }).map((_, i) => {
          const y = i * stepHeight + stepHeight / 2;
          const z = STAIR_DEPTH - (i * stepDepth + stepDepth / 2);
          return (
            <mesh key={`f2-${i}`} position={[0, y, z]} material={STAIR_MAT} castShadow receiveShadow userData={{ walkable: true }}>
              <boxGeometry args={[STAIR_WIDTH, stepHeight, stepDepth]} />
            </mesh>
          );
        })}
        {/* Invisible ramp 2 (slope up -Z) */}
        <mesh position={[0, STAIR_HEIGHT / 4, STAIR_DEPTH / 2]} rotation={[Math.atan2(STAIR_HEIGHT/2, STAIR_DEPTH), 0, 0]} visible={false} userData={{ walkable: true, isStair: true }}>
          <boxGeometry args={[STAIR_WIDTH, 0.1, Math.sqrt(STAIR_DEPTH**2 + (STAIR_HEIGHT/2)**2)]} />
        </mesh>
      </group>
    </group>
  );
}

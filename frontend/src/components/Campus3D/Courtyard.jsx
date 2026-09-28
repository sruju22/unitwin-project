import React, { useMemo } from 'react';
import * as THREE from 'three';
import { L } from './LayoutConstants';
import { CONCRETE_MAT } from './materials';

const GRASS_COLOR = '#5a824e';

export default function Courtyard() {
  const bushes = useMemo(() => {
    const b = [];
    // Random bushes in the grass
    for(let i=0; i<30; i++) {
      b.push({
        x: (Math.random() - 0.5) * (L.COURTYARD_X * 1.8),
        z: (Math.random() - 0.5) * (L.COURTYARD_Z * 1.8),
        s: Math.random() * 0.8 + 0.5
      });
    }
    return b;
  }, []);

  return (
    <group>
      {/* Main Grass Area */}
      <mesh position={[0, 0.05, 0]} receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[L.COURTYARD_X * 2 - 2, 0.1, L.COURTYARD_Z * 2 - 2]} />
        <meshStandardMaterial color={GRASS_COLOR} roughness={1.0} />
      </mesh>

      {/* Concrete Pathway Border */}
      <mesh position={[0, 0.02, 0]} receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[L.COURTYARD_X * 2, 0.05, L.COURTYARD_Z * 2]} />
        <primitive object={CONCRETE_MAT} attach="material" />
      </mesh>

      {/* Circular Fountain / Planter */}
      {/* Near the bottom center (North) relative to the South viewing angle */}
      <mesh position={[0, 0.4, -L.COURTYARD_Z * 0.6]} castShadow receiveShadow>
        <cylinderGeometry args={[3.0, 3.0, 0.8, 32]} />
        <primitive object={CONCRETE_MAT} attach="material" />
      </mesh>
      <mesh position={[0, 0.81, -L.COURTYARD_Z * 0.6]}>
        <cylinderGeometry args={[2.7, 2.7, 0.05, 32]} />
        <meshStandardMaterial color="#4287f5" /> {/* Water/Blue tiles */}
      </mesh>

      {/* Diagonal Path */}
      <mesh position={[-L.COURTYARD_X * 0.5, 0.11, -L.COURTYARD_Z * 0.5]} rotation={[0, -Math.PI/4, 0]} receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[2.0, 0.02, 15.0]} />
        <primitive object={CONCRETE_MAT} attach="material" />
      </mesh>

      {/* Tall Pine Tree (South-East corner) */}
      <group position={[L.COURTYARD_X - 2.0, 0, L.COURTYARD_Z - 2.0]}>
        <mesh position={[0, 8.0, 0]} castShadow>
          <coneGeometry args={[2.5, 16.0, 8]} />
          <meshStandardMaterial color="#2d4a22" />
        </mesh>
        <mesh position={[0, 2.0, 0]} castShadow>
          <cylinderGeometry args={[0.4, 0.6, 4.0]} />
          <meshStandardMaterial color="#4a3b2c" />
        </mesh>
      </group>

      {/* Small Bushes */}
      {bushes.map((b, i) => (
        <mesh key={i} position={[b.x, b.s/2, b.z]} castShadow>
          <sphereGeometry args={[b.s, 8, 8]} />
          <meshStandardMaterial color="#3d6649" />
        </mesh>
      ))}
    </group>
  );
}

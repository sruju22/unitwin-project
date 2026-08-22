import React from 'react';
import * as THREE from 'three';

const PARAPET_COLOR = '#d0c4b8';
const PARAPET_MAT = new THREE.MeshStandardMaterial({ color: PARAPET_COLOR, roughness: 0.9 });
const P_HEIGHT = 0.3;

export default function Corridor({ height }) {
  return (
    <group>
      {/* Left Parapet */}
      <mesh position={[-2.55, P_HEIGHT / 2, 2.5]} material={PARAPET_MAT} castShadow receiveShadow>
        <boxGeometry args={[0.1, P_HEIGHT, 10.0]} />
      </mesh>
      {/* Center Parapet */}
      <mesh position={[0, P_HEIGHT / 2, -2.55]} material={PARAPET_MAT} castShadow receiveShadow>
        <boxGeometry args={[5.2, P_HEIGHT, 0.1]} />
      </mesh>
      {/* Right Parapet */}
      <mesh position={[2.55, P_HEIGHT / 2, 2.5]} material={PARAPET_MAT} castShadow receiveShadow>
        <boxGeometry args={[0.1, P_HEIGHT, 10.0]} />
      </mesh>
    </group>
  );
}

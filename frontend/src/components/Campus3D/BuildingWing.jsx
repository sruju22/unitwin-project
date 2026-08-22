import React from 'react';
import * as THREE from 'three';

const WALL_COLOR = '#ecd9c6';
const WALL_MAT = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.9 });

export default function BuildingWing({ height }) {
  return (
    <group>
      {/* Left Outer Wall */}
      <mesh position={[-7.1, height / 2, 2.5]} material={WALL_MAT} castShadow receiveShadow>
        <boxGeometry args={[0.2, height, 10.0]} />
      </mesh>
      {/* Center Outer Wall */}
      <mesh position={[0, height / 2, -7.1]} material={WALL_MAT} castShadow receiveShadow>
        <boxGeometry args={[14.4, height, 0.2]} />
      </mesh>
      {/* Right Outer Wall */}
      <mesh position={[7.1, height / 2, 2.5]} material={WALL_MAT} castShadow receiveShadow>
        <boxGeometry args={[0.2, height, 10.0]} />
      </mesh>
      {/* End Caps */}
      <mesh position={[-4.85, height / 2, 7.6]} material={WALL_MAT} castShadow receiveShadow>
        <boxGeometry args={[4.7, height, 0.2]} />
      </mesh>
      <mesh position={[4.85, height / 2, 7.6]} material={WALL_MAT} castShadow receiveShadow>
        <boxGeometry args={[4.7, height, 0.2]} />
      </mesh>
    </group>
  );
}

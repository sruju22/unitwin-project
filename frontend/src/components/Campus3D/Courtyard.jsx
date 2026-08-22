import React from 'react';
import * as THREE from 'three';

const GRASS_COLOR = '#4a7c59';

export default function Courtyard() {
  return (
    <group>
      {/* Grass base */}
      <mesh position={[0, 0.01, 2.5]} receiveShadow>
        <boxGeometry args={[5.0, 0.02, 10.0]} />
        <meshStandardMaterial color={GRASS_COLOR} roughness={1.0} />
      </mesh>
      {/* A few bushes */}
      <mesh position={[-1.0, 0.2, 0]} castShadow>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial color="#3d6649" />
      </mesh>
      <mesh position={[1.0, 0.15, 1.5]} castShadow>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshStandardMaterial color="#3d6649" />
      </mesh>
      <mesh position={[-0.5, 0.15, 3.5]} castShadow>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#3d6649" />
      </mesh>
    </group>
  );
}

import React from 'react';
import { L } from './LayoutConstants';
import { CREAM_WALL_MAT, ROOF_MAT } from './materials';

export default function DBlockConnection() {
  const totalHeight = L.FLOOR_HEIGHT * 2.5;
  
  return (
    <group position={[L.EAST_X + 10.0, 0, L.SOUTH_Z + 10.0]}>
      {/* Base connection hall */}
      <mesh position={[0, totalHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[15.0, totalHeight, 15.0]} />
        <primitive object={CREAM_WALL_MAT} attach="material" />
      </mesh>
      
      {/* Angled White Roof */}
      <mesh position={[0, totalHeight + 2.0, 0]} castShadow receiveShadow>
        {/* Simple pyramid/gable roof */}
        <coneGeometry args={[12.0, 4.0, 4]} />
        <meshStandardMaterial color="#f0f0f0" roughness={0.7} />
      </mesh>
    </group>
  );
}

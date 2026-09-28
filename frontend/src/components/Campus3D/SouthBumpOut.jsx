import React from 'react';
import { L } from './LayoutConstants';
import { PINK_WALL_MAT, FLOOR_TILE_MAT, CREAM_WALL_MAT } from './materials';

export default function SouthBumpOut({ yOffset, isGround }) {
  const h = L.FLOOR_HEIGHT;
  const hp = L.PARAPET_HEIGHT / 2;
  
  // Bump-out bounds
  const startX = -2.0;
  const endX = 10.0;
  const width = endX - startX;
  const centerX = startX + width / 2;

  const startZ = 8.0;
  const endZ = L.COURTYARD_Z; // 16.0
  const depth = endZ - startZ;
  const centerZ = startZ + depth / 2;

  const corridorDepth = L.CORRIDOR_WIDTH; // 3.5
  const wallZ = startZ + corridorDepth; // 11.5

  return (
    <group position={[0, yOffset, 0]}>
      {/* Floor Slab (Corridor) */}
      <mesh position={[centerX, -L.SLAB_THICKNESS/2, centerZ]} receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[width, L.SLAB_THICKNESS, depth]} />
        <primitive object={FLOOR_TILE_MAT} attach="material" />
      </mesh>

      {/* Parapets (Only on upper floors, or partial on ground) */}
      {!isGround && (
        <group>
          {/* North (Front) Parapet */}
          <mesh position={[centerX, hp, startZ]} castShadow receiveShadow>
            <boxGeometry args={[width, L.PARAPET_HEIGHT, 0.4]} />
            <primitive object={PINK_WALL_MAT} attach="material" />
          </mesh>
          {/* West (Left) Parapet */}
          <mesh position={[startX, hp, centerZ]} castShadow receiveShadow>
            <boxGeometry args={[0.4, L.PARAPET_HEIGHT, depth]} />
            <primitive object={PINK_WALL_MAT} attach="material" />
          </mesh>
          {/* East (Right) Parapet */}
          <mesh position={[endX, hp, centerZ]} castShadow receiveShadow>
            <boxGeometry args={[0.4, L.PARAPET_HEIGHT, depth]} />
            <primitive object={PINK_WALL_MAT} attach="material" />
          </mesh>
        </group>
      )}

      {/* Pillars along the open edges */}
      <mesh position={[startX, h/2, startZ]} castShadow receiveShadow>
        <boxGeometry args={[L.PILLAR_SIZE, h, L.PILLAR_SIZE]} />
        <primitive object={CREAM_WALL_MAT} attach="material" />
      </mesh>
      <mesh position={[endX, h/2, startZ]} castShadow receiveShadow>
        <boxGeometry args={[L.PILLAR_SIZE, h, L.PILLAR_SIZE]} />
        <primitive object={CREAM_WALL_MAT} attach="material" />
      </mesh>
      <mesh position={[centerX, h/2, startZ]} castShadow receiveShadow>
        <boxGeometry args={[L.PILLAR_SIZE, h, L.PILLAR_SIZE]} />
        <primitive object={CREAM_WALL_MAT} attach="material" />
      </mesh>
      <mesh position={[startX, h/2, (startZ + endZ)/2]} castShadow receiveShadow>
        <boxGeometry args={[L.PILLAR_SIZE, h, L.PILLAR_SIZE]} />
        <primitive object={CREAM_WALL_MAT} attach="material" />
      </mesh>
      
      {/* Interior Walls behind the corridor */}
      {/* North-facing interior wall */}
      <mesh position={[centerX, h/2, wallZ]} castShadow receiveShadow>
        <boxGeometry args={[width - corridorDepth*2, h, 0.4]} />
        <primitive object={CREAM_WALL_MAT} attach="material" />
      </mesh>
      
      {/* Rooms/Space behind the interior wall */}
      <mesh position={[centerX, h/2, wallZ + (endZ - wallZ)/2]} castShadow receiveShadow>
        <boxGeometry args={[width - corridorDepth*2, h, endZ - wallZ]} />
        <primitive object={PINK_WALL_MAT} attach="material" />
      </mesh>

      {/* Decorative Doors/Windows on the North interior wall */}
      <group position={[centerX, h/2, wallZ - 0.21]}>
        <mesh position={[-1.5, -0.2, 0]} receiveShadow>
          <boxGeometry args={[1.2, 2.0, 0.05]} />
          <meshStandardMaterial color="#302319" />
        </mesh>
        <mesh position={[1.5, 0.2, 0]} receiveShadow>
          <boxGeometry args={[1.6, 1.2, 0.05]} />
          <meshStandardMaterial color="#2d3748" transparent opacity={0.6} />
        </mesh>
      </group>
      
      {/* West-facing inner wall (for the West side corridor) */}
      <mesh position={[startX + corridorDepth, h/2, centerZ + corridorDepth/2]} castShadow receiveShadow>
        <boxGeometry args={[0.4, h, depth - corridorDepth]} />
        <primitive object={CREAM_WALL_MAT} attach="material" />
      </mesh>
      
      {/* East-facing inner wall (for the East side corridor) */}
      <mesh position={[endX - corridorDepth, h/2, centerZ + corridorDepth/2]} castShadow receiveShadow>
        <boxGeometry args={[0.4, h, depth - corridorDepth]} />
        <primitive object={CREAM_WALL_MAT} attach="material" />
      </mesh>

      {/* Side doors/windows on the West face */}
      <mesh position={[startX + corridorDepth - 0.21, h/2 - 0.2, centerZ + corridorDepth/2]} receiveShadow>
         <boxGeometry args={[0.05, 2.0, 1.2]} />
         <meshStandardMaterial color="#302319" />
      </mesh>
    </group>
  );
}

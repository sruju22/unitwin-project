import React from 'react';
import { L } from './LayoutConstants';
import { PINK_WALL_MAT, FLOOR_TILE_MAT } from './materials';

export default function Corridors({ yOffset }) {
  const y = yOffset;
  const hp = L.PARAPET_HEIGHT / 2;

  return (
    <group position={[0, y, 0]}>
      {/* --- CORRIDOR SLABS (Floors) --- */}
      {/* North Corridor Slab */}
      <mesh position={[0, -L.SLAB_THICKNESS/2, L.NORTH_Z]} receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[L.COURTYARD_X * 2 + L.CORRIDOR_WIDTH * 2, L.SLAB_THICKNESS, L.CORRIDOR_WIDTH]} />
        <primitive object={FLOOR_TILE_MAT} attach="material" />
      </mesh>
      
      {/* South Corridor Slab */}
      <mesh position={[0, -L.SLAB_THICKNESS/2, L.SOUTH_Z]} receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[L.COURTYARD_X * 2 + L.CORRIDOR_WIDTH * 2, L.SLAB_THICKNESS, L.CORRIDOR_WIDTH]} />
        <primitive object={FLOOR_TILE_MAT} attach="material" />
      </mesh>

      {/* West Corridor Slab */}
      <mesh position={[L.WEST_X, -L.SLAB_THICKNESS/2, 0]} receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[L.CORRIDOR_WIDTH, L.SLAB_THICKNESS, L.COURTYARD_Z * 2 - L.CORRIDOR_WIDTH * 2]} />
        <primitive object={FLOOR_TILE_MAT} attach="material" />
      </mesh>

      {/* East Corridor Slab */}
      <mesh position={[L.EAST_X, -L.SLAB_THICKNESS/2, 0]} receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[L.CORRIDOR_WIDTH, L.SLAB_THICKNESS, L.COURTYARD_Z * 2 - L.CORRIDOR_WIDTH * 2]} />
        <primitive object={FLOOR_TILE_MAT} attach="material" />
      </mesh>


      {/* --- PARAPET WALLS --- */}
      {/* North Parapet */}
      <mesh position={[0, hp, -L.COURTYARD_Z - 0.2]} castShadow receiveShadow>
        <boxGeometry args={[L.COURTYARD_X * 2, L.PARAPET_HEIGHT, 0.4]} />
        <primitive object={PINK_WALL_MAT} attach="material" />
      </mesh>
      
      {/* South Parapet */}
      <mesh position={[0, hp, L.COURTYARD_Z + 0.2]} castShadow receiveShadow>
        <boxGeometry args={[L.COURTYARD_X * 2, L.PARAPET_HEIGHT, 0.4]} />
        <primitive object={PINK_WALL_MAT} attach="material" />
      </mesh>

      {/* West Parapet */}
      <mesh position={[-L.COURTYARD_X - 0.2, hp, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, L.PARAPET_HEIGHT, L.COURTYARD_Z * 2]} />
        <primitive object={PINK_WALL_MAT} attach="material" />
      </mesh>

      {/* East Parapet */}
      <mesh position={[L.COURTYARD_X + 0.2, hp, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, L.PARAPET_HEIGHT, L.COURTYARD_Z * 2]} />
        <primitive object={PINK_WALL_MAT} attach="material" />
      </mesh>
    </group>
  );
}

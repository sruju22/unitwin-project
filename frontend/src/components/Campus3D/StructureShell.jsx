import React, { useMemo } from 'react';
import { L } from './LayoutConstants';
import { PINK_WALL_MAT, CREAM_WALL_MAT } from './materials';

export default function StructureShell({ yOffset }) {
  const y = yOffset;
  const h = L.FLOOR_HEIGHT;
  const hp = h / 2;

  // Generate pillar positions
  const pillars = useMemo(() => {
    const p = [];
    const spacing = 4.0;
    
    // North Wing
    for (let x = -L.COURTYARD_X; x <= L.COURTYARD_X; x += spacing) {
      p.push({ x, z: -L.COURTYARD_Z, type: 'courtyard' });
      p.push({ x, z: -L.COURTYARD_Z - L.CORRIDOR_WIDTH, type: 'interior' });
    }
    // South Wing
    for (let x = -L.COURTYARD_X; x <= L.COURTYARD_X; x += spacing) {
      p.push({ x, z: L.COURTYARD_Z, type: 'courtyard' });
      p.push({ x, z: L.COURTYARD_Z + L.CORRIDOR_WIDTH, type: 'interior' });
    }
    // West Wing
    for (let z = -L.COURTYARD_Z + spacing; z < L.COURTYARD_Z; z += spacing) {
      p.push({ x: -L.COURTYARD_X, z, type: 'courtyard' });
      p.push({ x: -L.COURTYARD_X - L.CORRIDOR_WIDTH, z, type: 'interior' });
    }
    // East Wing
    for (let z = -L.COURTYARD_Z + spacing; z < L.COURTYARD_Z; z += spacing) {
      p.push({ x: L.COURTYARD_X, z, type: 'courtyard' });
      p.push({ x: L.COURTYARD_X + L.CORRIDOR_WIDTH, z, type: 'interior' });
    }
    return p;
  }, []);

  return (
    <group position={[0, y, 0]}>
      {/* Outer Building Shell (Back walls of rooms) */}
      {/* North Back Wall */}
      <mesh position={[0, hp, L.NORTH_Z - L.CORRIDOR_WIDTH/2 - L.ROOM_DEPTH]} castShadow receiveShadow>
        <boxGeometry args={[L.COURTYARD_X * 2 + L.CORRIDOR_WIDTH * 2 + L.ROOM_DEPTH * 2, h, 0.4]} />
        <primitive object={PINK_WALL_MAT} attach="material" />
      </mesh>
      
      {/* South Back Wall */}
      <mesh position={[0, hp, L.SOUTH_Z + L.CORRIDOR_WIDTH/2 + L.ROOM_DEPTH]} castShadow receiveShadow>
        <boxGeometry args={[L.COURTYARD_X * 2 + L.CORRIDOR_WIDTH * 2 + L.ROOM_DEPTH * 2, h, 0.4]} />
        <primitive object={PINK_WALL_MAT} attach="material" />
      </mesh>

      {/* West Back Wall */}
      <mesh position={[L.WEST_X - L.CORRIDOR_WIDTH/2 - L.ROOM_DEPTH, hp, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, h, L.COURTYARD_Z * 2 + L.CORRIDOR_WIDTH * 2]} />
        <primitive object={PINK_WALL_MAT} attach="material" />
      </mesh>

      {/* East Back Wall */}
      <mesh position={[L.EAST_X + L.CORRIDOR_WIDTH/2 + L.ROOM_DEPTH, hp, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, h, L.COURTYARD_Z * 2 + L.CORRIDOR_WIDTH * 2]} />
        <primitive object={PINK_WALL_MAT} attach="material" />
      </mesh>

      {/* Pillars */}
      {pillars.map((pos, i) => (
        <mesh key={i} position={[pos.x, hp, pos.z]} castShadow receiveShadow>
          <boxGeometry args={[L.PILLAR_SIZE, h, L.PILLAR_SIZE]} />
          <primitive object={pos.type === 'courtyard' ? PINK_WALL_MAT : CREAM_WALL_MAT} attach="material" />
        </mesh>
      ))}

      {/* Interior Room Dividing Wall Base (behind corridor) */}
      {/* North Inner Wall */}
      <mesh position={[0, hp, -L.COURTYARD_Z - L.CORRIDOR_WIDTH]} receiveShadow>
        <boxGeometry args={[L.COURTYARD_X * 2, h, 0.2]} />
        <primitive object={CREAM_WALL_MAT} attach="material" />
      </mesh>
      {/* South Inner Wall */}
      <mesh position={[0, hp, L.COURTYARD_Z + L.CORRIDOR_WIDTH]} receiveShadow>
        <boxGeometry args={[L.COURTYARD_X * 2, h, 0.2]} />
        <primitive object={CREAM_WALL_MAT} attach="material" />
      </mesh>
      {/* West Inner Wall */}
      <mesh position={[-L.COURTYARD_X - L.CORRIDOR_WIDTH, hp, 0]} receiveShadow>
        <boxGeometry args={[0.2, h, L.COURTYARD_Z * 2]} />
        <primitive object={CREAM_WALL_MAT} attach="material" />
      </mesh>
      {/* East Inner Wall */}
      <mesh position={[L.COURTYARD_X + L.CORRIDOR_WIDTH, hp, 0]} receiveShadow>
        <boxGeometry args={[0.2, h, L.COURTYARD_Z * 2]} />
        <primitive object={CREAM_WALL_MAT} attach="material" />
      </mesh>
    </group>
  );
}

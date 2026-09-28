import { Html } from '@react-three/drei';
import Floor from './Floor';
import GroundFloor from './GroundFloor';
import Courtyard from './Courtyard';
import Staircases from './Staircases';
import Lift from './Lift';
import DBlockConnection from './DBlockConnection';
import { L } from './LayoutConstants';
import { ROOF_MAT } from './materials';

export default function CBlock({ selectedTime, selectedRoom, hoveredRoom, onSelectRoom }) {
  const roofY = 4 * L.FLOOR_HEIGHT; // Ground + 3 floors = roof at height 4

  return (
    <group position={[0, 0, -10]}> {/* Shifted slightly back for better camera view */}
      <Courtyard />
      
      {/* Structural Base */}
      <GroundFloor />
      <Staircases />
      <Lift />
      <DBlockConnection />
      
      {[1, 2, 3].map((floorNum) => (
        <group key={floorNum}>
          <Floor
            floorNumber={floorNum}
            selectedTime={selectedTime}
            selectedRoom={selectedRoom}
            hoveredRoom={hoveredRoom}
            onSelectRoom={onSelectRoom}
          />
          {/* Floor number label on the left side */}
          <Html
            position={[L.WEST_X - L.CORRIDOR_WIDTH - L.ROOM_DEPTH - 1.0, (floorNum) * L.FLOOR_HEIGHT + 1.0, 0]}
            center
            distanceFactor={30}
            style={{ pointerEvents: 'none' }}
          >
            <div style={{
              color: '#8892b0',
              fontSize: '14px',
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.1)',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}>
              Level {floorNum}
            </div>
          </Html>
        </group>
      ))}

      {/* Roof Slabs */}
      <group position={[0, roofY, 0]}>
        {/* North Roof Slab */}
        <mesh position={[0, -L.SLAB_THICKNESS/2, L.NORTH_Z - L.ROOM_DEPTH/2]} receiveShadow castShadow>
          <boxGeometry args={[L.COURTYARD_X * 2 + L.CORRIDOR_WIDTH * 2 + L.ROOM_DEPTH * 2, L.SLAB_THICKNESS, L.CORRIDOR_WIDTH + L.ROOM_DEPTH]} />
          <primitive object={ROOF_MAT} attach="material" />
        </mesh>
        {/* South Roof Slab */}
        <mesh position={[0, -L.SLAB_THICKNESS/2, L.SOUTH_Z + L.ROOM_DEPTH/2]} receiveShadow castShadow>
          <boxGeometry args={[L.COURTYARD_X * 2 + L.CORRIDOR_WIDTH * 2 + L.ROOM_DEPTH * 2, L.SLAB_THICKNESS, L.CORRIDOR_WIDTH + L.ROOM_DEPTH]} />
          <primitive object={ROOF_MAT} attach="material" />
        </mesh>
        
        {/* South Bump-Out Roof Slab */}
        <mesh position={[4.0, -L.SLAB_THICKNESS/2, 12.0]} receiveShadow castShadow>
          <boxGeometry args={[12.0, L.SLAB_THICKNESS, 8.0]} />
          <primitive object={ROOF_MAT} attach="material" />
        </mesh>
        
        {/* Small Roof Pillars on South Bump-Out */}
        {[0, 4, 8].map((xOffset) => (
          <mesh key={xOffset} position={[-1.8 + xOffset, 0.4, 8.2]} castShadow>
            <boxGeometry args={[0.3, 0.8, 0.3]} />
            <meshStandardMaterial color="#c2b697" />
          </mesh>
        ))}
        {/* West Roof Slab */}
        <mesh position={[L.WEST_X - L.ROOM_DEPTH/2, -L.SLAB_THICKNESS/2, 0]} receiveShadow castShadow>
          <boxGeometry args={[L.CORRIDOR_WIDTH + L.ROOM_DEPTH, L.SLAB_THICKNESS, L.COURTYARD_Z * 2 + L.CORRIDOR_WIDTH * 2]} />
          <primitive object={ROOF_MAT} attach="material" />
        </mesh>
        {/* East Roof Slab */}
        <mesh position={[L.EAST_X + L.ROOM_DEPTH/2, -L.SLAB_THICKNESS/2, 0]} receiveShadow castShadow>
          <boxGeometry args={[L.CORRIDOR_WIDTH + L.ROOM_DEPTH, L.SLAB_THICKNESS, L.COURTYARD_Z * 2 + L.CORRIDOR_WIDTH * 2]} />
          <primitive object={ROOF_MAT} attach="material" />
        </mesh>

        {/* Solar Panels on Roof */}
        <mesh position={[L.WEST_X - L.CORRIDOR_WIDTH, 0.4, 0]} rotation={[-0.2, 0, 0]}>
          <boxGeometry args={[2.0, 0.1, 25.0]} />
          <meshStandardMaterial color="#1a2b4c" roughness={0.2} metalness={0.8} />
        </mesh>
        <mesh position={[L.EAST_X + L.CORRIDOR_WIDTH, 0.4, 0]} rotation={[-0.2, 0, 0]}>
          <boxGeometry args={[2.0, 0.1, 25.0]} />
          <meshStandardMaterial color="#1a2b4c" roughness={0.2} metalness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

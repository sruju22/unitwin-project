import * as THREE from 'three';
import Room from './Room';
import BuildingWing from './BuildingWing';
import Corridor from './Corridor';
import { Stairs } from './Stairs';
import { ROOMS } from '../../data/cblockData';

const FLOOR_HEIGHT = 1.2; 
const ROOM_HEIGHT = 0.8;
const SLAB_THICKNESS = 0.08;
const SLAB_COLOUR = new THREE.Color('#d0c4b8');

export function getRoomTransform(index, total) {
  // Rooms: 0,1,2 -> Left | 3,4,5 -> Center | 6,7,8 -> Right
  let wing, posInWing;
  if (total <= 7) { // Floor 2 has 7 rooms
    if (index < 2) { wing = 'left'; posInWing = index; }
    else if (index < 5) { wing = 'center'; posInWing = index - 2; }
    else { wing = 'right'; posInWing = index - 5; }
  } else {
    if (index < 3) { wing = 'left'; posInWing = index; }
    else if (index < 6) { wing = 'center'; posInWing = index - 3; }
    else { wing = 'right'; posInWing = index - 6; }
  }

  const visualD = 3.0; // Deep rectangular rooms
  const visualW = 2.6; // Width along the corridor

  let x, z, rot;
  if (wing === 'left') {
    rot = Math.PI / 2; // Door faces +X
    x = -5.5;
    z = 3.0 - posInWing * 3.0; // 3.0, 0.0, -3.0
  } else if (wing === 'center') {
    rot = 0; // Door faces +Z
    z = -5.5;
    x = -3.0 + posInWing * 3.0; // -3.0, 0.0, 3.0
  } else {
    rot = -Math.PI / 2; // Door faces -X
    x = 5.5;
    z = -3.0 + posInWing * 3.0; // -3.0, 0.0, 3.0
  }

  return { x, z, rot, visualW, visualD };
}

export default function Floor({ floorNumber, selectedTime, selectedRoom, hoveredRoom, onSelectRoom }) {
  const floorRooms = ROOMS.filter((r) => r.floor === floorNumber);
  const yOffset = (floorNumber - 1) * FLOOR_HEIGHT;

  return (
    <group position={[0, yOffset, 0]}>
      {/* Left Slab - Room area (Outer) */}
      <mesh position={[-5.75, -SLAB_THICKNESS / 2, 2.5]} receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[2.5, SLAB_THICKNESS, 10.0]} />
        <meshStandardMaterial color={SLAB_COLOUR} roughness={0.8} />
      </mesh>
      {/* Left Slab - Corridor area (Inner) - cut off at z=5.0 for stairs */}
      <mesh position={[-3.5, -SLAB_THICKNESS / 2, 1.25]} receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[2.0, SLAB_THICKNESS, 7.5]} />
        <meshStandardMaterial color={SLAB_COLOUR} roughness={0.8} />
      </mesh>

      {/* Center Slab */}
      <mesh position={[0, -SLAB_THICKNESS / 2, -4.75]} receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[14.0, SLAB_THICKNESS, 4.5]} />
        <meshStandardMaterial color={SLAB_COLOUR} roughness={0.8} />
      </mesh>

      {/* Right Slab - Room area (Outer) */}
      <mesh position={[5.75, -SLAB_THICKNESS / 2, 2.5]} receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[2.5, SLAB_THICKNESS, 10.0]} />
        <meshStandardMaterial color={SLAB_COLOUR} roughness={0.8} />
      </mesh>
      {/* Right Slab - Corridor area (Inner) - cut off at z=5.0 for stairs */}
      <mesh position={[3.5, -SLAB_THICKNESS / 2, 1.25]} receiveShadow userData={{ walkable: true }}>
        <boxGeometry args={[2.0, SLAB_THICKNESS, 7.5]} />
        <meshStandardMaterial color={SLAB_COLOUR} roughness={0.8} />
      </mesh>

      {/* Floor 1 Stair Void Base */}
      {floorNumber === 1 && (
        <>
          <mesh position={[-3.5, -SLAB_THICKNESS / 2, 6.25]} receiveShadow userData={{ walkable: true }}>
            <boxGeometry args={[2.0, SLAB_THICKNESS, 2.5]} />
            <meshStandardMaterial color={SLAB_COLOUR} roughness={0.8} />
          </mesh>
          <mesh position={[3.5, -SLAB_THICKNESS / 2, 6.25]} receiveShadow userData={{ walkable: true }}>
            <boxGeometry args={[2.0, SLAB_THICKNESS, 2.5]} />
            <meshStandardMaterial color={SLAB_COLOUR} roughness={0.8} />
          </mesh>
        </>
      )}

      <BuildingWing height={ROOM_HEIGHT} />
      <Corridor height={ROOM_HEIGHT} />

      {/* Integrated Stairs Cores at the ends of corridors */}
      {floorNumber < 3 && (
        <>
          <Stairs position={[-3.5, 0, 5.0]} rotation={[0, 0, 0]} />
          <Stairs position={[3.5, 0, 5.0]} rotation={[0, 0, 0]} />
        </>
      )}

      {/* Rooms */}
      {floorRooms.map((room, index) => {
        const { x, z, rot, visualW, visualD } = getRoomTransform(index, floorRooms.length);
        return (
          <group key={room.id} position={[x, 0, z]} rotation={[0, rot, 0]}>
            <Room
              room={{ ...room, visualW, visualD }}
              selectedTime={selectedTime}
              isSelected={selectedRoom === room.id}
              isTargeted={hoveredRoom === room.id}
              onSelect={onSelectRoom}
            />
          </group>
        );
      })}
    </group>
  );
}

export { FLOOR_HEIGHT, ROOM_HEIGHT };

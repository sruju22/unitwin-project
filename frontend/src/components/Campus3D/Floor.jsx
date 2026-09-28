import React from 'react';
import Room from './Room';
import Corridors from './Corridors';
import StructureShell from './StructureShell';
import SouthBumpOut from './SouthBumpOut';
import { L } from './LayoutConstants';
import { ROOMS } from '../../data/cblockData';

export function getRoomTransform(index, total, floorRooms) {
  const room = floorRooms[index];
  const side = room.side; // 'left' or 'right'
  const col = room.col;   // 0, 1, 2, 3, 4, 5
  
  // Dimensions for visual rooms inside our new geometry
  const visualD = L.ROOM_DEPTH - 0.6; // strictly inside the walls
  const visualW = 5.5; // match spacing exactly to form continuous flush blocks
  
  let x, z, rot;
  
  if (side === 'left') {
    // West Wing (Left)
    rot = Math.PI / 2; // Door faces +X
    x = L.WEST_X - L.CORRIDOR_WIDTH/2 - L.ROOM_DEPTH / 2;
    z = L.NORTH_Z + L.CORRIDOR_WIDTH + 2.0 + (col * 5.5); 
  } else {
    // East Wing (Right)
    rot = -Math.PI / 2; // Door faces -X
    x = L.EAST_X + L.CORRIDOR_WIDTH/2 + L.ROOM_DEPTH / 2;
    z = L.NORTH_Z + L.CORRIDOR_WIDTH + 2.0 + (col * 5.5);
  }

  // Ensure they don't go out of bounds
  if (z > L.COURTYARD_Z) {
    z = L.COURTYARD_Z - 2.0;
  }

  return { x, z, rot, visualW, visualD };
}

export default function Floor({ floorNumber, selectedTime, selectedRoom, hoveredRoom, onSelectRoom }) {
  const floorRooms = ROOMS.filter((r) => r.floor === floorNumber);
  const yOffset = (floorNumber) * L.FLOOR_HEIGHT; // Floor 1 is at y=4.0

  return (
    <group>
      <Corridors yOffset={yOffset} />
      <StructureShell yOffset={yOffset} />
      <SouthBumpOut yOffset={yOffset} isGround={false} />

      {/* Rooms */}
      <group position={[0, yOffset, 0]}>
        {floorRooms.map((room, index) => {
          const { x, z, rot, visualW, visualD } = getRoomTransform(index, floorRooms.length, floorRooms);
          return (
            <group key={room.id} position={[x, 0, z]} rotation={[0, rot, 0]}>
              <Room
                room={{ ...room, visualW, visualD, visualH: L.FLOOR_HEIGHT - 0.2 }}
                selectedTime={selectedTime}
                isSelected={selectedRoom === room.id}
                isTargeted={hoveredRoom === room.id}
                onSelect={onSelectRoom}
              />
            </group>
          );
        })}
      </group>
    </group>
  );
}

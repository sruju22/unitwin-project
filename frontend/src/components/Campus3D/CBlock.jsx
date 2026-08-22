import { Html } from '@react-three/drei';
import Floor, { FLOOR_HEIGHT } from './Floor';
import Courtyard from './Courtyard';
import * as THREE from 'three';

const SLAB_THICKNESS = 0.08;
const SLAB_COLOUR = new THREE.Color('#d0c4b8');

export default function CBlock({ selectedTime, selectedRoom, hoveredRoom, onSelectRoom }) {
  const roofY = 3 * FLOOR_HEIGHT;

  return (
    <group position={[0, 0, -1]}>
      <Courtyard />
      
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
            position={[-5.8, (floorNum - 1) * FLOOR_HEIGHT + 0.4, -2.0]}
            center
            distanceFactor={16}
            style={{ pointerEvents: 'none' }}
          >
            <div style={{
              color: '#8892b0',
              fontSize: '11px',
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.08)',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}>
              F{floorNum}
            </div>
          </Html>
        </group>
      ))}

      {/* Roof Slab */}
      <group position={[0, roofY, 0]}>
        {/* Left Slab */}
        <mesh position={[-4.75, -SLAB_THICKNESS / 2, 2.5]} receiveShadow castShadow>
          <boxGeometry args={[4.5, SLAB_THICKNESS, 10.0]} />
          <meshStandardMaterial color={SLAB_COLOUR} roughness={0.8} />
        </mesh>
        {/* Center Slab */}
        <mesh position={[0, -SLAB_THICKNESS / 2, -4.75]} receiveShadow castShadow>
          <boxGeometry args={[14.0, SLAB_THICKNESS, 4.5]} />
          <meshStandardMaterial color={SLAB_COLOUR} roughness={0.8} />
        </mesh>
        {/* Right Slab */}
        <mesh position={[4.75, -SLAB_THICKNESS / 2, 2.5]} receiveShadow castShadow>
          <boxGeometry args={[4.5, SLAB_THICKNESS, 10.0]} />
          <meshStandardMaterial color={SLAB_COLOUR} roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

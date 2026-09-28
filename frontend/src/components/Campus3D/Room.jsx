import { useState, useRef, useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { getRoomOccupancy } from '../../data/cblockData';
import { CREAM_WALL_MAT } from './materials';

const LEVEL_COLOURS = {
  low:      new THREE.Color('#2979ff'),
  moderate: new THREE.Color('#ffb547'),
  high:     new THREE.Color('#ff4f6d'),
  nodata:   new THREE.Color('#3a3f55'),
};

const SELECTED_EMISSIVE = new THREE.Color('#ffffff');

export default function Room({ room, selectedTime, isSelected, isTargeted, onSelect }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  const occupancy = useMemo(
    () => getRoomOccupancy(room.id, selectedTime),
    [room.id, selectedTime],
  );

  const level = occupancy ? occupancy.level : 'nodata';
  const dataColour = LEVEL_COLOURS[level];
  
  // Highlight overlay
  const overlayOpacity = isSelected ? 0.8 : (hovered || isTargeted) ? 0.4 : occupancy ? 0.15 : 0;
  
  const eps = 0.05;
  const w = room.visualW;
  const d = room.visualD;
  const h = room.visualH;

  return (
    <group position={[0, h / 2, 0]}>
      {/* Base Solid Mesh */}
      <mesh castShadow receiveShadow userData={{ roomId: room.id }}>
        <boxGeometry args={[w - 0.1, h, d - 0.1]} />
        <primitive object={CREAM_WALL_MAT} attach="material" />
      </mesh>

      {/* Interactive Highlight Mesh */}
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onSelect(room.id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
        userData={{ roomId: room.id }}
      >
        <boxGeometry args={[w, h + eps, d]} />
        <meshStandardMaterial
          color={dataColour}
          transparent
          opacity={overlayOpacity}
          emissive={isSelected ? SELECTED_EMISSIVE : (isTargeted ? new THREE.Color('#ffffff') : dataColour)}
          emissiveIntensity={isSelected ? 0.4 : (isTargeted ? 0.3 : hovered ? 0.2 : 0)}
          depthWrite={true}
        />
        
        {(isSelected || isTargeted) && (
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(w, h + eps, d)]} />
            <lineBasicMaterial color="#ffffff" transparent opacity={isSelected ? 0.8 : 0.4} />
          </lineSegments>
        )}
      </mesh>

      {/* Door (facing the corridor, i.e. +Z locally) */}
      <mesh position={[w * 0.3, -h/2 + 1.2, d/2 + eps]} userData={{ roomId: room.id }}>
        <boxGeometry args={[1.2, 2.4, 0.1]} />
        <meshStandardMaterial color="#302319" />
      </mesh>

      {/* Window */}
      <mesh position={[-w * 0.2, -h/2 + 1.5, d/2 + eps]} userData={{ roomId: room.id }}>
        <boxGeometry args={[2.0, 1.2, 0.1]} />
        <meshStandardMaterial color="#88ccff" transparent opacity={0.5} />
      </mesh>

      {/* Door Label */}
      <Html
        position={[w * 0.3, -h/2 + 2.8, d/2 + 0.1]}
        center
        distanceFactor={20}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          background: 'rgba(0, 0, 0, 0.75)',
          color: '#ffffff',
          fontSize: '12px',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 700,
          padding: '2px 4px',
          borderRadius: '2px',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}>
          {room.id}
        </div>
      </Html>
    </group>
  );
}

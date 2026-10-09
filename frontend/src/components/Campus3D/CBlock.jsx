<<<<<<< Updated upstream
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
=======
import React, { useMemo, Suspense } from 'react';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';

// ============================================================================
// MATERIAL DEFINITIONS
// Matching the C Block's actual appearance from aerial reference:
//   - Weathered salmon/peach concrete walls
//   - Cream-coloured auditorium roof (octagonal)
//   - Green courtyard lawn
//   - Dark blue solar panels
//   - Light concrete rooftop surfaces
// ============================================================================

const MATERIALS = {
  wall: () => new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c8a882'),
    roughness: 0.85,
    metalness: 0.03,
    side: THREE.DoubleSide,
  }),
  auditoriumRoof: () => new THREE.MeshStandardMaterial({
    color: new THREE.Color('#dfd9b8'),
    roughness: 0.45,
    metalness: 0.08,
    side: THREE.DoubleSide,
  }),
  courtyard: () => new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3a7a28'),
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.FrontSide,
  }),
  fountain: () => new THREE.MeshStandardMaterial({
    color: new THREE.Color('#8ab4c2'),
    roughness: 0.4,
    metalness: 0.15,
    side: THREE.DoubleSide,
  }),
  solar: () => new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0d1a35'),
    roughness: 0.18,
    metalness: 0.65,
    side: THREE.FrontSide,
  }),
  roofSurface: () => new THREE.MeshStandardMaterial({
    color: new THREE.Color('#b8b0a0'),
    roughness: 0.9,
    metalness: 0.01,
    side: THREE.DoubleSide,
  }),
};

// Map named GLB nodes → material factory
const NODE_MATERIAL_MAP = {
  'Auditorium':         'auditoriumRoof',
  'Courtyard':          'courtyard',
  'Fountain':           'fountain',
  'SolarPanels':        'solar',
  'RoofEquipment':      'roofSurface',
  // All wing/corridor nodes get wall material
  'NorthWing':          'wall',
  'NWCorner':           'wall',
  'NECorner':           'wall',
  'WestWing':           'wall',
  'EastWing':           'wall',
  'SouthWing':          'wall',
  'ConnectingCorridor': 'wall',
};

function CBlockModel() {
  // Load the RECONSTRUCTED model built from references
  const { scene } = useGLTF('/cblock_reconstructed.glb');

  const transform = useMemo(() => {
    // Reset transforms before measuring
    scene.scale.set(1, 1, 1);
    scene.position.set(0, 0, 0);
    scene.rotation.set(0, 0, 0);
    scene.updateMatrixWorld(true);

    // Pre-build materials
    const matCache = {};
    const getMat = (key) => {
      if (!matCache[key]) matCache[key] = MATERIALS[key]();
      return matCache[key];
    };

    // Apply materials based on node names
    scene.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow    = true;
      child.receiveShadow = true;

      // Walk up to find a named parent node
      let node = child;
      let nodeName = '';
      while (node) {
        if (node.name && NODE_MATERIAL_MAP[node.name]) {
          nodeName = node.name;
          break;
        }
        node = node.parent;
      }

      const matKey = NODE_MATERIAL_MAP[nodeName] || 'wall';
      child.material = getMat(matKey);
    });

    // Compute bounding box for scene framing
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Normalize to ~60 scene units (campus grid scale)
    const TARGET = 60.0;
    const maxDim = Math.max(size.x, size.z);  // footprint dominant dimension
    const sf = (maxDim > 0 && isFinite(maxDim)) ? TARGET / maxDim : 0.47;

    return {
      scale:    [sf, sf, sf],
      position: [-center.x * sf, -box.min.y * sf, -center.z * sf],
    };
  }, [scene]);

  return (
    <primitive
      object={scene}
      position={transform.position}
      scale={transform.scale}
    />
  );
}

useGLTF.preload('/cblock_reconstructed.glb');

function LoadingFallback() {
  return (
    <Html center style={{ pointerEvents: 'none' }}>
      <div style={{
        color: '#00e5ff',
        background: 'rgba(11,13,20,0.88)',
        border: '1px solid rgba(0,229,255,0.4)',
        padding: '10px 18px',
        borderRadius: '8px',
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: '13px',
        fontWeight: 700,
        letterSpacing: '0.5px',
        whiteSpace: 'nowrap',
      }}>
        Loading C Block 3D Model...
      </div>
    </Html>
  );
}

// ============================================================================
// MAIN EXPORT — Phase 1 Reconstructed C Block
// ============================================================================
export default function CBlock() {
  return (
    <group>
      <Suspense fallback={<LoadingFallback />}>
        <CBlockModel />
      </Suspense>
>>>>>>> Stashed changes
    </group>
  );
}

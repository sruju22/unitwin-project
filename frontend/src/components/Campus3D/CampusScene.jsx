import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import CBlock from './CBlock';
import Player from './Player';

export default function CampusScene({ selectedTime, selectedRoom, onSelectRoom, exploreMode }) {
  const [hoveredRoomId, setHoveredRoomId] = useState(null);

  return (
    <Canvas
      camera={{
        position: exploreMode ? [0, 4.8, 10] : [35, 30, 45],
        fov: 45,
        near: 0.1,
        far: 500,
      }}
      shadows
      style={{ background: 'transparent' }}
      onPointerMissed={() => {
        if (!exploreMode) onSelectRoom(null);
      }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[20, 40, 20]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={150}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <directionalLight position={[-15, 10, -10]} intensity={0.3} />
      <hemisphereLight
        args={['#1a1f33', '#0b0d14', 0.4]}
      />

      {/* Ground grid */}
      <Grid
        position={[0, -0.01, 0]}
        args={[100, 100]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1a2540"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#2a3560"
        fadeDistance={80}
        fadeStrength={1.5}
        infiniteGrid
      />

      <fog attach="fog" args={['#0b0d14', 50, 150]} />

      <CBlock
        selectedTime={selectedTime}
        selectedRoom={selectedRoom}
        hoveredRoom={hoveredRoomId}
        onSelectRoom={onSelectRoom}
      />

      {exploreMode ? (
        <Player onInteract={onSelectRoom} onHover={setHoveredRoomId} hoveredRoomId={hoveredRoomId} />
      ) : (
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={10}
          maxDistance={120}
          target={[0, 4, 0]}
        />
      )}
    </Canvas>
  );
}

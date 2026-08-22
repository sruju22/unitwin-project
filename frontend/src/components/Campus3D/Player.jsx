import { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { usePlayerControls } from './usePlayerControls';
import { ROOMS } from '../../data/cblockData';

const SPEED = 3.5;

export default function Player({ onInteract, onHover, hoveredRoomId }) {
  const { camera, scene } = useThree();
  const controls = usePlayerControls();
  const controlsRef = useRef();

  useEffect(() => {
    // Start slightly above Floor 1 in the corridor
    camera.position.set(0, 0.8, -3.5);
    camera.lookAt(0, 0.8, 0);
  }, [camera]);

  useFrame((state, delta) => {
    if (!controlsRef.current?.isLocked) return;

    // Movement speeds
    const forwardSpeed = (controls.forward ? 1 : 0) - (controls.backward ? 1 : 0);
    const rightSpeed = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);

    const moveDistance = SPEED * delta;

    // Get camera's forward direction on XZ plane
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    // Get camera's right direction
    const right = new THREE.Vector3();
    right.copy(forward).cross(camera.up).normalize();

    // Calculate intended velocity
    const velocity = new THREE.Vector3()
      .addScaledVector(forward, forwardSpeed)
      .addScaledVector(right, rightSpeed);

    if (velocity.lengthSq() > 0) {
      velocity.normalize().multiplyScalar(moveDistance);
    }

    const nextPos = camera.position.clone().add(velocity);

    // Prevent walking completely out of the building bounds (X/Z clamp)
    if (nextPos.x < -8.0) nextPos.x = -8.0;
    if (nextPos.x > 8.0) nextPos.x = 8.0;
    if (nextPos.z < -8.0) nextPos.z = -8.0;
    if (nextPos.z > 8.0) nextPos.z = 8.0;

    // --- Vertical Collision via Raycast ---
    const collisionRaycaster = new THREE.Raycaster(
      new THREE.Vector3(nextPos.x, nextPos.y + 2.0, nextPos.z),
      new THREE.Vector3(0, -1, 0),
      0,
      10
    );

    const floorIntersects = collisionRaycaster.intersectObjects(scene.children, true);
    
    let highestWalkableY = null;
    for (let i = 0; i < floorIntersects.length; i++) {
      if (floorIntersects[i].object.userData?.walkable) {
        highestWalkableY = floorIntersects[i].point.y;
        break; // First one is the highest because ray is going down
      }
    }

    // Apply movement if we didn't walk off the edge of the world
    if (highestWalkableY !== null) {
      camera.position.set(nextPos.x, highestWalkableY + 0.8, nextPos.z);
    }

    // --- Crosshair Hover Raycast ---
    const hoverRaycaster = new THREE.Raycaster();
    hoverRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hoverIntersects = hoverRaycaster.intersectObjects(scene.children, true);
    
    let foundRoomId = null;
    for (let i = 0; i < hoverIntersects.length; i++) {
      let obj = hoverIntersects[i].object;
      while (obj) {
        if (obj.userData?.roomId) {
          foundRoomId = obj.userData.roomId;
          break;
        }
        obj = obj.parent;
      }
      if (foundRoomId) break;
    }
    
    if (foundRoomId !== hoveredRoomId) {
      onHover(foundRoomId);
    }
  });

  useEffect(() => {
    const handleMouseDown = (e) => {
      // Only interact if pointer is locked
      if (document.pointerLockElement !== document.body) return;
      
      if (hoveredRoomId) {
        onInteract(hoveredRoomId);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [hoveredRoomId, onInteract]);

  const targetedRoom = hoveredRoomId ? ROOMS.find(r => r.id === hoveredRoomId) : null;

  return (
    <>
      <PointerLockControls ref={controlsRef} />
      {/* Crosshair */}
      <mesh position={[0, 0, -0.2]} renderOrder={999}>
        <ringGeometry args={hoveredRoomId ? [0.003, 0.005, 16] : [0.002, 0.003, 16]} />
        <meshBasicMaterial color={hoveredRoomId ? "#00e5ff" : "white"} depthTest={false} depthWrite={false} transparent opacity={0.8} />
        
        {targetedRoom && (
          <Html position={[0, -0.015, 0]} center style={{ pointerEvents: 'none' }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              borderRadius: '6px',
              padding: '6px 10px',
              color: 'white',
              fontFamily: "'Space Grotesk', sans-serif",
              whiteSpace: 'nowrap',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)'
            }}>
              <strong style={{ fontSize: '14px', color: '#00e5ff' }}>{targetedRoom.id}</strong>
              <span style={{ fontSize: '11px', color: '#cbd5e1' }}>{targetedRoom.label}</span>
              <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Click to inspect</span>
            </div>
          </Html>
        )}
      </mesh>
    </>
  );
}

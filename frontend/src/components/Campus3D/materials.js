import * as THREE from 'three';

export function createWeatheredMaterial(baseColorHex, dirtColorHex, isWall = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Base color
  ctx.fillStyle = baseColorHex;
  ctx.fillRect(0, 0, 1024, 1024);

  // Add noise/weathering (faded paint, dirt)
  for (let i = 0; i < 20000; i++) {
    ctx.fillStyle = dirtColorHex;
    ctx.globalAlpha = Math.random() * 0.1;
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const w = Math.random() * 15 + 2;
    const h = Math.random() * 15 + 2;
    ctx.fillRect(x, y, w, h);
  }

  if (isWall) {
    // Add vertical streaks (water drips)
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = '#4a3f3b';
      ctx.globalAlpha = Math.random() * 0.15;
      const x = Math.random() * 1024;
      const y = 0;
      const w = Math.random() * 10 + 2;
      const h = Math.random() * 600 + 50;
      ctx.fillRect(x, y, w, h);
    }
    
    // Bottom grime
    const gradient = ctx.createLinearGradient(0, 800, 0, 1024);
    gradient.addColorStop(0, 'rgba(60, 50, 45, 0)');
    gradient.addColorStop(1, 'rgba(60, 50, 45, 0.4)');
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 1.0;
    ctx.fillRect(0, 800, 1024, 224);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.95,
    metalness: 0.05
  });
}

// Realistic materials based on photos
export const PINK_WALL_MAT = createWeatheredMaterial('#e8af9e', '#ba7f6e', true);
export const CREAM_WALL_MAT = createWeatheredMaterial('#e6ddc5', '#c2b697', true);
export const CONCRETE_MAT = createWeatheredMaterial('#918e8a', '#63605c', false);
export const FLOOR_TILE_MAT = createWeatheredMaterial('#757a77', '#4b524e', false);
export const ROOF_MAT = createWeatheredMaterial('#a3a09c', '#504f4e', false);


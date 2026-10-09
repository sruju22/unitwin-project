import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './CampusMap.module.css';

export default function CampusMap({ interactive = true, onSelectBlock }) {
  const viewportRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const isDragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Automatic camera pausing logic removed for continuous subtle drone animation

  // 1. Observe the actual size of the map viewport dynamically
  useEffect(() => {
    if (!viewportRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        // Ignore zero-dimension renders during initial React/CSS layout
        if (width > 0 && height > 0) {
          setViewportSize({ width, height });
        }
      }
    });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  // 2. Constraints helper: prevents dragging or zooming into black space
  const applyConstraints = useCallback((newX, newY, newScale, vWidth, vHeight) => {
    const imgWidth = 1538;
    const imgHeight = 1022;
    
    // Calculate the absolute minimum scale required to cover the viewport
    const baseMinScale = Math.max(vWidth / imgWidth, vHeight / imgHeight);
    
    // Apply a 5% overscan factor. This forces the image to be slightly larger than the viewport,
    // which prevents the CSS rotation/drift animation from revealing black corners.
    const overscanFactor = 1.05;
    const minScale = baseMinScale * overscanFactor;
    
    // Clamp the scale so the user can never zoom out smaller than the overscanned bounds
    const clampedScale = Math.max(minScale, Math.min(newScale, 5));
    
    // Reserve 2% of the overscan as a dead-zone margin that the user cannot pan past.
    // This physically reserves pixels off-screen so the live camera drift can safely move into them.
    const marginX = (imgWidth * clampedScale) * 0.02;
    const marginY = (imgHeight * clampedScale) * 0.02;
    
    const maxX = -marginX;
    const minX = vWidth - (imgWidth * clampedScale) + marginX;
    
    const maxY = -marginY;
    const minY = vHeight - (imgHeight * clampedScale) + marginY;
    
    // Clamp X and Y translation coordinates
    let finalX = Math.max(minX, Math.min(newX, maxX));
    let finalY = Math.max(minY, Math.min(newY, maxY));
    
    // Failsafe for mathematically inverted bounds (shouldn't happen with proper clamping)
    if (minX > maxX) finalX = (vWidth - imgWidth * clampedScale) / 2;
    if (minY > maxY) finalY = (vHeight - imgHeight * clampedScale) / 2;
    
    return { x: finalX, y: finalY, scale: clampedScale };
  }, []);

  // 3. Center on mount and constantly re-constrain when window resizes
  useEffect(() => {
    if (viewportSize.width === 0) return;
    
    if (!isInitialized) {
      const imgWidth = 1538;
      const imgHeight = 1022;
      const baseScale = Math.max(viewportSize.width / imgWidth, viewportSize.height / imgHeight);
      const initialScale = baseScale * 1.05;
      const cx = (viewportSize.width - imgWidth * initialScale) / 2;
      const cy = (viewportSize.height - imgHeight * initialScale) / 2;
      
      setTransform({ x: cx, y: cy, scale: initialScale });
      setIsInitialized(true);
    } else {
      // Re-apply constraints securely if the user resizes the window
      setTransform(prev => applyConstraints(prev.x, prev.y, prev.scale, viewportSize.width, viewportSize.height));
    }
  }, [viewportSize, isInitialized, applyConstraints]);

  // Handle smooth zooming via mouse wheel / trackpad
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e) => {
      if (!interactive) return;
      e.preventDefault(); // Stop page scroll
      
      
      setTransform((prev) => {
        const zoomSensitivity = 0.002;
        const delta = -e.deltaY * zoomSensitivity;
        const targetScale = prev.scale * Math.exp(delta);
        
        // Calculate minScale again here just for the focal point math
        const imgWidth = 1538;
        const imgHeight = 1022;
        const baseMinScale = Math.max(viewportSize.width / imgWidth, viewportSize.height / imgHeight);
        const minScale = baseMinScale * 1.05;
        const clampedScale = Math.max(minScale, Math.min(targetScale, 5));

        const rect = viewport.getBoundingClientRect();
        const pointerX = e.clientX - rect.left;
        const pointerY = e.clientY - rect.top;

        const x = pointerX - (pointerX - prev.x) * (clampedScale / prev.scale);
        const y = pointerY - (pointerY - prev.y) * (clampedScale / prev.scale);

        // Apply final constraints to prevent panning out of bounds during heavy zoom
        return applyConstraints(x, y, clampedScale, viewportSize.width, viewportSize.height);
      });
    };

    // Use a non-passive listener to reliably intercept the wheel event
    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [interactive, viewportSize, applyConstraints]);

  // Handle panning via click-and-drag
  const handlePointerDown = (e) => {
    if (!interactive || e.button !== 0) return;
    isDragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    
    setTransform((prev) => applyConstraints(prev.x + dx, prev.y + dy, prev.scale, viewportSize.width, viewportSize.height));
  };

  const handlePointerUp = (e) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Click handler for future building polygons
  const handlePolygonClick = (blockId, e) => {
    e.stopPropagation();
    if (interactive && onSelectBlock) {
      onSelectBlock(blockId);
    }
  };

  // --------------------------------------------------------------------------
  // Camera animation removed.
  // A true cinematic perspective effect cannot be achieved with a flat 2D image.
  // --------------------------------------------------------------------------

  return (
    <div 
      className={styles.viewport} 
      ref={viewportRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ visibility: isInitialized ? 'visible' : 'hidden' }}
    >
      <div 
        className={styles.mapContent} 
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
      >
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <img 
            src="/satellite.png" 
            alt="Campus Satellite Map" 
            className={styles.satelliteImage}
          />
          <svg viewBox="0 0 1538 1022" className={styles.svgOverlay}>
            <g id="building-polygons" onClick={(e) => handlePolygonClick('CBLOCK', e)}>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

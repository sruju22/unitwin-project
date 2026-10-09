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

  // 2. Constraints helper: keeps image properly framed and prevents dragging out of bounds
  const applyConstraints = useCallback((newX, newY, newScale, vWidth, vHeight) => {
    const imgWidth = 1538;
    const imgHeight = 1022;
    
    // fitToScreen scale: ensures the complete image (all boundaries and buildings) fits in the viewport
    const fitScale = Math.min(vWidth / imgWidth, vHeight / imgHeight);
    const minScale = fitScale;
    const maxScale = 5;
    
    const clampedScale = Math.max(minScale, Math.min(newScale, maxScale));
    const currentW = imgWidth * clampedScale;
    const currentH = imgHeight * clampedScale;
    
    let finalX;
    if (currentW <= vWidth) {
      // If image width fits within viewport, center it horizontally
      finalX = (vWidth - currentW) / 2;
    } else {
      // If zoomed in wider than viewport, clamp so user can pan between left and right edges
      const minX = vWidth - currentW;
      const maxX = 0;
      finalX = Math.max(minX, Math.min(newX, maxX));
    }
    
    let finalY;
    if (currentH <= vHeight) {
      // If image height fits within viewport, center it vertically
      finalY = (vHeight - currentH) / 2;
    } else {
      // If zoomed in taller than viewport, clamp so user can pan between top and bottom edges
      const minY = vHeight - currentH;
      const maxY = 0;
      finalY = Math.max(minY, Math.min(newY, maxY));
    }
    
    return { x: finalX, y: finalY, scale: clampedScale };
  }, []);

  // 3. Fit to screen on initial mount and constantly re-constrain when window resizes
  useEffect(() => {
    if (viewportSize.width === 0 || viewportSize.height === 0) return;
    
    const imgWidth = 1538;
    const imgHeight = 1022;
    const fitScale = Math.min(viewportSize.width / imgWidth, viewportSize.height / imgHeight);
    
    if (!isInitialized) {
      // Initial framing: fit entire image (including bottommost building and boundaries) within viewport
      const cx = (viewportSize.width - imgWidth * fitScale) / 2;
      const cy = (viewportSize.height - imgHeight * fitScale) / 2;
      
      setTransform({ x: cx, y: cy, scale: fitScale });
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
        
        const imgWidth = 1538;
        const imgHeight = 1022;
        const fitScale = Math.min(viewportSize.width / imgWidth, viewportSize.height / imgHeight);
        const clampedScale = Math.max(fitScale, Math.min(targetScale, 5));

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
      {/* Subtle optical camera lens vignette */}
      <div className={styles.lensVignette} aria-hidden="true" />

      <div 
        className={styles.mapContent} 
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
      >
        {/* Subtle, continuous drone hovering camera layer */}
        <div className={styles.droneCamera}>
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

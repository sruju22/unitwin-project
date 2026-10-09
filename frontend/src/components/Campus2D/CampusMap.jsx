import React, { useState } from 'react';
import styles from './CampusMap.module.css';

export default function CampusMap({ interactive = true, onSelectBlock }) {
  const [hovered, setHovered] = useState(false);

  const handleClick = () => {
    if (!interactive) return;
    if (onSelectBlock) {
      onSelectBlock('CBLOCK');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.mapWrapper}>
        {/* The ACTUAL SATELLITE IMAGE acts as the visual map background */}
        <img 
          src="/satellite_map.jpg" 
          alt="Campus Satellite Map" 
          className={styles.satelliteImage}
        />
        
        {/* Transparent Interactive Overlay */}
        <svg 
          viewBox="0 0 1024 661" 
          className={styles.svgOverlay}
        >
          {/* 
            Transparent SVG Path acting as the interaction layer for C BLOCK.
            The coordinates accurately wrap the Auditorium and the main U-shaped C-Block wing,
            with a hole cut out for the inner courtyard (using fillRule="evenodd").
          */}
          <path
            d="M 310,380 L 340,330 L 410,300 L 470,330 L 590,370 L 610,380 L 550,580 L 410,530 L 370,470 L 370,440 Z M 460,380 L 560,410 L 520,540 L 420,510 Z"
            fillRule="evenodd"
            className={`${styles.hotspot} ${hovered ? styles.hotspotHover : ''}`}
            onMouseEnter={() => { if (interactive) setHovered(true); }}
            onMouseLeave={() => { if (interactive) setHovered(false); }}
            onClick={handleClick}
          >
            <title>C Block & Auditorium</title>
          </path>
        </svg>
      </div>
    </div>
  );
}

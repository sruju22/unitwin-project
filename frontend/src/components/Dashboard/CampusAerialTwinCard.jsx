import { useState } from 'react';
import styles from './CampusAerialTwinCard.module.css';

export default function CampusAerialTwinCard({
  buildingCount = 10,
  dbConnected = true,
  onNavigateToCampus,
}) {
  const [imageError, setImageError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);

  return (
    <div className={styles.card}>
      {/* Top Header */}
      <div className={styles.cardHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.liveBeacon} />
          <div>
            <h3 className={styles.title}>Campus Overview</h3>
            <p className={styles.subtitle}>Continuous aerial survey of campus grounds</p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className={styles.playbackBtn}
            id="dashboard-aerial-playback-btn"
            title={isPlaying ? 'Pause drone survey animation' : 'Resume drone survey animation'}
            aria-label={isPlaying ? 'Pause survey' : 'Resume survey'}
          >
            {isPlaying ? (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="5" y="4" width="4" height="16" rx="1" />
                  <rect x="15" y="4" width="4" height="16" rx="1" />
                </svg>
                <span>Pause</span>
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6 4 20 12 6 20 6 4" />
                </svg>
                <span>Resume</span>
              </>
            )}
          </button>

          <button
            onClick={onNavigateToCampus}
            className={styles.exploreBtn}
            id="dashboard-aerial-explore-btn"
            title="Open interactive Campus Map"
          >
            <span>Explore Campus</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>

      {/* Clean Aerial Viewport Container */}
      <div className={styles.viewport}>
        {/* Subtle camera lens vignette and bottom readability gradient */}
        <div className={styles.lensVignette} aria-hidden="true" />

        {/* Satellite Imagery Layer with Smooth Continuous Drone Survey */}
        {!imageError ? (
          <div className={`${styles.satelliteStage} ${!isPlaying ? styles.paused : ''}`}>
            <img
              src="/satellite.png"
              alt="Campus Aerial Satellite Survey"
              className={styles.satelliteImage}
              onError={() => setImageError(true)}
            />
          </div>
        ) : (
          <div className={styles.imageFallback}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <polygon points="3 9 12 2 21 9 21 20 3 20" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Satellite Digital Twin Active</span>
          </div>
        )}

        {/* Verified Glass Status Chips */}
        <div className={styles.chipsOverlay}>
          <div className={styles.glassChip}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2">
              <polygon points="3 9 12 2 21 9 21 20 3 20" />
              <polyline points="9 22 9 12 12 19" />
            </svg>
            <span>{buildingCount} Mapped Buildings</span>
          </div>

          <div className={styles.glassChip}>
            <span className={styles.chipDot} />
            <span>{dbConnected ? 'Database Live' : 'Awaiting Connection'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

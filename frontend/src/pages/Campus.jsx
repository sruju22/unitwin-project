import CampusMap from '../components/Campus2D/CampusMap';
import styles from './Campus.module.css';

export default function Campus() {
  return (
    <div className={styles.page}>
      {/* Top bar with atmospheric status metadata */}
      <div className={styles.topBar}>
        <div className={styles.buildingLabel}>
          <h2 className={styles.blockName}>Campus Digital Twin</h2>
          <span className={styles.blockSub}>2D Aerial Orthophoto &amp; Spatial Survey</span>
          <span className={styles.liveTag}>
            <span className={styles.liveDot} />
            Live Map
          </span>
        </div>

        <div className={styles.topChips}>
          <div className={styles.glassChip}>
            <span>Footprints:</span>
            <strong>10 Monitored</strong>
          </div>
          <div className={styles.glassChip}>
            <span>Resolution:</span>
            <strong>Sub-meter Ortho</strong>
          </div>
        </div>
      </div>

      {/* Main content: Dedicated full-screen 2D Campus Map with floating HUD */}
      <div className={styles.content}>
        <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
          <CampusMap interactive={true} />

          {/* Non-obstructing corner HUD labels */}
          <div className={styles.mapHud} aria-hidden="true">
            <div className={styles.hudItem}>
              Survey Altitude: <span>120m AGL</span>
            </div>
            <div className={styles.hudItem}>
              Projection: <span>Orthographic</span>
            </div>
            <div className={styles.hudItem}>
              Sensor Ingestion: <span>Standby</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

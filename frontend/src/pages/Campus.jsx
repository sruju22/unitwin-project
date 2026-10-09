import { useState } from 'react';
import { BUILDING_INFO } from '../data/cblockData';
import CampusMap from '../components/Campus2D/CampusMap';
import RoomInfoPanel from '../components/Campus3D/RoomInfoPanel';
import styles from './Campus.module.css';

export default function Campus() {
  const [showPanel, setShowPanel] = useState(false);

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.buildingLabel}>
          <h2 className={styles.blockName}>{BUILDING_INFO.label}</h2>
          <span className={styles.blockSub}>{BUILDING_INFO.name}</span>
        </div>
      </div>

      {/* Main content: 2D Campus Map & Panel */}
      <div className={styles.content}>
        <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
          <CampusMap 
            interactive={true} 
            onSelectBlock={(blockId) => {
              if (blockId === 'CBLOCK') {
                setShowPanel(true);
              }
            }} 
          />
        </div>

        {/* Show the existing C BLOCK information panel when clicked */}
        {showPanel && (
          <RoomInfoPanel
            selectedRoom={null} /* Shows building summary when null */
            selectedTime="10:00" /* Default time */
          />
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import CampusScene from '../components/Campus3D/CampusScene';
import RoomInfoPanel from '../components/Campus3D/RoomInfoPanel';
import OccupancyLegend from '../components/Campus3D/OccupancyLegend';
import TimeSelector from '../components/Campus3D/TimeSelector';
import { BUILDING_INFO, TIME_SLOTS } from '../data/cblockData';
import styles from './Campus.module.css';

export default function Campus() {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedTime, setSelectedTime] = useState('10:00');
  const [exploreMode, setExploreMode] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if typing in an input
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight') {
        setSelectedTime(prev => {
          const idx = TIME_SLOTS.indexOf(prev);
          if (idx < TIME_SLOTS.length - 1) return TIME_SLOTS[idx + 1];
          return prev;
        });
      } else if (e.key === 'ArrowLeft') {
        setSelectedTime(prev => {
          const idx = TIME_SLOTS.indexOf(prev);
          if (idx > 0) return TIME_SLOTS[idx - 1];
          return prev;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.buildingLabel}>
          <h2 className={styles.blockName}>{BUILDING_INFO.label}</h2>
          <span className={styles.blockSub}>{BUILDING_INFO.name}</span>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button 
            className={styles.exploreBtn}
            onClick={() => setExploreMode(!exploreMode)}
            style={{
              padding: '8px 16px',
              background: exploreMode ? '#00e5ff' : 'transparent',
              color: exploreMode ? '#0b0d14' : '#00e5ff',
              border: '1px solid #00e5ff',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontFamily: "'Space Grotesk', sans-serif"
            }}
          >
            {exploreMode ? 'EXIT EXPLORE MODE' : 'ENTER EXPLORE MODE'}
          </button>
          <TimeSelector selectedTime={selectedTime} onChange={setSelectedTime} />
        </div>
      </div>

      {/* Main content: 3D scene + info panel */}
      <div className={styles.content}>
        <div className={styles.sceneWrap}>
          {exploreMode && (
            <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, color: '#e2e8f0', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid #1e293b', padding: '16px', borderRadius: '8px', pointerEvents: 'none', fontFamily: "'Space Grotesk', sans-serif", width: '260px' }}>
              <div style={{ borderBottom: '1px solid #334155', paddingBottom: '8px', marginBottom: '8px' }}>
                <strong style={{ color: '#00e5ff', letterSpacing: '1px' }}>EXPLORE MODE</strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span><strong>W A S D</strong></span> <span>Move</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span><strong>Mouse</strong></span> <span>Look</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span><strong>← →</strong></span> <span>Change Time</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span><strong>Click</strong></span> <span>Inspect Room</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span><strong>ESC</strong></span> <span style={{color: '#94a3b8'}}>Exit Explore Mode</span></div>
              </div>
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #334155', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>CURRENT TIME</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>{selectedTime}</div>
                <div style={{ fontSize: '11px', color: '#00e5ff', display: 'flex', justifyContent: 'space-between', padding: '0 10px' }}>
                  <span>← Previous</span>
                  <span>Next →</span>
                </div>
              </div>
            </div>
          )}
          <CampusScene
            selectedTime={selectedTime}
            selectedRoom={selectedRoom}
            onSelectRoom={setSelectedRoom}
            exploreMode={exploreMode}
          />
          <OccupancyLegend />
        </div>

        <RoomInfoPanel
          selectedRoom={selectedRoom}
          selectedTime={selectedTime}
        />
      </div>
    </div>
  );
}

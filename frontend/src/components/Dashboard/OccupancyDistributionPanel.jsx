import { useState, useMemo } from 'react';
import { ROOMS, OCCUPANCY_DATA, BUILDING_INFO } from '../../data/cblockData';
import styles from './OccupancyDistributionPanel.module.css';

// Campus building health matrix
const BUILDINGS = [
  { id: 'b1', code: 'C-BLOCK', name: 'Academic Building 1', type: 'Academic', occupancy: 88, status: 'nominal', sensors: 25, activeAlerts: 1 },
  { id: 'b2', code: 'LIB-01', name: 'Central University Library', type: 'Study', occupancy: 94, status: 'warning', sensors: 18, activeAlerts: 1 },
  { id: 'b3', code: 'SCI-02', name: 'Science & Research Labs', type: 'Research', occupancy: 56, status: 'nominal', sensors: 20, activeAlerts: 0 },
  { id: 'b4', code: 'ENG-04', name: 'Mechanical & CAED Labs', type: 'Workshop', occupancy: 40, status: 'maintenance', sensors: 14, activeAlerts: 1 },
  { id: 'b5', code: 'ADM-01', name: 'Administrative Center', type: 'Admin', occupancy: 62, status: 'nominal', sensors: 16, activeAlerts: 0 },
];

export default function OccupancyDistributionPanel({ onNavigateToCampus }) {
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [selectedTimeSlot] = useState('10:00'); // Peak hour reference

  // Calculate real metrics for selected floor from cblockData.js
  const floorStats = useMemo(() => {
    const floorRooms = ROOMS.filter(r => r.floor === selectedFloor);
    let current = 0;
    let capacity = 0;
    const roomDetails = [];

    floorRooms.forEach(room => {
      const data = OCCUPANCY_DATA[room.id]?.[selectedTimeSlot];
      if (data) {
        current += data.current;
        capacity += data.capacity;
        const util = Math.round((data.current / data.capacity) * 100);
        roomDetails.push({
          id: room.id,
          label: room.label,
          type: room.type,
          current: data.current,
          capacity: data.capacity,
          utilization: util,
        });
      }
    });

    const utilRate = capacity > 0 ? Math.round((current / capacity) * 100) : 0;
    return { current, capacity, utilRate, roomDetails, totalRooms: floorRooms.length };
  }, [selectedFloor, selectedTimeSlot]);

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.iconChip}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <h3 className={styles.title}>Campus Occupancy & Building Health</h3>
            <p className={styles.subtitle}>Multi-facility utilization density and real-time telemetry distribution</p>
          </div>
        </div>

        {/* Action Button to Open Digital Twin */}
        <button
          onClick={onNavigateToCampus}
          className={styles.twinActionBtn}
          title="Open interactive 2D Campus Digital Twin"
        >
          <span>Digital Twin View</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </div>

      {/* Grid: Left = Campus Buildings Health Matrix, Right = Floor Breakdown */}
      <div className={styles.contentGrid}>
        
        {/* Left Sub-panel: Building Health Matrix */}
        <div className={styles.buildingMatrix}>
          <div className={styles.subHeader}>
            <span className={styles.subTitle}>Building Health Matrix</span>
            <span className={styles.campusLoadBadge}>
              5 Key Monitored Facilities
            </span>
          </div>

          <div className={styles.buildingList}>
            {BUILDINGS.map(b => (
              <div key={b.id} className={styles.buildingRow}>
                <div className={styles.buildingMeta}>
                  <div className={styles.codeRow}>
                    <span className={styles.buildingCode}>{b.code}</span>
                    {b.status !== 'nominal' && (
                      <span className={`${styles.statusPill} ${styles[b.status]}`}>
                        {b.status === 'warning' ? 'Capacity 94%' : 'Maintenance'}
                      </span>
                    )}
                  </div>
                  <span className={styles.buildingName}>{b.name}</span>
                </div>

                <div className={styles.buildingProgressWrap}>
                  <div className={styles.progressText}>
                    <span className={styles.occPercent}>{b.occupancy}%</span>
                    <span className={styles.sensorCount}>{b.sensors} sensors</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${b.occupancy}%`,
                        backgroundColor:
                          b.occupancy > 90 ? '#DC2626' : b.occupancy > 75 ? '#D97706' : '#16A34A',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sub-panel: C Block Live Floor Breakdown */}
        <div className={styles.floorDeepDive}>
          <div className={styles.subHeader}>
            <span className={styles.subTitle}>{BUILDING_INFO.label} Floor Telemetry</span>

            {/* Floor Tabs */}
            <div className={styles.floorTabs}>
              {[1, 2, 3].map(floor => (
                <button
                  key={floor}
                  onClick={() => setSelectedFloor(floor)}
                  className={`${styles.floorBtn} ${selectedFloor === floor ? styles.floorBtnActive : ''}`}
                >
                  Floor {floor}
                </button>
              ))}
            </div>
          </div>

          {/* Floor Summary Metric Card */}
          <div className={styles.floorSummaryStrip}>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>Floor {selectedFloor} Utilization</span>
              <span className={styles.statValue}>
                {floorStats.utilRate}%
              </span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>Headcount</span>
              <span className={styles.statValue}>
                {floorStats.current} <span className={styles.statUnit}>/ {floorStats.capacity}</span>
              </span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>Active Rooms</span>
              <span className={styles.statValue}>
                {floorStats.roomDetails.length} <span className={styles.statUnit}>/ {floorStats.totalRooms}</span>
              </span>
            </div>
          </div>

          {/* Individual Room Progress Cards for Selected Floor */}
          <div className={styles.roomList}>
            {floorStats.roomDetails.map(room => (
              <div key={room.id} className={styles.roomCard}>
                <div className={styles.roomHeader}>
                  <span className={styles.roomLabel}>{room.label}</span>
                  <span className={styles.roomTypeTag}>{room.type}</span>
                </div>
                <div className={styles.roomBarTrack}>
                  <div
                    className={styles.roomBarFill}
                    style={{
                      width: `${room.utilization}%`,
                      backgroundColor:
                        room.utilization > 85 ? '#DC2626' : room.utilization >= 60 ? '#2563EB' : '#16A34A',
                    }}
                  />
                </div>
                <div className={styles.roomFooter}>
                  <span className={styles.roomUtil}>{room.utilization}% load</span>
                  <span className={styles.roomCapacity}>
                    {room.current} / {room.capacity} seats
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

import { useMemo } from 'react';
import {
  BUILDING_INFO,
  ROOMS,
  getRoomOccupancy,
  getBuildingSummary,
} from '../../data/cblockData';
import styles from './RoomInfoPanel.module.css';

/* ── Level → badge colours ── */
const LEVEL_BADGE = {
  low:      { bg: 'rgba(41,121,255,0.15)',  color: '#4fa3ff', border: 'rgba(41,121,255,0.3)' },
  moderate: { bg: 'rgba(255,181,71,0.15)',   color: '#ffb547', border: 'rgba(255,181,71,0.3)' },
  high:     { bg: 'rgba(255,79,109,0.15)',   color: '#ff4f6d', border: 'rgba(255,79,109,0.3)' },
};

export default function RoomInfoPanel({ selectedRoom, selectedTime }) {
  const room = useMemo(
    () => ROOMS.find((r) => r.id === selectedRoom),
    [selectedRoom],
  );

  const occupancy = useMemo(
    () => (selectedRoom ? getRoomOccupancy(selectedRoom, selectedTime) : null),
    [selectedRoom, selectedTime],
  );

  const buildingSummary = useMemo(
    () => getBuildingSummary(selectedTime),
    [selectedTime],
  );

  // ── No room selected: building summary ──
  if (!room) {
    const blvl = LEVEL_BADGE[buildingSummary.level] || LEVEL_BADGE.low;
    return (
      <aside className={styles.panel} id="room-info-panel">
        <div className={styles.header}>
          <span className={styles.buildingIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="url(#rpg)" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M2 17l10 5 10-5" stroke="url(#rpg)" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M2 12l10 5 10-5" stroke="url(#rpg)" strokeWidth="1.5" strokeLinecap="round" />
              <defs>
                <linearGradient id="rpg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2979ff" />
                  <stop offset="100%" stopColor="#00e5ff" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          <div>
            <h2 className={styles.title}>{BUILDING_INFO.label}</h2>
            <p className={styles.subtitle}>{BUILDING_INFO.name}</p>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.metaGrid}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Floors</span>
            <span className={styles.metaValue}>{BUILDING_INFO.floors}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Rooms</span>
            <span className={styles.metaValue}>{BUILDING_INFO.totalRooms}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Building ID</span>
            <span className={styles.metaValue}>{BUILDING_INFO.id}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Monitored</span>
            <span className={styles.metaValue}>{buildingSummary.roomsWithData} rooms</span>
          </div>
        </div>

        <div className={styles.divider} />

        {/* Overall occupancy summary */}
        <div className={styles.sectionLabel}>Occupancy Summary — {selectedTime}</div>
        <div className={styles.occupancyCard}>
          <div className={styles.occRow}>
            <span className={styles.occLabel}>Total Present</span>
            <span className={styles.occValue}>
              {buildingSummary.totalCurrent} / {buildingSummary.totalCapacity}
            </span>
          </div>
          <div className={styles.utilRow}>
            <div className={styles.utilBarOuter}>
              <div
                className={styles.utilBarInner}
                style={{
                  width: `${Math.min(buildingSummary.utilization, 100)}%`,
                  background: blvl.color,
                }}
              />
            </div>
            <span className={styles.utilPercent}>{buildingSummary.utilization}%</span>
          </div>
          <span
            className={styles.levelBadge}
            style={{ background: blvl.bg, color: blvl.color, borderColor: blvl.border }}
          >
            {buildingSummary.level.charAt(0).toUpperCase() + buildingSummary.level.slice(1)}
          </span>
        </div>

        <div className={styles.hint}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 15l-6-6M9 15l6-6" /></svg>
          Click a room to inspect
        </div>
      </aside>
    );
  }

  // ── Room selected ──
  const lvl = occupancy ? LEVEL_BADGE[occupancy.level] : null;

  return (
    <aside className={styles.panel} id="room-info-panel">
      {/* Room header */}
      <div className={styles.header}>
        <span className={styles.roomBadge}>{room.id}</span>
        <div>
          <h2 className={styles.title}>{room.id}</h2>
          <p className={styles.subtitle}>{room.type}</p>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Room meta */}
      <div className={styles.metaGrid}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Floor</span>
          <span className={styles.metaValue}>{room.floor}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Type</span>
          <span className={styles.metaValue}>{room.type}</span>
        </div>
        {room.capacity && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Capacity</span>
            <span className={styles.metaValue}>{room.capacity}</span>
          </div>
        )}
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Time</span>
          <span className={styles.metaValue}>{selectedTime}</span>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Occupancy */}
      <div className={styles.sectionLabel}>Occupancy</div>
      {occupancy ? (
        <div className={styles.occupancyCard}>
          <div className={styles.occRow}>
            <span className={styles.occLabel}>Present</span>
            <span className={styles.occValue}>
              {occupancy.current} / {occupancy.capacity}
            </span>
          </div>
          <div className={styles.utilRow}>
            <div className={styles.utilBarOuter}>
              <div
                className={styles.utilBarInner}
                style={{
                  width: `${Math.min(occupancy.utilization, 100)}%`,
                  background: lvl.color,
                }}
              />
            </div>
            <span className={styles.utilPercent}>{occupancy.utilization}%</span>
          </div>
          <span
            className={styles.levelBadge}
            style={{ background: lvl.bg, color: lvl.color, borderColor: lvl.border }}
          >
            {occupancy.level.charAt(0).toUpperCase() + occupancy.level.slice(1)} Occupancy
          </span>
        </div>
      ) : (
        <p className={styles.noData}>No occupancy data for this room.</p>
      )}

      <div className={styles.divider} />

      {/* Timetable (future) */}
      <div className={styles.sectionLabel}>Timetable</div>
      <p className={styles.noData}>No timetable data available.</p>
    </aside>
  );
}

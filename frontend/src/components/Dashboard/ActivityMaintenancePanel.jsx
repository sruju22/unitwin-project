import { useState } from 'react';
import styles from './ActivityMaintenancePanel.module.css';

const ACTIVITIES = [
  {
    id: 'act1',
    type: 'occupancy',
    message: 'Lecture Hall C101 — occupancy peaked at 88% (62/70 present)',
    time: '4 min ago',
    badge: 'Occupancy',
    color: '#38bdf8',
  },
  {
    id: 'act2',
    type: 'energy',
    message: 'Solar PV array output: 48.2 kW — midday peak generation',
    time: '12 min ago',
    badge: 'Solar PV',
    color: '#10b981',
  },
  {
    id: 'act3',
    type: 'maintenance',
    message: 'Work order #WO-4821 closed — Elevator B sensor re-calibrated',
    time: '28 min ago',
    badge: 'Work Order',
    color: '#f59e0b',
  },
  {
    id: 'act4',
    type: 'traffic',
    message: 'High pedestrian congestion detected at Central Library entrance',
    time: '42 min ago',
    badge: 'Pedestrian',
    color: '#f43f5e',
  },
  {
    id: 'act5',
    type: 'energy',
    message: 'HVAC chiller setpoint adjusted for Block C Floor 2',
    time: '56 min ago',
    badge: 'Automation',
    color: '#14b8a6',
  },
];

export default function ActivityMaintenancePanel() {
  const [filter, setFilter] = useState('all');

  const filtered = ACTIVITIES.filter(item => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.iconChip}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <h3 className={styles.title}>Live Activity & Facility Maintenance</h3>
            <p className={styles.subtitle}>Audit trail of automated telemetry events and work orders</p>
          </div>
        </div>

        {/* Live indicator chip */}
        <div className={styles.liveBadge}>
          <span className={styles.livePulse} />
          <span>Live Stream</span>
        </div>
      </div>

      {/* Maintenance Summary Scorecard */}
      <div className={styles.maintenanceScorecard}>
        <div className={styles.scoreItem}>
          <span className={styles.scoreLabel}>Work Orders</span>
          <span className={styles.scoreVal}>4 <span className={styles.scoreUnit}>Active</span></span>
        </div>

        <div className={styles.scoreDivider} />

        <div className={styles.scoreItem}>
          <span className={styles.scoreLabel}>IoT Nodes Online</span>
          <span className={`${styles.scoreVal} ${styles.greenVal}`}>99.3% <span className={styles.scoreUnit}>(428/431)</span></span>
        </div>

        <div className={styles.scoreDivider} />

        <div className={styles.scoreItem}>
          <span className={styles.scoreLabel}>Preventive Health</span>
          <span className={`${styles.scoreVal} ${styles.cyanVal}`}>98.2% <span className={styles.scoreUnit}>SLA OK</span></span>
        </div>
      </div>

      {/* Filter Chips */}
      <div className={styles.filterRow}>
        {[
          { key: 'all', label: 'All Activity' },
          { key: 'occupancy', label: 'Occupancy' },
          { key: 'energy', label: 'Energy' },
          { key: 'maintenance', label: 'Maintenance' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`${styles.filterChip} ${filter === tab.key ? styles.filterChipActive : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Activity Timeline List */}
      <div className={styles.activityList}>
        {filtered.map(act => (
          <div key={act.id} className={styles.activityItem}>
            <div className={styles.dotLineCol}>
              <span className={styles.dot} style={{ background: act.color, boxShadow: `0 0 6px ${act.color}` }} />
              <div className={styles.verticalLine} />
            </div>

            <div className={styles.itemContent}>
              <div className={styles.itemHeader}>
                <span
                  className={styles.typeBadge}
                  style={{ color: act.color, borderColor: `${act.color}44`, background: `${act.color}11` }}
                >
                  {act.badge}
                </span>
                <span className={styles.timestamp}>{act.time}</span>
              </div>
              <p className={styles.message}>{act.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

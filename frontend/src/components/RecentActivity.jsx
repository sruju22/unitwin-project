import styles from './RecentActivity.module.css';

const ACTIVITIES = [
  {
    id: 'act1',
    type: 'occupancy',
    message: 'Lecture Hall A — occupancy dropped to 42%',
    time: '3 min ago',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: 'act2',
    type: 'energy',
    message: 'Solar array output: 48.2 kW — peak generation',
    time: '11 min ago',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    id: 'act3',
    type: 'maintenance',
    message: 'Work order #WO-4821 closed — Elevator Block B',
    time: '34 min ago',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    id: 'act4',
    type: 'congestion',
    message: 'High congestion detected — Main Canteen entrance',
    time: '48 min ago',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h18M3 6h18M3 18h18" />
      </svg>
    ),
  },
  {
    id: 'act5',
    type: 'energy',
    message: 'Grid import reduced by 18% this hour',
    time: '1 hr ago',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

const TYPE_COLOUR = {
  occupancy:   '#4fa3ff',
  energy:      '#00c896',
  maintenance: '#ffb547',
  congestion:  '#ff4f6d',
};

export default function RecentActivity() {
  return (
    <section className={`${styles.panel} fade-in`} style={{ animationDelay: '320ms' }}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Recent Activity</h2>
        <span className={styles.liveChip}>
          <span className={styles.liveDot} />
          Live
        </span>
      </div>

      <ul className={styles.list}>
        {ACTIVITIES.map((act) => {
          const colour = TYPE_COLOUR[act.type] || '#8892b0';
          return (
            <li key={act.id} className={styles.item}>
              <span className={styles.iconWrap} style={{ color: colour, background: `${colour}18` }}>
                {act.icon}
              </span>
              <div className={styles.body}>
                <p className={styles.message}>{act.message}</p>
                <span className={styles.time}>{act.time}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

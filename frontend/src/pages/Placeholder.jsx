import styles from './Placeholder.module.css';

const PAGE_META = {
  campus: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 9 12 2 21 9 21 20 3 20" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    title: 'Campus',
    description: 'The interactive 3D campus model will be rendered here using Three.js. Navigate buildings, rooms, and outdoor spaces in real time.',
    tag: '3D View — Coming Soon',
    colour: '#2979ff',
  },
  analytics: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6"  y1="20" x2="6"  y2="14" />
      </svg>
    ),
    title: 'Analytics',
    description: 'Campus-wide data analytics with historical trends, predictive insights, and exportable reports. Charts and dashboards powered by live sensor data.',
    tag: 'Charts — Coming Soon',
    colour: '#00e5ff',
  },
  occupancy: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Occupancy',
    description: 'Room-by-room and building-level occupancy tracking using IoT sensors. View heat-maps, peak usage times, and capacity alerts.',
    tag: 'Heatmap — Coming Soon',
    colour: '#00c896',
  },
  energy: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: 'Energy',
    description: 'Monitor power consumption, solar generation, and grid imports across all campus buildings. Track sustainability KPIs in real time.',
    tag: 'Energy Monitor — Coming Soon',
    colour: '#ffb547',
  },
  congestion: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h18M3 6h18M3 18h18" />
        <circle cx="7"  cy="6"  r="2" fill="currentColor" stroke="none" />
        <circle cx="17" cy="12" r="2" fill="currentColor" stroke="none" />
        <circle cx="7"  cy="18" r="2" fill="currentColor" stroke="none" />
      </svg>
    ),
    title: 'Congestion',
    description: 'Real-time foot-traffic analysis using computer vision and sensor fusion. Identify bottlenecks and crowded zones across campus.',
    tag: 'Traffic Map — Coming Soon',
    colour: '#ff4f6d',
  },
  maintenance: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    title: 'Maintenance',
    description: 'Manage work orders, track facility issues, and schedule preventive maintenance. Integrated with building management systems.',
    tag: 'Work Orders — Coming Soon',
    colour: '#a78bfa',
  },
  alerts: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    title: 'Alerts',
    description: 'Centralised alert management for all campus systems. Configure thresholds, escalation rules, and notification channels.',
    tag: 'Alert Centre — Coming Soon',
    colour: '#ff4f6d',
  },
};

export default function Placeholder({ page }) {
  const meta = PAGE_META[page] || {
    icon: null,
    title: page,
    description: 'This section is under development.',
    tag: 'Coming Soon',
    colour: '#8892b0',
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card} style={{ '--page-colour': meta.colour }}>
        {/* Grid dots */}
        <div className={styles.dots} aria-hidden="true" />

        {/* Corner brackets */}
        <span className={`${styles.corner} ${styles.tl}`} aria-hidden="true" />
        <span className={`${styles.corner} ${styles.tr}`} aria-hidden="true" />
        <span className={`${styles.corner} ${styles.bl}`} aria-hidden="true" />
        <span className={`${styles.corner} ${styles.br}`} aria-hidden="true" />

        <div className={styles.inner}>
          <div className={styles.iconWrap} style={{ color: meta.colour }}>
            {meta.icon}
          </div>
          <h2 className={styles.title}>{meta.title}</h2>
          <p className={styles.description}>{meta.description}</p>
          <span className={styles.tag} style={{ color: meta.colour, borderColor: `${meta.colour}44`, background: `${meta.colour}11` }}>
            {meta.tag}
          </span>
        </div>
      </div>
    </div>
  );
}

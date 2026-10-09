import StatCard from '../components/StatCard';
import RecentAlerts from '../components/RecentAlerts';
import RecentActivity from '../components/RecentActivity';
import CampusMap from '../components/Campus2D/CampusMap';
import { BUILDING_INFO } from '../data/cblockData';
import styles from './Dashboard.module.css';

/* ---- Stat card data ---- */
const STATS = [
  {
    id: 'buildings',
    title: 'Buildings',
    value: '24',
    delta: '2 under maintenance',
    deltaUp: false,
    accent: 'blue',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 9 12 2 21 9 21 20 3 20" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'occupancy',
    title: 'Occupancy',
    value: '68',
    unit: '%',
    delta: '+4.2% vs yesterday',
    deltaUp: true,
    accent: 'green',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'alerts',
    title: 'Active Alerts',
    value: '3',
    delta: '1 critical',
    deltaUp: false,
    accent: 'red',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    id: 'energy',
    title: 'Energy Usage',
    value: '142',
    unit: 'kWh',
    delta: '-8.1% vs last hour',
    deltaUp: true,
    accent: 'orange',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
];

export default function Dashboard({ onNavigate }) {
  return (
    <div className={styles.page}>

      {/* Stat Cards */}
      <section className={styles.statsGrid} aria-label="Campus overview stats">
        {STATS.map((stat, i) => (
          <StatCard key={stat.id} {...stat} index={i} />
        ))}
      </section>

      {/* Campus Preview Placeholder -> Now the 2D Map */}
      <section
        id="campus-preview"
        className={`${styles.campusPlaceholder} fade-in`}
        style={{ animationDelay: '180ms', position: 'relative', padding: 0, overflow: 'hidden', height: '400px', background: '#0f172a' }}
        aria-label="Campus View Preview"
      >
        <div style={{ position: 'absolute', top: 20, left: 24, zIndex: 10, pointerEvents: 'none' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', letterSpacing: '0.5px' }}>{BUILDING_INFO.label}</h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>{BUILDING_INFO.name}</p>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <span className={styles.tag}>3 Floors</span>
            <span className={styles.tag}>Live Occupancy</span>
          </div>
        </div>

        <button 
          onClick={() => onNavigate('campus')}
          style={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            zIndex: 10,
            background: '#00e5ff',
            color: '#0b0d14',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            fontWeight: 'bold',
            fontFamily: "'Space Grotesk', sans-serif",
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 229, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'transform 0.2s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          EXPLORE C BLOCK
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>

        {/* 2D Map Preview */}
        <div style={{ width: '100%', height: '100%', opacity: 0.9 }}>
          <CampusMap interactive={false} />
        </div>
      </section>

      {/* Bottom row: Alerts + Activity */}
      <section className={styles.bottomGrid}>
        <RecentAlerts />
        <RecentActivity />
      </section>

    </div>
  );
}

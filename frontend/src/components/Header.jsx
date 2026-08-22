import styles from './Header.module.css';

const PAGE_TITLES = {
  dashboard:   { title: 'Dashboard',   subtitle: 'Overview of campus systems' },
  campus:      { title: 'Campus',      subtitle: '3D interactive campus view' },
  analytics:   { title: 'Analytics',   subtitle: 'Data insights and trends' },
  occupancy:   { title: 'Occupancy',   subtitle: 'Real-time room & building occupancy' },
  energy:      { title: 'Energy',      subtitle: 'Power consumption and efficiency' },
  congestion:  { title: 'Congestion',  subtitle: 'Foot traffic and hotspot analysis' },
  maintenance: { title: 'Maintenance', subtitle: 'Work orders and facility status' },
  alerts:      { title: 'Alerts',      subtitle: 'System notifications and warnings' },
};

export default function Header({ activePage }) {
  const { title, subtitle } = PAGE_TITLES[activePage] || PAGE_TITLES.dashboard;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <header className={styles.header}>
      {/* Page Title */}
      <div className={styles.titleBlock}>
        <h1 className={styles.pageTitle}>{title}</h1>
        <p className={styles.pageSubtitle}>{subtitle}</p>
      </div>

      {/* Right Controls */}
      <div className={styles.controls}>
        {/* Date */}
        <span className={styles.dateChip}>{dateStr}</span>

        {/* Search */}
        <div className={styles.searchBox}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="header-search"
            type="text"
            placeholder="Search campus…"
            className={styles.searchInput}
            aria-label="Search campus"
          />
        </div>

        {/* Alerts bell */}
        <button id="header-alerts-btn" className={styles.iconBtn} aria-label="View alerts">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className={styles.alertBadge}>3</span>
        </button>

        {/* Avatar */}
        <div className={styles.avatar} id="header-user-avatar" title="Admin User">
          <span>AU</span>
        </div>
      </div>
    </header>
  );
}

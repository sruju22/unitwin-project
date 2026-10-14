import { parseCampusDate } from '../utils/dateUtils';
import styles from './Header.module.css';

const PAGE_TITLES = {
  dashboard:   { title: 'Dashboard',   subtitle: 'Overview of campus systems' },
  campus:      { title: 'Campus',      subtitle: '2D interactive digital twin survey' },
  analytics:   { title: 'Analytics',   subtitle: 'Data insights and trends' },
  occupancy:   { title: 'Occupancy',   subtitle: 'Real-time room & building occupancy' },
  energy:      { title: 'Energy',      subtitle: 'Power consumption and efficiency' },
  congestion:  { title: 'Congestion',  subtitle: 'Foot traffic and hotspot analysis' },
  maintenance: { title: 'Maintenance', subtitle: 'Work orders and facility status' },
  alerts:      { title: 'Alerts',      subtitle: 'System notifications and warnings' },
};

export default function Header({
  activePage,
  onOpenCommandPalette,
  alertCount = 0,
  reportingDate = '2026-10-14',
  onSelectDate,
}) {
  const { title, subtitle } = PAGE_TITLES[activePage] || PAGE_TITLES.dashboard;
  const dateObj = parseCampusDate(reportingDate) || new Date();
  const dateStr = dateObj.toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
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
        {/* Date Selector */}
        <label className={styles.dateChip} title="Campus reporting date (Click to change)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.calendarIcon}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className={styles.dateText}>{dateStr}</span>
          <input
            type="date"
            className={styles.dateInput}
            value={reportingDate}
            onChange={(e) => onSelectDate && e.target.value && onSelectDate(e.target.value)}
            aria-label="Select reporting date"
          />
        </label>

        {/* Search & Command Palette Trigger */}
        <div
          className={styles.searchBox}
          onClick={onOpenCommandPalette}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenCommandPalette?.();
            }
          }}
          aria-label="Open command palette"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className={styles.searchInput}>Search campus…</span>
          <span className={styles.searchShortcut}>⌘K</span>
        </div>

        {/* Alerts bell */}
        <button id="header-alerts-btn" className={styles.iconBtn} aria-label="View alerts">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {alertCount > 0 && <span className={styles.alertBadge}>{alertCount}</span>}
        </button>

        {/* Avatar */}
        <div className={styles.avatar} id="header-user-avatar" title="Campus Operations">
          <span>CO</span>
        </div>
      </div>
    </header>
  );
}

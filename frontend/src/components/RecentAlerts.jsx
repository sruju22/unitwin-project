import styles from './RecentAlerts.module.css';

const ALERTS = [
  {
    id: 'a1',
    severity: 'critical',
    title: 'HVAC Failure — Block C',
    detail: 'Air handling unit offline. Maintenance notified.',
    time: '8 min ago',
  },
  {
    id: 'a2',
    severity: 'warning',
    title: 'High Occupancy — Library',
    detail: 'Current occupancy at 94% of rated capacity.',
    time: '22 min ago',
  },
  {
    id: 'a3',
    severity: 'info',
    title: 'Scheduled Maintenance',
    detail: 'Lab 204 offline this weekend for equipment upgrade.',
    time: '1 hr ago',
  },
];

const SEVERITY_META = {
  critical: { label: 'Critical', color: '#DC2626' },
  warning:  { label: 'Warning',  color: '#D97706' },
  info:     { label: 'Info',     color: '#2563EB' },
};

export default function RecentAlerts() {
  return (
    <section className={`${styles.panel} fade-in`} style={{ animationDelay: '240ms' }}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Recent Alerts</h2>
        <button id="alerts-view-all-btn" className={styles.viewAll}>View all</button>
      </div>

      <ul className={styles.list}>
        {ALERTS.map((alert) => {
          const meta = SEVERITY_META[alert.severity];
          return (
            <li key={alert.id} className={styles.item}>
              <span
                className={styles.dot}
                style={{ background: meta.color }}
              />
              <div className={styles.itemBody}>
                <div className={styles.itemTop}>
                  <span className={styles.itemTitle}>{alert.title}</span>
                  <span
                    className={styles.severityBadge}
                    style={{ color: meta.color, borderColor: `${meta.color}33`, background: `${meta.color}1a` }}
                  >
                    {meta.label}
                  </span>
                </div>
                <p className={styles.itemDetail}>{alert.detail}</p>
                <span className={styles.itemTime}>{alert.time}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import styles from './OccupancyLegend.module.css';

const LEVELS = [
  { key: 'low',      label: 'Low',      detail: '< 60%',    color: '#10B981' },
  { key: 'moderate', label: 'Moderate',  detail: '60 – 80%', color: '#F59E0B' },
  { key: 'high',     label: 'High',      detail: '> 80%',    color: '#EF4444' },
  { key: 'nodata',   label: 'No Data',   detail: '—',        color: '#94A3B8' },
];

export default function OccupancyLegend() {
  return (
    <div className={styles.legend} id="occupancy-legend">
      <span className={styles.legendTitle}>Occupancy</span>
      <div className={styles.items}>
        {LEVELS.map((l) => (
          <div key={l.key} className={styles.item}>
            <span className={styles.swatch} style={{ background: l.color }} />
            <span className={styles.label}>{l.label}</span>
            <span className={styles.detail}>{l.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

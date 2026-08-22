import styles from './StatCard.module.css';

/**
 * StatCard — reusable metric card for the dashboard.
 *
 * Props:
 *  title       — label text
 *  value       — primary metric value (string/number)
 *  unit        — optional unit suffix
 *  delta       — optional change string, e.g. "+4.2%"
 *  deltaUp     — boolean: true = positive (green), false = negative (red)
 *  icon        — JSX svg icon element
 *  accent      — CSS colour for icon background tint ('blue'|'green'|'orange'|'red')
 *  index       — card order for staggered animation delay
 */
export default function StatCard({
  title,
  value,
  unit,
  delta,
  deltaUp,
  icon,
  accent = 'blue',
  index = 0,
}) {
  return (
    <div
      className={`${styles.card} fade-in`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Icon */}
      <div className={`${styles.iconWrap} ${styles[accent]}`}>
        {icon}
      </div>

      {/* Content */}
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
        <div className={styles.valueRow}>
          <span className={styles.value}>{value}</span>
          {unit && <span className={styles.unit}>{unit}</span>}
        </div>
        {delta && (
          <span className={`${styles.delta} ${deltaUp ? styles.up : styles.down}`}>
            {deltaUp ? '▲' : '▼'} {delta}
          </span>
        )}
      </div>

      {/* Subtle glow bar at bottom */}
      <div className={`${styles.glowBar} ${styles[accent]}`} />
    </div>
  );
}

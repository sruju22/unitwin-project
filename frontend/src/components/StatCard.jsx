import AnimatedCounter from './AnimatedCounter';
import Skeleton from './Skeleton';
import styles from './StatCard.module.css';

/**
 * StatCard — Upgraded KPI metric card for the Unitwin Digital Twin dashboard.
 *
 * Features:
 *  - Larger values with tabular numerals
 *  - Lighter-weight units
 *  - Small, softly tinted positive/negative delta pills
 *  - Mini sparklines with gradient fills when real historical data exists
 *  - Smooth skeleton shimmer states during loading
 *  - Subtle hover elevation and vertical gradient
 */
export default function StatCard({
  title,
  value,
  unit,
  delta,
  deltaUp = null,
  icon,
  accent = 'blue',
  index = 0,
  sparkline = null,
  secondaryText = null,
  loading = false,
}) {
  // Generate sparkline SVG path if genuine data is provided
  const renderSparkline = () => {
    if (loading || !sparkline || sparkline.length < 2) return null;
    const min = Math.min(...sparkline);
    const max = Math.max(...sparkline);
    const range = max - min || 1;
    const w = 72;
    const h = 24;
    const points = sparkline.map((val, idx) => {
      const x = (idx / (sparkline.length - 1)) * w;
      const y = h - ((val - min) / range) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const strokePath = `M ${points.join(' L ')}`;
    const areaPath = `${strokePath} L ${w},${h} L 0,${h} Z`;

    const accentColors = {
      blue: '#38bdf8',
      green: '#10b981',
      orange: '#f59e0b',
      red: '#f43f5e',
      teal: '#14b8a6',
    };
    const strokeColor = accentColors[accent] || '#14b8a6';

    return (
      <svg className={styles.sparkline} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <defs>
          <linearGradient id={`spark-grad-${accent}-${index}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#spark-grad-${accent}-${index})`} />
        <path d={strokePath} fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  return (
    <div className={styles.card} style={{ '--i': index }}>
      {/* Top row: Icon + Clean Title */}
      <div className={styles.cardHeader}>
        <div className={`${styles.iconWrap} ${styles[accent]}`}>
          {icon}
        </div>
        <p className={styles.title}>{title}</p>
      </div>

      {/* Main Metric Value & Trend Sparkline */}
      <div className={styles.mainRow}>
        {loading ? (
          <div className={styles.valueGroup}>
            <Skeleton width="64px" height="32px" borderRadius="6px" />
          </div>
        ) : (
          <div className={styles.valueGroup}>
            <span className={styles.value}>
              <AnimatedCounter value={value} />
            </span>
            {unit && <span className={styles.unit}>{unit}</span>}
          </div>
        )}
        {renderSparkline()}
      </div>

      {/* Footer / Context Row: Soft tinted delta pills & secondary text */}
      <div className={styles.cardFooter}>
        {loading ? (
          <Skeleton width="120px" height="16px" borderRadius="4px" />
        ) : (
          <>
            {delta && (
              <>
                {deltaUp === true || deltaUp === false ? (
                  <span className={`${styles.deltaPill} ${deltaUp ? styles.pillUp : styles.pillDown}`}>
                    <span className={styles.pillArrow}>{deltaUp ? '▲' : '▼'}</span>
                    <span>{delta}</span>
                  </span>
                ) : (
                  <span className={styles.deltaNeutral}>
                    <span className={styles.neutralDot} />
                    <span>{delta}</span>
                  </span>
                )}
              </>
            )}

            {secondaryText && (
              <span className={styles.secondaryText}>{secondaryText}</span>
            )}
          </>
        )}
      </div>

      {/* Subtle bottom accent line */}
      <div className={`${styles.glowBar} ${styles[accent]}`} />
    </div>
  );
}

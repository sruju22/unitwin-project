import { useState, useEffect } from 'react';
import { getEnergyUsage } from '../../api/client';
import styles from './EnergyTelemetryChart.module.css';

/**
 * Generates a smooth cubic bezier SVG path from coordinate points
 */
function getSmoothCurve(pts) {
  if (!pts || pts.length < 2) return '';
  let path = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return path;
}

export default function EnergyTelemetryChart() {
  const [activeRange, setActiveRange] = useState('today');
  const [energyData, setEnergyData] = useState([]);
  const [hoverIndex, setHoverIndex] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchTelemetry() {
      try {
        const res = await getEnergyUsage({ range: activeRange });
        if (isMounted) {
          if (res?.summary?.timeline && res.summary.timeline.length > 0) {
            let rawPoints = res.summary.timeline;
            if (activeRange === 'today') {
              rawPoints = rawPoints.slice(-3);
            } else if (activeRange === '24h') {
              rawPoints = rawPoints.slice(-6);
            }
            const mapped = rawPoints.map((pt) => ({
              time: pt.snapshotLabel,
              timestamp: pt.timestamp,
              demand: pt.demandKw,
              solar: 0,
              energyKWh: pt.energyKWh,
            }));
            setEnergyData(mapped);
          } else if (Array.isArray(res?.data) && res.data.length > 0) {
            setEnergyData(res.data);
          } else {
            setEnergyData([]);
          }
        }
      } catch (err) {
        console.warn('Energy telemetry unavailable:', err.message);
        if (isMounted) setEnergyData([]);
      }
    }
    fetchTelemetry();
    return () => {
      isMounted = false;
    };
  }, [activeRange]);

  const hasData = energyData.length > 0;

  // Chart coordinate math (used only when real data is present)
  const w = 640;
  const h = 180;
  const padL = 36;
  const padR = 16;
  const padT = 14;
  const padB = 26;

  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const maxVal = hasData
    ? Math.max(...energyData.map((d) => Math.max(d.demand || 0, d.solar || 0, 100))) * 1.15
    : 200;

  const getX = (idx) => padL + (idx / Math.max(energyData.length - 1, 1)) * chartW;
  const getY = (val) => padT + chartH - (val / maxVal) * chartH;

  const activePoint = hasData
    ? energyData[hoverIndex !== null ? hoverIndex : energyData.length - 1]
    : null;

  const isValidNumber = (val) =>
    typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val);

  const hasValidDemand = hasData && isValidNumber(activePoint?.demand);
  const hasValidSolar = hasData && isValidNumber(activePoint?.solar);

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.iconChip}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <h3 className={styles.title}>Energy &amp; Solar Performance</h3>
            <p className={styles.subtitle}>Campus power demand vs. on-site photovoltaic yield · Pilot Baseline</p>
          </div>
        </div>

        {/* Range selectors */}
        <div className={styles.rangeTabs}>
          {['today', '24h', '7d'].map((range) => (
            <button
              key={range}
              onClick={() => setActiveRange(range)}
              className={`${styles.rangeBtn} ${activeRange === range ? styles.rangeActive : ''}`}
            >
              {range === 'today' ? 'Today' : range === '24h' ? '24h' : '7d'}
            </button>
          ))}
        </div>
      </div>

      {/* Clean Telemetry Metric Strip */}
      <div className={styles.metricsStrip}>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Active Demand</span>
          <span className={styles.metricValue}>
            {hasValidDemand ? (
              <>
                {activePoint.demand} <span className={styles.metricUnit}>kW</span>
              </>
            ) : (
              <>
                — <span className={styles.metricUnit}>Awaiting data</span>
              </>
            )}
          </span>
        </div>

        <div className={styles.metricDivider} />

        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Solar PV Yield</span>
          <span className={`${styles.metricValue} ${styles.solarAccent}`}>
            {hasValidSolar ? (
              <>
                {activePoint.solar} <span className={styles.metricUnit}>kW</span>
              </>
            ) : (
              <>
                — <span className={styles.metricUnit}>Awaiting data</span>
              </>
            )}
          </span>
        </div>

        <div className={styles.metricDivider} />

        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Net Grid Import</span>
          <span className={`${styles.metricValue} ${styles.netAccent}`}>
            {hasValidDemand && hasValidSolar ? (
              <>
                {(activePoint.demand - activePoint.solar).toFixed(1)}{' '}
                <span className={styles.metricUnit}>kW</span>
              </>
            ) : (
              <>
                — <span className={styles.metricUnit}>Awaiting data</span>
              </>
            )}
          </span>
        </div>

        <div className={styles.metricDivider} />

        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Solar Offset</span>
          <span className={styles.metricValue}>
            {hasValidDemand && hasValidSolar && activePoint.demand > 0 ? (
              `${Math.round((activePoint.solar / activePoint.demand) * 100)}%`
            ) : (
              '—'
            )}
          </span>
        </div>
      </div>

      {/* Chart Wrap: Smooth SVG curves when real data is present, or clean Awaiting Feed card */}
      <div className={styles.chartWrap}>
        {hasData ? (
          <>
            <svg
              className={styles.svgChart}
              viewBox={`0 0 ${w} ${h}`}
              preserveAspectRatio="none"
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Minimal Grid lines */}
              {[0, 50, 100, 150, 200].map((val) => {
                const yPos = getY(val);
                return (
                  <g key={val}>
                    <line
                      x1={padL}
                      y1={yPos}
                      x2={w - padR}
                      y2={yPos}
                      stroke="rgba(255, 255, 255, 0.035)"
                      strokeDasharray="4 4"
                    />
                    <text x={padL - 6} y={yPos + 3} textAnchor="end" className={styles.axisText}>
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Smooth Bezier Paths */}
              {(() => {
                const demandCoords = energyData.map((d, i) => ({
                  x: getX(i),
                  y: getY(d.demand || 0),
                }));
                const solarCoords = energyData.map((d, i) => ({
                  x: getX(i),
                  y: getY(d.solar || 0),
                }));

                const dSmooth = getSmoothCurve(demandCoords);
                const sSmooth = getSmoothCurve(solarCoords);

                const lastX = getX(energyData.length - 1);
                const baseY = padT + chartH;

                const dArea = `${dSmooth} L ${lastX},${baseY} L ${padL},${baseY} Z`;
                const sArea = `${sSmooth} L ${lastX},${baseY} L ${padL},${baseY} Z`;

                return (
                  <>
                    <path d={sArea} fill="url(#solarGrad)" />
                    <path d={sSmooth} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />
                    <path d={dArea} fill="url(#demandGrad)" />
                    <path d={dSmooth} fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinejoin="round" />
                  </>
                );
              })()}

              {/* X Axis Time Labels */}
              {energyData.map((d, i) => {
                if (i % 2 !== 0 && i !== energyData.length - 1) return null;
                return (
                  <text key={d.time || i} x={getX(i)} y={h - 6} textAnchor="middle" className={styles.axisText}>
                    {d.time || `${i}:00`}
                  </text>
                );
              })}

              {/* Hover scrubber cursor */}
              {hoverIndex !== null && activePoint && (
                <g>
                  <line
                    x1={getX(hoverIndex)}
                    y1={padT}
                    x2={getX(hoverIndex)}
                    y2={padT + chartH}
                    stroke="#14b8a6"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                    opacity="0.8"
                  />
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getY(activePoint.demand || 0)}
                    r="4"
                    fill="#38bdf8"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getY(activePoint.solar || 0)}
                    r="3.5"
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                </g>
              )}

              {/* Transparent hit boxes for scrubbing */}
              {energyData.map((d, i) => {
                const stepW = chartW / Math.max(energyData.length - 1, 1);
                return (
                  <rect
                    key={i}
                    x={getX(i) - stepW / 2}
                    y={padT}
                    width={stepW}
                    height={chartH}
                    fill="transparent"
                    onMouseEnter={() => setHoverIndex(i)}
                    style={{ cursor: 'crosshair' }}
                  />
                );
              })}
            </svg>

            {/* Legend */}
            <div className={styles.legendRow}>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#38bdf8' }} />
                <span>Campus Demand (kW)</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#10b981' }} />
                <span>Solar PV (kW)</span>
              </div>
              {activePoint && (
                <div className={styles.hoverTimeBadge}>
                  Timestamp: <strong>{activePoint.time || 'Live'}</strong>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className={styles.awaitingTelemetryWrap}>
            <div className={styles.awaitingCard}>
              <div className={styles.awaitingIconWrap}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <div className={styles.awaitingTextCol}>
                <div className={styles.awaitingHeadingRow}>
                  <h4 className={styles.awaitingHeading}>Awaiting Energy Telemetry Feed</h4>
                  <span className={styles.awaitingTag}>Meters Standby</span>
                </div>
                <p className={styles.awaitingDesc}>
                  Smart meter and solar telemetry are currently awaiting connection. Performance curves will display when telemetry streams are active.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo, useRef } from 'react';
import { getEnergyUsage } from '../../api/client';
import styles from './EnergyTelemetryChart.module.css';

/**
 * Generates an accurate linear SVG polyline path from coordinate points,
 * faithfully representing actual historical data without artificial curves or overshoot.
 */
function getPolylinePath(pts) {
  if (!pts || pts.length === 0) return '';
  return pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
}

export default function EnergyTelemetryChart() {
  const [activeRange, setActiveRange] = useState('today'); // 'today' | '24h' | '7d'
  const [scaleMode, setScaleMode] = useState('dual'); // 'dual' (default) | 'shared'
  const [rawTimeline, setRawTimeline] = useState([]);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [containerWidth, setContainerWidth] = useState(640);

  const containerRef = useRef(null);

  // Track responsive container width for pixel-perfect tooltip bounding
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth || 640);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [loading]);

  // Fetch telemetry respecting the active range selection:
  // - 'today' & '24h': query bounded by the reporting date/time
  // - '7d': query the full multi-day pilot monitoring baseline
  useEffect(() => {
    let isMounted = true;
    async function fetchTelemetry() {
      try {
        setLoading(true);
        const params = activeRange === '7d' ? {} : { asOfDate: new Date().toISOString() };
        const res = await getEnergyUsage(params);
        if (isMounted) {
          if (res?.summary?.timeline && res.summary.timeline.length > 0) {
            setRawTimeline(res.summary.timeline);
          } else {
            setRawTimeline([]);
          }
        }
      } catch (err) {
        console.warn('Energy telemetry unavailable:', err.message);
        if (isMounted) setRawTimeline([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchTelemetry();
    return () => {
      isMounted = false;
    };
  }, [activeRange]);

  // Filter actual historical points in chronological order based on selected temporal window
  const energyData = useMemo(() => {
    if (!rawTimeline.length) return [];

    // Chronologically sorted historical timeline
    const sorted = [...rawTimeline].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const latestPoint = sorted[sorted.length - 1];
    const latestTimestamp = new Date(latestPoint.timestamp).getTime();
    const latestDateStr = new Date(latestTimestamp).toISOString().split('T')[0];

    let points = sorted;
    if (activeRange === 'today') {
      // Readings for the reporting day (Oct 12, 2026: 3 snapshots)
      points = sorted.filter(
        (p) => new Date(p.timestamp).toISOString().split('T')[0] === latestDateStr
      );
    } else if (activeRange === '24h') {
      // Readings within 24-hour window relative to the latest point
      const window24h = 24 * 60 * 60 * 1000;
      points = sorted.filter((p) => {
        const t = new Date(p.timestamp).getTime();
        return latestTimestamp - t <= window24h;
      });
    } else if (activeRange === '7d') {
      // Full multi-day monitoring baseline (all 15 historical snapshots across Oct 12–16)
      points = sorted;
    }

    return points.map((pt, idx) => {
      const d = new Date(pt.timestamp);
      const demandVal = Number(pt.demandKw) || 0;
      const solarVal = typeof pt.solarKw === 'number' ? Number(pt.solarKw) : 0;
      const netVal = Number(Math.max(0, demandVal - solarVal).toFixed(1));
      const offsetVal = demandVal > 0 ? Number(((solarVal / demandVal) * 100).toFixed(1)) : 0;

      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const timeLabel = pt.snapshotLabel || d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      return {
        id: idx,
        timestamp: pt.timestamp,
        dateLabel,
        timeLabel,
        fullLabel: `${dateLabel}, ${d.getFullYear()} · ${timeLabel}`,
        demand: demandVal,
        solar: solarVal,
        energyKWh: Number(pt.energyKWh) || 0,
        netImport: netVal,
        solarOffsetPct: offsetVal,
      };
    });
  }, [rawTimeline, activeRange]);

  const hasData = energyData.length > 0;

  // Active point for top metric strip and tooltip (hovered or latest point in range)
  const activePoint = hasData
    ? energyData[hoverIndex !== null && hoverIndex < energyData.length ? hoverIndex : energyData.length - 1]
    : null;

  // Dynamic concise subtitle based on active range
  const chartSubtitle = useMemo(() => {
    if (activeRange === 'today') {
      return `Oct 12, 2026 · ${energyData.length} snapshots`;
    }
    if (activeRange === '24h') {
      return `24h window · ${energyData.length} snapshots`;
    }
    return `Oct 12–16 baseline · ${energyData.length} snapshots`;
  }, [activeRange, energyData.length]);

  // Chart coordinate parameters
  const w = 640;
  const h = 180;
  const padL = 36;
  const padR = scaleMode === 'dual' ? 38 : 16;
  const padT = 20;
  const padB = 22;

  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  // Demand scale (0 – 200 kW) with 3 harmonious, symmetrical reference ticks
  const maxDemandVal = 200;
  const demandTicks = [0, 100, 200];

  // Solar PV scale in Dual mode (0 – 5.0 kW) aligned symmetrically at the exact same heights (0, 2.5, 5.0)
  const maxSolarVal = 5.0;
  const solarTicks = [0, 2.5, 5.0];

  const getX = (idx) => padL + (idx / Math.max(energyData.length - 1, 1)) * chartW;

  const getYDemand = (val) => {
    const clamped = Math.max(0, Math.min(val, maxDemandVal));
    return padT + chartH - (clamped / maxDemandVal) * chartH;
  };

  const getYSolar = (val) => {
    if (scaleMode === 'dual') {
      const clamped = Math.max(0, Math.min(val, maxSolarVal));
      return padT + chartH - (clamped / maxSolarVal) * chartH;
    }
    // Shared scale mode: Solar plotted on the same 0–200 kW scale
    const clamped = Math.max(0, Math.min(val, maxDemandVal));
    return padT + chartH - (clamped / maxDemandVal) * chartH;
  };

  // Continuous pointer tracking across data points with zero jitter or gaps
  const handlePointer = (clientX) => {
    if (!energyData.length || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;

    const relX = clientX - rect.left;
    // Map relX in physical pixels to SVG coordinate scale (0 to w)
    const svgX = (relX / rect.width) * w;

    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < energyData.length; i++) {
      const dist = Math.abs(getX(i) - svgX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }
    setHoverIndex(closestIdx);
  };

  const handleMouseMove = (e) => {
    handlePointer(e.clientX);
  };

  const handleTouchMove = (e) => {
    if (e.touches && e.touches.length > 0) {
      handlePointer(e.touches[0].clientX);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // Tooltip positioning parameters: relative to active point, strictly bounded within container
  const tooltipParams = useMemo(() => {
    if (hoverIndex === null || !activePoint || !energyData.length) return null;

    const cx = getX(hoverIndex);
    const activePointPx = (cx / w) * containerWidth;

    const tipWidth = containerWidth < 480 ? 176 : 192;
    const tipHeight = 96;
    const gap = 12;

    const isRightHalf = hoverIndex / Math.max(energyData.length - 1, 1) > 0.5;

    let tipLeftPx = isRightHalf
      ? activePointPx - tipWidth - gap
      : activePointPx + gap;

    // Strict horizontal clamping to keep tooltip completely within container boundaries
    tipLeftPx = Math.max(6, Math.min(containerWidth - tipWidth - 6, Math.round(tipLeftPx)));

    const yDemand = getYDemand(activePoint.demand);
    const ySolar = getYSolar(activePoint.solar);
    const targetY = (yDemand + ySolar) / 2;

    // Strict vertical clamping to keep tooltip completely within container boundaries
    const rawTop = targetY > 90 ? targetY - tipHeight + 15 : targetY - 15;
    const tooltipTopPx = Math.max(6, Math.min(h - tipHeight - 6, Math.round(rawTop)));

    return {
      tipLeftPx,
      tooltipTopPx,
      tipWidth,
    };
  }, [hoverIndex, activePoint, energyData.length, w, h, scaleMode, containerWidth]);

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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <h3 className={styles.title}>Energy &amp; Solar Performance</h3>
            <p className={styles.subtitle}>{chartSubtitle}</p>
          </div>
        </div>

        {/* Controls: Range Filters + Scale Mode Toggle */}
        <div className={styles.controlsGroup}>
          {/* Time range selector */}
          <div className={styles.rangeTabs} role="group" aria-label="Time range filter">
            <button
              type="button"
              onClick={() => {
                setActiveRange('today');
                setHoverIndex(null);
              }}
              className={`${styles.rangeBtn} ${activeRange === 'today' ? styles.rangeActive : ''}`}
              title="Reporting day readings (Oct 12, 2026: 3 snapshots)"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveRange('24h');
                setHoverIndex(null);
              }}
              className={`${styles.rangeBtn} ${activeRange === '24h' ? styles.rangeActive : ''}`}
              title="Readings within 24-hour telemetry window"
            >
              24h
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveRange('7d');
                setHoverIndex(null);
              }}
              className={`${styles.rangeBtn} ${activeRange === '7d' ? styles.rangeActive : ''}`}
              title="Full multi-day monitoring baseline (Oct 12–16: 15 snapshots)"
            >
              7d
            </button>
          </div>

          {/* Scale mode toggle: Dual (default) vs. Shared */}
          <div className={styles.scaleTabs} role="group" aria-label="Y-axis scale mode">
            <button
              type="button"
              onClick={() => setScaleMode('dual')}
              className={`${styles.scaleBtn} ${scaleMode === 'dual' ? styles.scaleActiveDual : ''}`}
              title="Dual Y-Axis: campus demand on left (0–200 kW), solar PV on right (0–5 kW)"
            >
              Dual (0–5 kW)
            </button>
            <button
              type="button"
              onClick={() => setScaleMode('shared')}
              className={`${styles.scaleBtn} ${scaleMode === 'shared' ? styles.scaleActive : ''}`}
              title="Shared scale: both demand and solar plotted on 0–200 kW axis"
            >
              Shared
            </button>
          </div>
        </div>
      </div>

      {/* Telemetry Metric Strip: 4 KPIs in balanced grid */}
      <div className={styles.metricsStrip}>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Active Demand</span>
          <span className={styles.metricValue}>
            {hasValidDemand ? (
              <>
                {activePoint.demand.toFixed(1)} <span className={styles.metricUnit}>kW</span>
              </>
            ) : (
              <>— <span className={styles.metricUnit}>kW</span></>
            )}
          </span>
        </div>

        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Solar PV Yield</span>
          <span className={`${styles.metricValue} ${styles.solarAccent}`}>
            {hasValidSolar ? (
              <>
                {activePoint.solar.toFixed(2)} <span className={styles.metricUnit}>kW</span>
              </>
            ) : (
              <>— <span className={styles.metricUnit}>kW</span></>
            )}
          </span>
        </div>

        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Net Grid Import</span>
          <span className={`${styles.metricValue} ${styles.netAccent}`}>
            {hasValidDemand && hasValidSolar ? (
              <>
                {activePoint.netImport.toFixed(1)} <span className={styles.metricUnit}>kW</span>
              </>
            ) : (
              <>— <span className={styles.metricUnit}>kW</span></>
            )}
          </span>
        </div>

        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Solar Offset</span>
          <span className={`${styles.metricValue} ${styles.solarAccent}`}>
            {hasValidDemand && hasValidSolar ? (
              <>
                {activePoint.solarOffsetPct.toFixed(1)} <span className={styles.metricUnit}>%</span>
              </>
            ) : (
              '—'
            )}
          </span>
        </div>
      </div>

      {/* Performance Chart & Hover Tooltip Container */}
      <div className={styles.chartWrap}>
        {loading ? (
          <div className={styles.awaitingTelemetryWrap}>
            <div className={styles.awaitingHeadingRow}>
              <h4 className={styles.awaitingHeading}>Loading Telemetry Data...</h4>
            </div>
          </div>
        ) : hasData ? (
          <>
            <div
              className={styles.chartContainer}
              ref={containerRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onTouchStart={handleTouchMove}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseLeave}
            >
              <svg
                className={styles.svgChart}
                viewBox={`0 0 ${w} ${h}`}
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
                  </linearGradient>
                  <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0F9D8A" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#0F9D8A" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* Symmetrical Shared Grid Lines (0%, 50%, 100% height) */}
                {demandTicks.map((val) => {
                  const yPos = getYDemand(val);
                  return (
                    <g key={`grid-${val}`}>
                      <line
                        x1={padL}
                        y1={yPos}
                        x2={w - padR}
                        y2={yPos}
                        stroke="#E2E8F0"
                        strokeDasharray="3 3"
                      />
                      {/* Left Tick Dash */}
                      <line
                        x1={padL - 4}
                        y1={yPos}
                        x2={padL}
                        y2={yPos}
                        stroke="#2563EB"
                        strokeWidth="1.2"
                      />
                      {/* Left Y Axis Label (Demand: 0, 100, 200 kW) */}
                      <text x={padL - 6} y={yPos + 3.5} textAnchor="end" className={styles.axisTextLeft}>
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Right Y Axis Ticks in Dual Mode (Solar PV: 0.0, 2.5, 5.0 kW) */}
                {scaleMode === 'dual' &&
                  solarTicks.map((val) => {
                    const yPos = getYSolar(val);
                    return (
                      <g key={`solar-grid-${val}`}>
                        {/* Right Tick Dash */}
                        <line
                          x1={w - padR}
                          y1={yPos}
                          x2={w - padR + 4}
                          y2={yPos}
                          stroke="#0F9D8A"
                          strokeWidth="1.2"
                        />
                        <text x={w - padR + 6} y={yPos + 3.5} textAnchor="start" className={styles.axisTextRight}>
                          {val.toFixed(1)}
                        </text>
                      </g>
                    );
                  })}

                {/* Left Axis Title: Campus Demand (kW) */}
                <text
                  x={padL}
                  y={padT - 8}
                  textAnchor="start"
                  className={styles.axisTitleLeft}
                >
                  {scaleMode === 'dual' ? 'Campus Demand (kW)' : 'Demand & Solar (kW)'}
                </text>

                {/* Right Axis Title (Dual Mode): Solar PV (kW) */}
                {scaleMode === 'dual' && (
                  <text
                    x={w - padR}
                    y={padT - 8}
                    textAnchor="end"
                    className={styles.axisTitleRight}
                  >
                    Solar PV (kW)
                  </text>
                )}

                {/* Solar Array Capacity Reference Line (4.0 kWp Assumed Capacity) */}
                {scaleMode === 'dual' && (
                  <g>
                    <line
                      x1={padL}
                      y1={getYSolar(4.0)}
                      x2={w - padR}
                      y2={getYSolar(4.0)}
                      stroke="#0F9D8A"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                      opacity="0.5"
                    />
                    {/* Positioned on the left side to avoid colliding with right axis ticks */}
                    <text
                      x={padL + 6}
                      y={getYSolar(4.0) - 4}
                      textAnchor="start"
                      fill="#0F9D8A"
                      fontSize="8.5px"
                      fontWeight="600"
                      letterSpacing="0.02em"
                    >
                      4.0 kWp Assumed Capacity
                    </text>
                  </g>
                )}

                {/* Linear Polyline Paths */}
                {(() => {
                  const demandCoords = energyData.map((d, i) => ({
                    x: getX(i),
                    y: getYDemand(d.demand),
                  }));
                  const solarCoords = energyData.map((d, i) => ({
                    x: getX(i),
                    y: getYSolar(d.solar),
                  }));

                  const dLine = getPolylinePath(demandCoords);
                  const sLine = getPolylinePath(solarCoords);

                  const lastX = getX(energyData.length - 1);
                  const firstX = getX(0);
                  const baseY = padT + chartH;

                  const dArea = `${dLine} L ${lastX},${baseY} L ${firstX},${baseY} Z`;
                  const sArea = `${sLine} L ${lastX},${baseY} L ${firstX},${baseY} Z`;

                  return (
                    <>
                      {/* Solar Area & Path */}
                      <path d={sArea} fill="url(#solarGrad)" />
                      <path
                        d={sLine}
                        fill="none"
                        stroke="#0F9D8A"
                        strokeWidth={scaleMode === 'dual' ? '2.2' : '1.8'}
                        strokeLinejoin="round"
                      />

                      {/* Demand Area & Path */}
                      <path d={dArea} fill="url(#demandGrad)" />
                      <path
                        d={dLine}
                        fill="none"
                        stroke="#2563EB"
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                      />
                    </>
                  );
                })()}

                {/* Data Point Markers for Every Actual Reading */}
                {energyData.map((d, i) => {
                  const isHovered = hoverIndex === i;
                  const demandY = getYDemand(d.demand);
                  const solarY = getYSolar(d.solar);
                  const cx = getX(i);

                  return (
                    <g key={`pts-${i}`} pointerEvents="none">
                      {/* Demand Point Marker (Blue) */}
                      <circle
                        cx={cx}
                        cy={demandY}
                        r={isHovered ? 5.5 : 3.5}
                        fill="#FFFFFF"
                        stroke="#2563EB"
                        strokeWidth={isHovered ? 2.5 : 2}
                      />

                      {/* Solar Point Marker (Teal) */}
                      <circle
                        cx={cx}
                        cy={solarY}
                        r={isHovered ? 5.5 : 3.5}
                        fill="#FFFFFF"
                        stroke="#0F9D8A"
                        strokeWidth={isHovered ? 2.5 : 2}
                      />
                    </g>
                  );
                })}

                {/* X Axis Date / Time Labels */}
                {energyData.map((d, i) => {
                  let showLabel = false;
                  let labelText = d.timeLabel;

                  if (activeRange === 'today') {
                    showLabel = true;
                    labelText = d.timeLabel.replace(' IST', '');
                  } else if (activeRange === '24h') {
                    showLabel = true;
                    labelText = `${d.dateLabel.split(' ')[1]}th ${d.timeLabel.replace(' IST', '')}`;
                  } else if (activeRange === '7d') {
                    // Show date label on midday snapshot of each day (indices 1, 4, 7, 10, 13)
                    if (i % 3 === 1) {
                      showLabel = true;
                      labelText = d.dateLabel;
                    }
                  }

                  if (!showLabel) return null;

                  return (
                    <text
                      key={`time-${i}`}
                      x={getX(i)}
                      y={h - 6}
                      textAnchor="middle"
                      className={styles.axisText}
                    >
                      {labelText}
                    </text>
                  );
                })}

                {/* Hover Cursor Vertical Line and Indicator Rings */}
                {hoverIndex !== null && activePoint && (
                  <g pointerEvents="none">
                    <line
                      x1={getX(hoverIndex)}
                      y1={padT}
                      x2={getX(hoverIndex)}
                      y2={padT + chartH}
                      stroke="#475569"
                      strokeWidth="1.2"
                      strokeDasharray="2 2"
                      opacity="0.85"
                    />
                    <circle
                      cx={getX(hoverIndex)}
                      cy={getYDemand(activePoint.demand)}
                      r="5"
                      fill="#2563EB"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />
                    <circle
                      cx={getX(hoverIndex)}
                      cy={getYSolar(activePoint.solar)}
                      r="5"
                      fill="#0F9D8A"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />
                  </g>
                )}
              </svg>

              {/* HTML Overlay Tooltip - Strictly bounded, non-overlapping, crisp typography */}
              {tooltipParams && activePoint && (
                <div
                  className={styles.tooltipCard}
                  style={{
                    left: `${tooltipParams.tipLeftPx}px`,
                    top: `${tooltipParams.tooltipTopPx}px`,
                    width: `${tooltipParams.tipWidth}px`,
                  }}
                >
                  {/* Timestamp Header */}
                  <div className={styles.tipHeader}>
                    <span className={styles.tipTime}>{activePoint.timeLabel}</span>
                    <span className={styles.tipDate}>{activePoint.dateLabel}, 2026</span>
                  </div>

                  <div className={styles.tipDivider} />

                  {/* Row 1: Campus Demand */}
                  <div className={styles.tipMetricRow}>
                    <div className={styles.tipMetricLabelCol}>
                      <span className={styles.tipDemandDot} />
                      <span className={styles.tipMetricName}>Campus Demand</span>
                    </div>
                    <div className={styles.tipMetricValCol}>
                      <span className={styles.tipDemandVal}>{activePoint.demand.toFixed(1)}</span>
                      <span className={styles.tipUnit}>kW</span>
                    </div>
                  </div>

                  {/* Row 2: Solar PV */}
                  <div className={styles.tipMetricRow}>
                    <div className={styles.tipMetricLabelCol}>
                      <span className={styles.tipSolarDot} />
                      <span className={styles.tipMetricName}>Solar PV</span>
                      <span className={styles.tipSimTag}>SIM</span>
                    </div>
                    <div className={styles.tipMetricValCol}>
                      <span className={styles.tipSolarVal}>{activePoint.solar.toFixed(2)}</span>
                      <span className={styles.tipUnit}>kW</span>
                    </div>
                  </div>

                  <div className={styles.tipSubDivider} />

                  {/* Row 3: Net Grid Import */}
                  <div className={styles.tipMetricRow}>
                    <span className={styles.tipMetricNameSub}>Net Grid Import</span>
                    <div className={styles.tipMetricValCol}>
                      <span className={styles.tipNetVal}>{activePoint.netImport.toFixed(1)}</span>
                      <span className={styles.tipUnit}>kW</span>
                    </div>
                  </div>

                  {/* Row 4: Solar Offset */}
                  <div className={styles.tipMetricRow}>
                    <span className={styles.tipMetricNameSub}>Solar Offset</span>
                    <div className={styles.tipMetricValCol}>
                      <span className={styles.tipOffsetVal}>{activePoint.solarOffsetPct.toFixed(1)}</span>
                      <span className={styles.tipUnit}>%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Compact Single-Row Legend & Snapshot Indicator */}
            <div className={styles.legendRow}>
              <div className={styles.legendLeft}>
                <div className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: '#2563EB' }} />
                  <span className={styles.legendText}>
                    Demand <span className={styles.axisHint}>[0–200 kW]</span>
                  </span>
                </div>

                <div className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: '#0F9D8A' }} />
                  <span className={styles.legendText}>
                    Solar PV <span className={styles.simulatedTag}>[Simulated]</span>{' '}
                    <span className={styles.axisHint}>
                      {scaleMode === 'dual' ? '[0–5 kW]' : '[0–200 kW]'}
                    </span>
                  </span>
                </div>
              </div>

              {activePoint && (
                <div className={styles.hoverTimeBadge}>
                  Snapshot: <strong>{activePoint.timeLabel}</strong>
                  <span className={styles.hoverDateSub}> ({activePoint.dateLabel})</span>
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

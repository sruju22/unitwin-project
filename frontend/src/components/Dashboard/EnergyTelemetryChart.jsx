import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getEnergyUsage } from '../../api/client';
import {
  CAMPUS_TIMEZONE,
  parseCampusDate,
  getCampusDayKey,
  formatCampusDate,
  formatCampusTime,
} from '../../utils/dateUtils';
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

/**
 * Extracts a concise clock time (e.g. "07:00 AM" or "5:00 PM") from timestamp or label,
 * ensuring clean, non-colliding axis labels.
 */
function extractCleanTime(timestamp, label) {
  if (timestamp) {
    const d = parseCampusDate(timestamp);
    if (d) return formatCampusTime(d, { includeZone: false });
  }
  if (!label) return '';
  const m = label.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i);
  if (m) return m[1].toUpperCase();
  return label.replace(/\s*IST/i, '').trim();
}

export default function EnergyTelemetryChart({ reportingDate = '2026-10-14', onSelectDate }) {
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

  // Fetch telemetry: retrieve all available historical snapshots from the backend
  useEffect(() => {
    let isMounted = true;
    async function fetchTelemetry() {
      try {
        setLoading(true);
        const res = await getEnergyUsage({});
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
  }, []);

  // Reset hover snapshot selection whenever reporting date or temporal range changes
  useEffect(() => {
    setHoverIndex(null);
  }, [reportingDate, activeRange]);

  // Filter actual historical points in chronological order based on selected temporal window
  const energyData = useMemo(() => {
    if (!rawTimeline.length) return [];

    // Chronologically sorted historical timeline
    const sorted = [...rawTimeline].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Anchor to the selected reporting date (e.g. '2026-10-14') in Asia/Kolkata
    const targetDayKey = reportingDate || getCampusDayKey(new Date());
    const dayEndMs = new Date(`${targetDayKey}T23:59:59.999+05:30`).getTime();

    let points = sorted;
    if (activeRange === 'today') {
      // Readings strictly for the selected campus reporting day (Asia/Kolkata)
      points = sorted.filter(
        (p) => getCampusDayKey(p.timestamp) === targetDayKey
      );
    } else if (activeRange === '24h') {
      // 24-hour telemetry window ending at the end of the reporting date
      const window24h = 24 * 60 * 60 * 1000;
      points = sorted.filter((p) => {
        const t = new Date(p.timestamp).getTime();
        return t <= dayEndMs && dayEndMs - t <= window24h;
      });
    } else if (activeRange === '7d') {
      // 7-day baseline telemetry ending at the reporting date (prevents future date leakage)
      const window7d = 7 * 24 * 60 * 60 * 1000;
      points = sorted.filter((p) => {
        const t = new Date(p.timestamp).getTime();
        return t <= dayEndMs && dayEndMs - t <= window7d;
      });
    }

    // Deduplicate snapshots: ensure exactly one authoritative record per distinct observation time
    const seenTimes = new Set();
    const uniquePoints = [];
    for (const pt of points) {
      if (!pt || !pt.timestamp) continue;
      const d = parseCampusDate(pt.timestamp);
      const timeKey = d
        ? `${getCampusDayKey(d)}-${d.getUTCHours()}:${d.getUTCMinutes()}`
        : pt.timestamp;
      if (seenTimes.has(timeKey)) continue;
      seenTimes.add(timeKey);
      uniquePoints.push(pt);
    }

    return uniquePoints.map((pt, idx) => {
      const d = parseCampusDate(pt.timestamp);
      const hasDemand = pt.hasDemand !== false && pt.demandKw !== null && pt.demandKw !== undefined;
      const hasSolar = pt.hasSolar !== false && pt.solarKw !== null && pt.solarKw !== undefined;
      const demandVal = hasDemand ? Number(pt.demandKw) : null;
      const solarVal = hasSolar ? Number(pt.solarKw) : null;
      const netVal = hasDemand && hasSolar ? Number(Math.max(0, demandVal - solarVal).toFixed(1)) : null;
      const offsetVal = hasDemand && hasSolar && demandVal > 0 ? Number(((solarVal / demandVal) * 100).toFixed(1)) : (demandVal === 0 ? 0 : null);

      const dateLabel = formatCampusDate(d);
      const fullDateLabel = formatCampusDate(d, { includeYear: true });
      const dayKey = getCampusDayKey(d);
      const dayNumber = new Intl.DateTimeFormat('en-US', { timeZone: CAMPUS_TIMEZONE, day: 'numeric' }).format(d);
      const monthShort = new Intl.DateTimeFormat('en-US', { timeZone: CAMPUS_TIMEZONE, month: 'short' }).format(d);
      const year = new Intl.DateTimeFormat('en-US', { timeZone: CAMPUS_TIMEZONE, year: 'numeric' }).format(d);
      const timeLabel = pt.snapshotLabel || formatCampusTime(d);
      const cleanTime = extractCleanTime(pt.timestamp, timeLabel);

      // Decompose snapshot label into primary clock time and period descriptor
      let timeDisplay = timeLabel;
      let periodDisplay = null;
      if (timeLabel) {
        const parenMatch = timeLabel.match(/^(.*?)\s*\(([^)]+)\)$/);
        if (parenMatch) {
          timeDisplay = parenMatch[1].trim();
          periodDisplay = parenMatch[2].trim();
        } else {
          const dashMatch = timeLabel.match(/^(.*?\b(?:AM|PM|IST)\b)\s*[-–—]\s*(.+)$/i);
          if (dashMatch) {
            timeDisplay = dashMatch[1].trim();
            periodDisplay = dashMatch[2].trim();
          }
        }
      }

      return {
        id: idx,
        timestamp: pt.timestamp,
        dateLabel,
        fullDateLabel,
        dayKey,
        dayNumber,
        monthShort,
        year,
        timeLabel,
        timeDisplay,
        periodDisplay,
        cleanTime,
        fullLabel: `${fullDateLabel} · ${timeLabel}`,
        demand: demandVal,
        solar: solarVal,
        hasDemand,
        hasSolar,
        energyKWh: Number(pt.energyKWh) || 0,
        netImport: netVal,
        solarOffsetPct: offsetVal,
      };
    });
  }, [rawTimeline, activeRange, reportingDate]);

  const hasData = energyData.length > 0;

  // Active point for top metric strip and tooltip (hovered or latest point in range)
  const activePoint = hasData
    ? energyData[hoverIndex !== null && hoverIndex < energyData.length ? hoverIndex : energyData.length - 1]
    : null;

  // Dynamic concise subtitle based on active range and campus-local dates
  const chartSubtitle = useMemo(() => {
    const formattedTarget = reportingDate
      ? formatCampusDate(new Date(`${reportingDate}T12:00:00+05:30`), { includeYear: true })
      : 'Selected date';

    if (!energyData.length) {
      if (activeRange === 'today') return `${formattedTarget} · No telemetry recorded`;
      if (activeRange === '24h') return `24h window ending ${formattedTarget} · No snapshots`;
      return `7d baseline ending ${formattedTarget} · No snapshots`;
    }

    const firstPt = energyData[0];
    const lastPt = energyData[energyData.length - 1];
    const snapshotCount = `${energyData.length} snapshot${energyData.length === 1 ? '' : 's'}`;

    if (activeRange === 'today') {
      const timeSpan = `${firstPt.cleanTime} – ${lastPt.cleanTime} IST`;
      return `${lastPt.fullDateLabel} · ${snapshotCount} observed (${timeSpan})`;
    }

    if (activeRange === '24h') {
      return `24h window (${firstPt.dateLabel} ${firstPt.cleanTime} – ${lastPt.dateLabel} ${lastPt.cleanTime} IST) · ${snapshotCount}`;
    }

    const daysCount = new Set(energyData.map((d) => d.dayKey)).size;
    const dateRange = firstPt.dayKey === lastPt.dayKey
      ? firstPt.fullDateLabel
      : `${firstPt.dateLabel} – ${lastPt.fullDateLabel}`;
    return `${dateRange} baseline · ${snapshotCount} observed across ${daysCount} monitoring day${daysCount === 1 ? '' : 's'}`;
  }, [activeRange, energyData, reportingDate]);

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

  // Solar PV scale in Dual mode (0 – 20 kW) aligned symmetrically at the exact same heights (0, 10, 20)
  const maxSolarVal = 20.0;
  const solarTicks = [0, 10, 20];

  // Actual observation range bounds from the dataset
  const observationBounds = useMemo(() => {
    if (!energyData.length) return { firstTime: 0, lastTime: 0, spanMs: 0 };
    const firstTime = new Date(energyData[0].timestamp).getTime();
    const lastTime = new Date(energyData[energyData.length - 1].timestamp).getTime();
    const spanMs = Math.max(0, lastTime - firstTime);
    return { firstTime, lastTime, spanMs };
  }, [energyData]);

  // X coordinate mapping: begins at first actual snapshot, ends at last actual snapshot,
  // with 24px padding for point marker visibility without clipping
  const getX = useCallback((idx) => {
    if (!energyData.length || idx < 0 || idx >= energyData.length) return padL;
    if (energyData.length === 1) return padL + chartW / 2;

    const xPad = 24;
    const innerW = chartW - 2 * xPad;
    const { firstTime, spanMs } = observationBounds;

    if (spanMs > 0) {
      const t = new Date(energyData[idx].timestamp).getTime();
      const ratio = Math.max(0, Math.min(1, (t - firstTime) / spanMs));
      return padL + xPad + ratio * innerW;
    }

    return padL + xPad + (idx / (energyData.length - 1)) * innerW;
  }, [energyData, padL, chartW, observationBounds]);

  const getYDemand = useCallback((val) => {
    const clamped = Math.max(0, Math.min(val, maxDemandVal));
    return padT + chartH - (clamped / maxDemandVal) * chartH;
  }, [padT, chartH]);

  const getYSolar = useCallback((val) => {
    if (scaleMode === 'dual') {
      const clamped = Math.max(0, Math.min(val, maxSolarVal));
      return padT + chartH - (clamped / maxSolarVal) * chartH;
    }
    // Shared scale mode: Solar plotted on the same 0–200 kW scale
    const clamped = Math.max(0, Math.min(val, maxDemandVal));
    return padT + chartH - (clamped / maxDemandVal) * chartH;
  }, [scaleMode, padT, chartH]);

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

    // Content-aware width calculation
    const isCompact = containerWidth < 460;
    const tipWidth = isCompact
      ? Math.max(200, Math.min(216, containerWidth - 28))
      : containerWidth < 560
      ? 240
      : 264;

    // Content-aware height estimation to accommodate multi-line headers with period descriptors
    const hasLongHeader = Boolean(
      activePoint.periodDisplay || (activePoint.timeLabel && activePoint.timeLabel.length > 20)
    );
    const tipHeight = isCompact || hasLongHeader ? 134 : 122;
    const gap = isCompact ? 10 : 12;

    const spaceLeft = activePointPx - 8;
    const spaceRight = containerWidth - activePointPx - 8;

    // Prefer placing on the side with more available clearance
    const placeOnLeft = spaceLeft >= spaceRight;

    let tipLeftPx = placeOnLeft
      ? activePointPx - tipWidth - gap
      : activePointPx + gap;

    // Strict horizontal clamping to keep tooltip completely within container boundaries
    tipLeftPx = Math.max(8, Math.min(containerWidth - tipWidth - 8, Math.round(tipLeftPx)));

    // Vertical placement: Anchor in upper chart zone (top: 8px)
    // Leaves the bottom 42px (y: 138px to 180px) completely open and unobstructed
    // so X-axis tick marks, timestamps, and reporting dates are 100% visible at all times.
    const tooltipTopPx = 8;

    return {
      tipLeftPx,
      tooltipTopPx,
      tipWidth,
      tipHeight,
      isCompact,
    };
  }, [hoverIndex, activePoint, energyData.length, w, containerWidth, getX]);

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
              title="Reporting day readings for campus-local date"
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
              title="Full multi-day monitoring baseline"
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
              title="Dual Y-Axis: campus demand on left (0–200 kW), solar PV on right (0–20 kW)"
            >
              Dual (0–20 kW)
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
          <span className={styles.metricLabel}>Active Power Demand (kW)</span>
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
          <span className={styles.metricLabel}>
            Current Solar Output (kW) <span className={styles.simBadge}>[SIM]</span>
          </span>
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
          <span className={styles.metricLabel}>Net Grid Import (kW)</span>
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
          <span className={styles.metricLabel}>Solar Offset (%)</span>
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
                          {val}
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

                {/* Linear Polyline Paths & Area Fills */}
                {(() => {
                  const demandCoords = energyData
                    .map((d, i) => (d.demand !== null ? { x: getX(i), y: getYDemand(d.demand), i } : null))
                    .filter(Boolean);
                  const solarCoords = energyData
                    .map((d, i) => (d.solar !== null ? { x: getX(i), y: getYSolar(d.solar), i } : null))
                    .filter(Boolean);

                  const dLine = getPolylinePath(demandCoords);
                  const sLine = getPolylinePath(solarCoords);
                  const baseY = padT + chartH;

                  // Area fills cover only the recorded snapshot span, preventing artificial stretching
                  const dArea = demandCoords.length > 0
                    ? `${dLine} L ${demandCoords[demandCoords.length - 1].x},${baseY} L ${demandCoords[0].x},${baseY} Z`
                    : '';
                  const sArea = solarCoords.length > 0
                    ? `${sLine} L ${solarCoords[solarCoords.length - 1].x},${baseY} L ${solarCoords[0].x},${baseY} Z`
                    : '';

                  return (
                    <>
                      {/* Solar Area & Path */}
                      {sArea && <path d={sArea} fill="url(#solarGrad)" />}
                      {sLine && (
                        <path
                          d={sLine}
                          fill="none"
                          stroke="#0F9D8A"
                          strokeWidth={scaleMode === 'dual' ? '2.2' : '1.8'}
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Demand Area & Path */}
                      {dArea && <path d={dArea} fill="url(#demandGrad)" />}
                      {dLine && (
                        <path
                          d={dLine}
                          fill="none"
                          stroke="#2563EB"
                          strokeWidth="2.2"
                          strokeLinejoin="round"
                        />
                      )}
                    </>
                  );
                })()}

                {/* Data Point Markers for Every Actual Reading */}
                {energyData.map((d, i) => {
                  const isHovered = hoverIndex === i;
                  const cx = getX(i);
                  const pointRadius = isHovered ? 5.5 : 3.8;

                  return (
                    <g key={`pts-${i}`} pointerEvents="none">
                      {/* Demand Point Marker (Blue) */}
                      {d.demand !== null && (
                        <circle
                          cx={cx}
                          cy={getYDemand(d.demand)}
                          r={pointRadius}
                          fill="#FFFFFF"
                          stroke="#2563EB"
                          strokeWidth={isHovered ? 2.5 : 2}
                        />
                      )}

                      {/* Solar Point Marker (Teal) */}
                      {d.solar !== null && (
                        <circle
                          cx={cx}
                          cy={getYSolar(d.solar)}
                          r={pointRadius}
                          fill="#FFFFFF"
                          stroke="#0F9D8A"
                          strokeWidth={isHovered ? 2.5 : 2}
                        />
                      )}
                    </g>
                  );
                })}

                {/* X Axis Date / Time Labels (Directly aligned with actual snapshot observation timestamps) */}
                {activeRange === 'today' &&
                  energyData.map((d, i) => {
                    const cx = getX(i);
                    const textAnchor = i === 0 ? 'start' : i === energyData.length - 1 ? 'end' : 'middle';
                    return (
                      <text
                        key={`today-tick-${i}`}
                        x={cx}
                        y={h - 6}
                        textAnchor={textAnchor}
                        className={styles.axisText}
                      >
                        {d.cleanTime}
                      </text>
                    );
                  })}

                {activeRange === '24h' &&
                  energyData.map((d, i) => {
                    const cx = getX(i);
                    const textAnchor = i === 0 ? 'start' : i === energyData.length - 1 ? 'end' : 'middle';
                    const label = i === 0 || d.dayKey !== energyData[Math.max(0, i - 1)].dayKey
                      ? `${d.dateLabel} ${d.cleanTime}`
                      : d.cleanTime;
                    return (
                      <text
                        key={`24h-tick-${i}`}
                        x={cx}
                        y={h - 6}
                        textAnchor={textAnchor}
                        className={styles.axisText}
                      >
                        {label}
                      </text>
                    );
                  })}

                {activeRange === '7d' && (
                  <>
                    {(() => {
                      const dayGroups = {};
                      energyData.forEach((d, idx) => {
                        if (!dayGroups[d.dayKey]) dayGroups[d.dayKey] = [];
                        dayGroups[d.dayKey].push({ ...d, idx });
                      });

                      const days = Object.keys(dayGroups);

                      return days.map((dayKey, dIndex) => {
                        const dayPoints = dayGroups[dayKey];
                        const midPt = dayPoints[Math.floor(dayPoints.length / 2)];
                        const midX = getX(midPt.idx);

                        const dividerX = dIndex > 0
                          ? (getX(dayGroups[days[dIndex - 1]].slice(-1)[0].idx) + getX(dayPoints[0].idx)) / 2
                          : null;

                        return (
                          <g key={`day-tick-${dayKey}`}>
                            {dividerX !== null && (
                              <line
                                x1={dividerX}
                                y1={padT}
                                x2={dividerX}
                                y2={padT + chartH}
                                stroke="#E2E8F0"
                                strokeDasharray="2 2"
                                opacity="0.8"
                              />
                            )}
                            <text
                              x={midX}
                              y={h - 6}
                              textAnchor="middle"
                              className={styles.axisText}
                            >
                              {midPt.dateLabel}
                            </text>
                          </g>
                        );
                      });
                    })()}
                  </>
                )}

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
                    {activePoint.demand !== null && (
                      <circle
                        cx={getX(hoverIndex)}
                        cy={getYDemand(activePoint.demand)}
                        r="5"
                        fill="#2563EB"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                    )}
                    {activePoint.solar !== null && (
                      <circle
                        cx={getX(hoverIndex)}
                        cy={getYSolar(activePoint.solar)}
                        r="5"
                        fill="#0F9D8A"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                    )}
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
                  {/* Timestamp & Date Header */}
                  <div className={`${styles.tipHeader} ${tooltipParams.isCompact ? styles.tipHeaderStacked : ''}`}>
                    <div className={styles.tipTitleCol}>
                      <span className={styles.tipTime}>{activePoint.timeDisplay || activePoint.timeLabel}</span>
                      {activePoint.periodDisplay && (
                        <span className={styles.tipPeriod}>({activePoint.periodDisplay})</span>
                      )}
                    </div>
                    <div className={styles.tipDateCol}>
                      <span className={styles.tipDate}>{activePoint.fullDateLabel}</span>
                    </div>
                  </div>

                  <div className={styles.tipDivider} />

                  {/* Row 1: Active Power Demand */}
                  <div className={styles.tipMetricRow}>
                    <div className={styles.tipMetricLabelCol}>
                      <span className={styles.tipDemandDot} />
                      <span className={styles.tipMetricName}>Active Power Demand</span>
                    </div>
                    <div className={styles.tipMetricValCol}>
                      {activePoint.demand !== null ? (
                        <>
                          <span className={styles.tipDemandVal}>{activePoint.demand.toFixed(1)}</span>
                          <span className={styles.tipUnit}>kW</span>
                        </>
                      ) : (
                        <span className={styles.tipDemandVal}>—</span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Current Solar Output */}
                  <div className={styles.tipMetricRow}>
                    <div className={styles.tipMetricLabelCol}>
                      <span className={styles.tipSolarDot} />
                      <span className={styles.tipMetricName}>Current Solar Output</span>
                      <span className={styles.tipSimTag}>SIM</span>
                    </div>
                    <div className={styles.tipMetricValCol}>
                      {activePoint.solar !== null ? (
                        <>
                          <span className={styles.tipSolarVal}>{activePoint.solar.toFixed(2)}</span>
                          <span className={styles.tipUnit}>kW</span>
                        </>
                      ) : (
                        <span className={styles.tipSolarVal}>—</span>
                      )}
                    </div>
                  </div>

                  <div className={styles.tipSubDivider} />

                  {/* Row 3: Net Grid Import */}
                  <div className={styles.tipMetricRow}>
                    <div className={styles.tipMetricLabelCol}>
                      <span className={styles.tipNetDot} />
                      <span className={styles.tipMetricNameSub}>Net Grid Import</span>
                    </div>
                    <div className={styles.tipMetricValCol}>
                      {activePoint.netImport !== null ? (
                        <>
                          <span className={styles.tipNetVal}>{activePoint.netImport.toFixed(1)}</span>
                          <span className={styles.tipUnit}>kW</span>
                        </>
                      ) : (
                        <span className={styles.tipNetVal}>—</span>
                      )}
                    </div>
                  </div>

                  {/* Row 4: Solar Offset */}
                  <div className={styles.tipMetricRow}>
                    <div className={styles.tipMetricLabelCol}>
                      <span className={styles.tipOffsetDot} />
                      <span className={styles.tipMetricNameSub}>Solar Offset</span>
                    </div>
                    <div className={styles.tipMetricValCol}>
                      {activePoint.solarOffsetPct !== null ? (
                        <>
                          <span className={styles.tipOffsetVal}>{activePoint.solarOffsetPct.toFixed(1)}</span>
                          <span className={styles.tipUnit}>%</span>
                        </>
                      ) : (
                        <span className={styles.tipOffsetVal}>—</span>
                      )}
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
                    Active Power Demand <span className={styles.axisHint}>[0–200 kW]</span>
                  </span>
                </div>

                <div className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: '#0F9D8A' }} />
                  <span className={styles.legendText}>
                    Current Solar Output <span className={styles.simulatedTag}>[Simulated]</span>{' '}
                    <span className={styles.axisHint}>
                      {scaleMode === 'dual' ? '[0–20 kW]' : '[0–200 kW]'}
                    </span>
                  </span>
                </div>
              </div>

              {activePoint && (
                <div className={styles.hoverTimeBadge}>
                  {hoverIndex !== null ? 'Snapshot: ' : 'Latest observation: '}
                  <strong>{activePoint.timeLabel}</strong>
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
                  <h4 className={styles.awaitingHeading}>
                    {reportingDate
                      ? `No Telemetry Logged for ${formatCampusDate(new Date(`${reportingDate}T12:00:00+05:30`), { includeYear: true })}`
                      : 'Awaiting Energy Telemetry Feed'}
                  </h4>
                  <span className={styles.awaitingTag}>No Readings</span>
                </div>
                <p className={styles.awaitingDesc}>
                  Smart meter and solar telemetry have no recorded readings for this reporting date. Select an active telemetry date to inspect performance curves:
                </p>
                {onSelectDate && (
                  <div className={styles.awaitingActionsRow}>
                    <button
                      type="button"
                      className={styles.awaitingDateBtn}
                      onClick={() => onSelectDate('2026-10-14')}
                    >
                      <span className={styles.awaitingDot} />
                      Oct 14, 2026 (Active)
                    </button>
                    <button
                      type="button"
                      className={styles.awaitingDateBtn}
                      onClick={() => onSelectDate('2026-10-17')}
                    >
                      Oct 17, 2026
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

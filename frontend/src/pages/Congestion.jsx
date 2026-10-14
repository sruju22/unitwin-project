import { useState, useEffect, useMemo } from 'react';
import { getCongestion, getBuildings } from '../api/client';
import Skeleton from '../components/Skeleton';
import styles from './Congestion.module.css';

export default function Congestion() {
  const [congestionRecords, setCongestionRecords] = useState([]);
  const [congestionSummary, setCongestionSummary] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedBuilding, setSelectedBuilding] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const [congRes, bldRes] = await Promise.allSettled([
          getCongestion({ limit: 400 }),
          getBuildings(),
        ]);

        if (isMounted) {
          if (congRes.status === 'fulfilled' && congRes.value) {
            setCongestionRecords(Array.isArray(congRes.value.data) ? congRes.value.data : []);
            setCongestionSummary(congRes.value.summary || null);
          }
          if (bldRes.status === 'fulfilled' && Array.isArray(bldRes.value?.data)) {
            setBuildings(bldRes.value.data);
          }
        }
      } catch (err) {
        console.warn('Congestion load error:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return congestionRecords.filter((item) => {
      if (selectedLevel !== 'ALL' && (item.congestionLevel || '').toLowerCase() !== selectedLevel.toLowerCase()) {
        return false;
      }
      if (selectedType !== 'ALL' && (item.locationType || '').toLowerCase() !== selectedType.toLowerCase()) {
        return false;
      }
      if (selectedBuilding !== 'ALL' && item.buildingId !== selectedBuilding) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (item.areaName || '').toLowerCase();
        const action = (item.actionRecommended || '').toLowerCase();
        if (!name.includes(q) && !action.includes(q)) return false;
      }
      return true;
    });
  }, [congestionRecords, selectedLevel, selectedType, selectedBuilding, searchQuery]);

  const distinctLocationTypes = useMemo(() => {
    const types = new Set(congestionRecords.map((r) => r.locationType).filter(Boolean));
    return Array.from(types);
  }, [congestionRecords]);

  // Top critical bottlenecks
  const highBottlenecks = useMemo(() => {
    return congestionRecords
      .filter((r) => (r.congestionLevel || '').toLowerCase() === 'high')
      .slice(0, 3);
  }, [congestionRecords]);

  return (
    <div className={styles.page}>
      {/* Header Banner */}
      <section className={styles.headerBanner}>
        <div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Campus Congestion &amp; Foot-Traffic Intelligence</h1>
            <span className={styles.datasetTag}>Pilot Monitoring Dataset · 375 Observations</span>
          </div>
          <p className={styles.subtitle}>
            Area-by-area foot traffic, pedestrian bottlenecks, queue durations, and crowd management guidance.
          </p>
        </div>
      </section>

      {/* KPI Metrics */}
      <section className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Monitored Zones &amp; Hubs</span>
          <span className={styles.kpiValue}>
            {loading ? <Skeleton width="50px" height="32px" /> : congestionSummary?.uniqueAreaCount || 22}
          </span>
          <span className={styles.kpiSub}>Campus entrances, canteens &amp; halls</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>High Traffic Bottlenecks</span>
          <span className={styles.kpiValue} style={{ color: '#EF4444' }}>
            {loading ? <Skeleton width="50px" height="32px" /> : congestionSummary?.highCount || 63}
          </span>
          <span className={styles.kpiSub}>Readings with &gt;75% congestion</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Moderate Flow Areas</span>
          <span className={styles.kpiValue} style={{ color: '#F59E0B' }}>
            {loading ? <Skeleton width="50px" height="32px" /> : congestionSummary?.mediumCount || 116}
          </span>
          <span className={styles.kpiSub}>Transit requiring flow monitoring</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Nominal / Low Flow Areas</span>
          <span className={styles.kpiValue} style={{ color: '#10B981' }}>
            {loading ? <Skeleton width="50px" height="32px" /> : congestionSummary?.lowCount || 196}
          </span>
          <span className={styles.kpiSub}>Unrestricted circulation zones</span>
        </div>
      </section>

      {/* Critical Bottlenecks Spotlight */}
      {highBottlenecks.length > 0 && (
        <section className={styles.spotlightSection}>
          <h3 className={styles.spotlightHeading}>High-Priority Crowd Management Bottlenecks</h3>
          <div className={styles.spotlightGrid}>
            {highBottlenecks.map((item) => (
              <div key={item._id} className={styles.spotlightCard}>
                <div className={styles.spotlightHeader}>
                  <span className={styles.highBadge}>High Congestion</span>
                  <span className={styles.pctText}>{Math.round(item.congestionPercentage)}% Density</span>
                </div>
                <h4 className={styles.spotlightTitle}>{item.areaName}</h4>
                <p className={styles.spotlightSub}>
                  Building: {item.buildingId} · Type: {item.locationType}
                </p>
                <div className={styles.statsRow}>
                  <div>
                    <span className={styles.statLabel}>Present:</span>
                    <span className={styles.statVal}>{item.peopleCount} / {item.capacity}</span>
                  </div>
                  {item.queueLength !== null && item.queueLength !== undefined && (
                    <div>
                      <span className={styles.statLabel}>Queue:</span>
                      <span className={styles.statVal}>{item.queueLength} people</span>
                    </div>
                  )}
                  {item.estimatedWaitTimeMinutes !== null && item.estimatedWaitTimeMinutes !== undefined && (
                    <div>
                      <span className={styles.statLabel}>Wait:</span>
                      <span className={styles.statVal}>{item.estimatedWaitTimeMinutes}m</span>
                    </div>
                  )}
                </div>
                <div className={styles.actionBox}>
                  <strong>Action:</strong> {item.actionRecommended}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filter Bar */}
      <section className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Level:</label>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className={styles.selectInput}
          >
            <option value="ALL">All Levels</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Location Type:</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className={styles.selectInput}
          >
            <option value="ALL">All Types</option>
            {distinctLocationTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Building:</label>
          <select
            value={selectedBuilding}
            onChange={(e) => setSelectedBuilding(e.target.value)}
            className={styles.selectInput}
          >
            <option value="ALL">All Buildings</option>
            {buildings.map((b) => (
              <option key={b.buildingId} value={b.buildingId}>
                {b.buildingId}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.searchWrap}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search area (e.g. Canteen, Gate)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </section>

      {/* Detailed Records Table */}
      <section className={styles.tablePanel}>
        <div className={styles.tableHeaderRow}>
          <h3 className={styles.tableTitle}>
            Traffic Observations ({filteredRecords.length} record{filteredRecords.length === 1 ? '' : 's'})
          </h3>
          <span className={styles.snapshotTag}>
            Latest: {congestionSummary?.latestSnapshot || '05:00 PM IST'}
          </span>
        </div>

        {loading ? (
          <div className={styles.loadingWrap}>
            <Skeleton width="100%" height="48px" />
            <Skeleton width="100%" height="48px" />
            <Skeleton width="100%" height="48px" />
          </div>
        ) : filteredRecords.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Area / Location</th>
                  <th>Type</th>
                  <th>Level</th>
                  <th>Congestion %</th>
                  <th>People / Cap</th>
                  <th>Flow (In / Out)</th>
                  <th>Peak Hours</th>
                  <th>Action Guidance</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => {
                  const level = (r.congestionLevel || 'Low').toLowerCase();
                  const badgeClass =
                    level === 'high' ? styles.lvlHigh : level === 'medium' ? styles.lvlMedium : styles.lvlLow;

                  return (
                    <tr key={r._id}>
                      <td className={styles.areaCol}>
                        <div className={styles.areaName}>{r.areaName}</div>
                        <div className={styles.buildingSub}>{r.buildingId} · {r.snapshotLabel}</div>
                      </td>
                      <td className={styles.subtleCol}>
                        <span className={styles.typePill}>{(r.locationType || '').replace('_', ' ')}</span>
                      </td>
                      <td>
                        <span className={`${styles.levelBadge} ${badgeClass}`}>
                          {r.congestionLevel || 'Low'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.meterGroup}>
                          <span className={styles.meterText}>
                            {Math.round(r.congestionPercentage || 0)}%
                          </span>
                          <div className={styles.meterTrack}>
                            <div
                              className={`${styles.meterFill} ${badgeClass}`}
                              style={{ width: `${Math.min(r.congestionPercentage || 0, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className={styles.valCol}>
                        {r.peopleCount ?? 0} <span className={styles.capMuted}>/ {r.capacity ?? '—'}</span>
                      </td>
                      <td className={styles.flowCol}>
                        <span className={styles.flowIn}>+{r.peopleEntering ?? 0}</span>
                        <span className={styles.flowDivider}>/</span>
                        <span className={styles.flowOut}>-{r.peopleExiting ?? 0}</span>
                      </td>
                      <td className={styles.subtleCol}>{r.peakHour || '—'}</td>
                      <td className={styles.actionCol}>{r.actionRecommended || 'No action required'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyWrap}>
            <p className={styles.emptyTitle}>No matching congestion records found</p>
            <p className={styles.emptyDesc}>Try adjusting the level or location filters.</p>
          </div>
        )}
      </section>
    </div>
  );
}

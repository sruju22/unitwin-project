import { useState, useEffect, useMemo } from 'react';
import { getOccupancy, getBuildings, getRooms } from '../api/client';
import { formatCampusDate, formatCampusTime } from '../utils/dateUtils';
import { getRoomDisplayName, hasDesignatedLabName } from '../utils/roomUtils';
import Skeleton from '../components/Skeleton';
import styles from './Occupancy.module.css';

export default function Occupancy() {
  const [occupancyData, setOccupancyData] = useState([]);
  const [occupancySummary, setOccupancySummary] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedSnapshot, setSelectedSnapshot] = useState('LATEST');
  const [selectedBuilding, setSelectedBuilding] = useState('ALL');
  const [selectedFloor, setSelectedFloor] = useState('ALL');
  const [selectedUtilization, setSelectedUtilization] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      const stored = sessionStorage.getItem('unitwin_global_search_term');
      if (stored) {
        sessionStorage.removeItem('unitwin_global_search_term');
        return stored;
      }
      const hash = window.location.hash;
      if (hash.includes('q=')) {
        const match = hash.match(/q=([^&]+)/);
        if (match) return decodeURIComponent(match[1]);
      }
    } catch {
      // ignore
    }
    return '';
  });

  // Sync search query when hash or session changes
  useEffect(() => {
    const syncExternalSearch = () => {
      try {
        let term = sessionStorage.getItem('unitwin_global_search_term');
        if (!term && window.location.hash.includes('q=')) {
          const match = window.location.hash.match(/q=([^&]+)/);
          if (match) term = decodeURIComponent(match[1]);
        }
        if (term) {
          sessionStorage.removeItem('unitwin_global_search_term');
          setSearchQuery(term);
        }
      } catch {
        // ignore
      }
    };
    syncExternalSearch();
    window.addEventListener('hashchange', syncExternalSearch);
    return () => window.removeEventListener('hashchange', syncExternalSearch);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const occParams = { limit: 500 };
        if (selectedSnapshot !== 'LATEST') {
          occParams.snapshotTimestamp = selectedSnapshot;
        }
        const [occRes, bldRes, roomRes] = await Promise.allSettled([
          getOccupancy(occParams),
          getBuildings(),
          getRooms(),
        ]);

        if (isMounted) {
          if (occRes.status === 'fulfilled' && occRes.value) {
            setOccupancyData(Array.isArray(occRes.value.data) ? occRes.value.data : []);
            setOccupancySummary(occRes.value.summary || null);
          }
          if (bldRes.status === 'fulfilled' && Array.isArray(bldRes.value?.data)) {
            setBuildings(bldRes.value.data);
          }
          if (roomRes.status === 'fulfilled' && Array.isArray(roomRes.value?.data)) {
            setRooms(roomRes.value.data);
          }
        }
      } catch (err) {
        console.warn('Occupancy load error:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [selectedSnapshot]);

  const availableSnapshots = useMemo(() => {
    if (!occupancySummary?.timeline) return [];
    return [...occupancySummary.timeline].reverse();
  }, [occupancySummary?.timeline]);

  const activeSnapshotDate = occupancySummary?.timestamp
    ? formatCampusDate(occupancySummary.timestamp)
    : 'Oct 17, 2026';

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return occupancyData.filter((item) => {
      if (selectedBuilding !== 'ALL' && item.buildingId !== selectedBuilding) return false;
      if (selectedFloor !== 'ALL') {
        const floorMatch = rooms.find((r) => r.roomNumber === item.roomNumber);
        const floor = floorMatch ? String(floorMatch.floorNumber) : null;
        if (floor !== selectedFloor) return false;
      }
      if (selectedUtilization === 'HIGH' && (item.utilization || 0) < 70) return false;
      if (selectedUtilization === 'MEDIUM' && ((item.utilization || 0) < 30 || (item.utilization || 0) >= 70)) return false;
      if (selectedUtilization === 'LOW' && (item.utilization || 0) >= 30) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const roomNum = (item.roomNumber || '').toLowerCase();
        const type = (item.roomType || '').toLowerCase();
        const matchedRoom = rooms.find((rm) => rm.roomNumber === item.roomNumber);
        const name = (matchedRoom?.roomName || matchedRoom?.name || '').toLowerCase();
        const subj = Array.isArray(item.subjects) ? item.subjects.join(' ').toLowerCase() : '';
        if (!roomNum.includes(q) && !type.includes(q) && !name.includes(q) && !subj.includes(q)) return false;
      }
      return true;
    });
  }, [occupancyData, selectedBuilding, selectedFloor, selectedUtilization, searchQuery, rooms]);

  const highUtilCount = occupancyData.filter((o) => (o.utilization || 0) >= 70).length;
  const scheduledCount = occupancyData.filter((o) => o.scheduled).length;

  return (
    <div className={styles.page}>
      {/* Header Banner */}
      <section className={styles.headerBanner}>
        <div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Campus Occupancy &amp; Space Utilization</h1>
            <span className={styles.datasetTag}>Pilot Telemetry · {activeSnapshotDate} Snapshot</span>
          </div>
          <p className={styles.subtitle}>
            Room-by-room physical headcount, scheduled timetable alignment, and capacity utilization.
          </p>
        </div>
      </section>

      {/* KPI Cards */}
      <section className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Campus Headcount</span>
          <span className={styles.kpiValue}>
            {loading ? <Skeleton width="80px" height="32px" /> : `${occupancySummary?.totalOccupancy?.toLocaleString() || '2,246'}`}
          </span>
          <span className={styles.kpiSub}>Present across campus rooms</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Average Space Utilization</span>
          <span className={styles.kpiValue}>
            {loading ? <Skeleton width="70px" height="32px" /> : `${Math.round(occupancySummary?.averageUtilization || 31)}%`}
          </span>
          <span className={styles.kpiSub}>7,302 Total Seating Capacity</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Rooms in Active Session</span>
          <span className={styles.kpiValue}>
            {loading ? <Skeleton width="60px" height="32px" /> : scheduledCount}
          </span>
          <span className={styles.kpiSub}>Classes or labs scheduled</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>High Capacity Rooms (&gt;70%)</span>
          <span className={styles.kpiValue} style={{ color: highUtilCount > 0 ? '#EF4444' : 'inherit' }}>
            {loading ? <Skeleton width="50px" height="32px" /> : highUtilCount}
          </span>
          <span className={styles.kpiSub}>Potential overcrowding risk</span>
        </div>
      </section>

      {/* Controls & Filter Bar */}
      <section className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Snapshot:</label>
          <select
            value={selectedSnapshot}
            onChange={(e) => setSelectedSnapshot(e.target.value)}
            className={styles.selectInput}
          >
            <option value="LATEST">
              Latest Telemetry ({activeSnapshotDate} · {occupancySummary?.snapshotLabel || 'Live'})
            </option>
            {availableSnapshots.map((snap) => (
              <option key={snap.timestamp} value={snap.timestamp}>
                {formatCampusDate(snap.timestamp)} · {snap.snapshotLabel} ({snap.roomCount || snap.totalOccupancy} {snap.roomCount ? 'rooms' : 'headcount'})
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
                {b.buildingId} · {b.buildingName}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Floor:</label>
          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value)}
            className={styles.selectInput}
          >
            <option value="ALL">All Floors</option>
            <option value="0">Ground Floor (0)</option>
            <option value="1">First Floor (1)</option>
            <option value="2">Second Floor (2)</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Utilization:</label>
          <select
            value={selectedUtilization}
            onChange={(e) => setSelectedUtilization(e.target.value)}
            className={styles.selectInput}
          >
            <option value="ALL">All Levels</option>
            <option value="HIGH">High (&gt; 70%)</option>
            <option value="MEDIUM">Medium (30% – 70%)</option>
            <option value="LOW">Low (&lt; 30%)</option>
          </select>
        </div>

        <div className={styles.searchWrap}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search room (e.g. C-102, Lab)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </section>

      {/* Rooms Table / Grid */}
      <section className={styles.tablePanel}>
        <div className={styles.tableHeaderRow}>
          <h3 className={styles.tableTitle}>
            Cataloged Spaces ({filteredRooms.length} room{filteredRooms.length === 1 ? '' : 's'})
          </h3>
          <span className={styles.snapshotTag}>
            Snapshot: {occupancySummary?.snapshotLabel || 'Live'} ({activeSnapshotDate})
          </span>
        </div>

        {loading ? (
          <div className={styles.loadingWrap}>
            <Skeleton width="100%" height="48px" />
            <Skeleton width="100%" height="48px" />
            <Skeleton width="100%" height="48px" />
          </div>
        ) : filteredRooms.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Building</th>
                  <th>Room Type</th>
                  <th>Headcount</th>
                  <th>Capacity</th>
                  <th>Utilization</th>
                  <th>Schedule Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((r) => {
                  const util = r.utilization !== undefined ? r.utilization : Math.round(((r.occupancy || 0) / (r.capacity || 1)) * 100);
                  const utilColor = util >= 70 ? '#EF4444' : util >= 35 ? '#F59E0B' : '#10B981';
                  const matchedRoom = rooms.find((rm) => rm.roomNumber === r.roomNumber) || r;
                  const displayName = getRoomDisplayName(matchedRoom);
                  const hasCustom = hasDesignatedLabName(matchedRoom);

                  return (
                    <tr key={r._id || r.roomNumber}>
                      <td className={styles.roomNumCol}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span className={styles.roomBadge}>{r.roomNumber}</span>
                          {hasCustom && (
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#0284c7' }}>
                              {displayName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={styles.subtleCol}>{r.buildingId}</td>
                      <td>
                        <span className={styles.typeTag}>
                          {hasCustom ? (matchedRoom.roomType || 'Laboratory') : (r.roomType || 'Space')}
                        </span>
                      </td>
                      <td className={styles.valCol}>{r.occupancy ?? 0}</td>
                      <td className={styles.subtleCol}>{r.capacity ?? '—'}</td>
                      <td>
                        <div className={styles.utilGroup}>
                          <span className={styles.utilText} style={{ color: utilColor }}>
                            {util}%
                          </span>
                          <div className={styles.miniTrack}>
                            <div
                              className={styles.miniFill}
                              style={{ width: `${Math.min(util, 100)}%`, background: utilColor }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        {r.scheduled ? (
                          <span className={styles.statusActive}>
                            In Session {r.subjects?.[0] ? `· ${r.subjects[0].slice(0, 24)}...` : ''}
                          </span>
                        ) : (
                          <span className={styles.statusVacant}>Unscheduled / Free</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyWrap}>
            <p className={styles.emptyTitle}>No matching rooms found</p>
            <p className={styles.emptyDesc}>Try adjusting the building, floor, or utilization filters.</p>
          </div>
        )}
      </section>
    </div>
  );
}

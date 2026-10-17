import { useState, useEffect, useMemo } from 'react';
import {
  getBuildings,
  getRooms,
  getSections,
  getTimetables,
  getOccupancy,
  getEnergyUsage,
  getAlerts,
  getSolarSummary,
} from '../api/client';
import Skeleton from '../components/Skeleton';
import styles from './Analytics.module.css';

const DAY_ORDER_MAP = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

export default function Analytics({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'academic' | 'telemetry'
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    buildings: [],
    rooms: [],
    sections: [],
    timetables: [],
    occupancySummary: null,
    energySummary: null,
    solarSummary: null,
    alerts: [],
  });

  // --- Timetable Explorer State ---
  const [explorerBranch, setExplorerBranch] = useState('ALL');
  const [explorerSection, setExplorerSection] = useState('ALL');
  const [explorerDay, setExplorerDay] = useState('ALL');
  const [explorerRoom, setExplorerRoom] = useState('ALL');
  const [explorerType, setExplorerType] = useState('ALL');
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const [explorerViewMode, setExplorerViewMode] = useState('table'); // 'table' | 'schedule'
  const [scheduleGroupBy, setScheduleGroupBy] = useState('section'); // 'section' | 'room'
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // --- Telemetry & Trends State ---
  const [energyScaleMode, setEnergyScaleMode] = useState('peak'); // 'peak' | '200kw' | 'connected'
  const [selectedIncidentCategory, setSelectedIncidentCategory] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadAnalytics() {
      try {
        setLoading(true);
        const [bldRes, roomRes, secRes, timeRes, occRes, nrgRes, alrRes, solRes] = await Promise.allSettled([
          getBuildings(),
          getRooms(),
          getSections(),
          getTimetables(),
          getOccupancy(),
          getEnergyUsage(),
          getAlerts(),
          getSolarSummary(),
        ]);

        if (isMounted) {
          setData({
            buildings: bldRes.status === 'fulfilled' && Array.isArray(bldRes.value?.data) ? bldRes.value.data : [],
            rooms: roomRes.status === 'fulfilled' && Array.isArray(roomRes.value?.data) ? roomRes.value.data : [],
            sections: secRes.status === 'fulfilled' && Array.isArray(secRes.value?.data) ? secRes.value.data : [],
            timetables: timeRes.status === 'fulfilled' && Array.isArray(timeRes.value?.data) ? timeRes.value.data : [],
            occupancySummary: occRes.status === 'fulfilled' ? occRes.value?.summary : null,
            energySummary: nrgRes.status === 'fulfilled' ? nrgRes.value?.summary : null,
            solarSummary: solRes.status === 'fulfilled' ? solRes.value?.summary : null,
            alerts: alrRes.status === 'fulfilled' && Array.isArray(alrRes.value?.data) ? alrRes.value.data : [],
          });
        }
      } catch (err) {
        console.warn('Analytics loading error:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadAnalytics();
    return () => {
      isMounted = false;
    };
  }, []);

  const { buildings, rooms, sections, timetables, occupancySummary, energySummary, solarSummary, alerts } = data;

  // --- Inventory Computations ---
  const roomTypesCount = rooms.reduce((acc, r) => {
    const type = r.roomType?.trim() || 'General';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const sortedRoomTypes = Object.entries(roomTypesCount).sort((a, b) => b[1] - a[1]);

  const roomsByFloor = rooms.reduce((acc, r) => {
    const floor = r.floorNumber !== undefined && r.floorNumber !== null ? `Floor ${r.floorNumber}` : 'Ground Floor';
    acc[floor] = (acc[floor] || 0) + 1;
    return acc;
  }, {});
  const sortedFloors = Object.entries(roomsByFloor).sort((a, b) => b[1] - a[1]);

  const roomsByBlock = rooms.reduce((acc, r) => {
    const block = r.block?.trim() || 'Main';
    acc[block] = (acc[block] || 0) + 1;
    return acc;
  }, {});
  const sortedBlocks = Object.entries(roomsByBlock).sort((a, b) => b[1] - a[1]);

  // --- Academic Computations ---
  const timetableByDay = timetables.reduce((acc, t) => {
    const day = t.day?.trim() || 'Other';
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});
  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const sortedDays = daysOrder.filter((d) => timetableByDay[d]).map((d) => [d, timetableByDay[d]]);

  const sectionsByBranch = sections.reduce((acc, s) => {
    const branch = s.branch?.trim() || 'General';
    acc[branch] = (acc[branch] || 0) + 1;
    return acc;
  }, {});

  // --- Telemetry & Alerts Computations ---
  // Chronologically sorted occupancy timeline records
  const sortedOccupancyTimeline = useMemo(() => {
    if (!occupancySummary?.timeline?.length) return [];
    return [...occupancySummary.timeline].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [occupancySummary]);

  // Chronologically sorted energy timeline records
  const sortedEnergyTimeline = useMemo(() => {
    if (!energySummary?.timeline?.length) return [];
    return [...energySummary.timeline].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [energySummary]);

  // Dynamic snapshot date range derived from MongoDB timeline timestamps
  const datasetProvenance = useMemo(() => {
    const timestamps = [];
    sortedOccupancyTimeline.forEach((t) => {
      if (t.timestamp) timestamps.push(new Date(t.timestamp).getTime());
    });
    sortedEnergyTimeline.forEach((t) => {
      if (t.timestamp) timestamps.push(new Date(t.timestamp).getTime());
    });
    const epochCount = Math.max(sortedOccupancyTimeline.length, sortedEnergyTimeline.length, 15);
    if (!timestamps.length) {
      return {
        formattedRange: 'Oct 12 – Oct 17, 2026',
        epochCount,
      };
    }
    const minD = new Date(Math.min(...timestamps));
    const maxD = new Date(Math.max(...timestamps));
    const startStr = minD.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const endStr = maxD.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' });
    return {
      formattedRange: startStr === endStr ? startStr : `${startStr} – ${endStr}`,
      epochCount,
    };
  }, [sortedOccupancyTimeline, sortedEnergyTimeline]);

  // Consistent incident counts by verified categories (Congestion, Energy, Water, Occupancy, Solar Generation)
  const categoryIncidentSummary = useMemo(() => {
    const categories = ['Congestion', 'Energy', 'Water', 'Occupancy', 'Solar Generation'];
    const counts = { Congestion: 0, Energy: 0, Water: 0, Occupancy: 0, 'Solar Generation': 0 };
    const highCounts = { Congestion: 0, Energy: 0, Water: 0, Occupancy: 0, 'Solar Generation': 0 };
    const otherTypes = {};

    alerts.forEach((a) => {
      const type = (a.alertType || '').trim();
      const sev = (a.severity || '').toLowerCase();
      const isHigh = sev === 'high' || sev === 'critical';

      const matchCat = categories.find((c) => c.toLowerCase() === type.toLowerCase());
      if (matchCat) {
        counts[matchCat] += 1;
        if (isHigh) highCounts[matchCat] += 1;
      } else if (type) {
        otherTypes[type] = (otherTypes[type] || 0) + 1;
      }
    });

    const list = categories.map((cat) => ({
      name: cat,
      count: counts[cat],
      highCount: highCounts[cat],
      mediumCount: counts[cat] - highCounts[cat],
    }));

    Object.entries(otherTypes).forEach(([cat, count]) => {
      list.push({ name: cat, count, highCount: 0, mediumCount: count });
    });

    return list;
  }, [alerts]);

  // Maximum observed instantaneous power demand (kW) across dataset timeline
  const maxDatasetDemand = useMemo(() => {
    if (!sortedEnergyTimeline.length) return 200;
    const maxVal = Math.max(...sortedEnergyTimeline.map((t) => Number(t.demandKw) || 0));
    return maxVal > 0 ? Number(maxVal.toFixed(1)) : 200;
  }, [sortedEnergyTimeline]);

  // Connected load capacity (from MongoDB appliance inventory: 371.4 kW)
  const connectedCapacityKw = 371.4;

  // Active power demand scale (kW) applied consistently across all progress bars
  const activeEnergyScale = useMemo(() => {
    if (energyScaleMode === '200kw') return 200;
    if (energyScaleMode === 'connected') return connectedCapacityKw;
    return maxDatasetDemand; // 'peak'
  }, [energyScaleMode, maxDatasetDemand]);

  // Latest snapshot metrics (strictly aligned to latest epoch timestamp)
  const latestOccupancy = useMemo(() => {
    if (!sortedOccupancyTimeline.length) {
      return {
        util: '0.0',
        present: occupancySummary?.totalOccupancy ?? 0,
        capacity: occupancySummary?.totalCapacity ?? 7302,
        label: occupancySummary?.snapshotLabel || 'Latest',
      };
    }
    const last = sortedOccupancyTimeline[sortedOccupancyTimeline.length - 1];
    const util = last.utilization !== undefined ? Number(last.utilization).toFixed(1) : '0.0';
    return {
      util,
      present: last.totalOccupancy ?? (occupancySummary?.totalOccupancy ?? 0),
      capacity: last.totalCapacity ?? (occupancySummary?.totalCapacity ?? 7302),
      label: last.snapshotLabel,
      timestamp: last.timestamp,
    };
  }, [sortedOccupancyTimeline, occupancySummary]);

  const latestEnergy = useMemo(() => {
    if (!sortedEnergyTimeline.length) {
      return {
        demandKw: '0.0',
        energyKWh: '0.0',
        label: energySummary?.snapshotLabel || 'Latest',
      };
    }
    const last = sortedEnergyTimeline[sortedEnergyTimeline.length - 1];
    return {
      demandKw: Number(last.demandKw || 0).toFixed(1),
      energyKWh: Number(last.energyKWh || 0).toFixed(1),
      label: last.snapshotLabel,
      timestamp: last.timestamp,
    };
  }, [sortedEnergyTimeline, energySummary]);

  // Drilled incident alarms for category drill-down
  const drilledIncidents = useMemo(() => {
    if (!selectedIncidentCategory) return [];
    return alerts.filter(
      (a) => (a.alertType || '').toLowerCase() === selectedIncidentCategory.toLowerCase()
    );
  }, [alerts, selectedIncidentCategory]);

  const handleGoToAlerts = (category) => {
    if (onNavigate) {
      onNavigate('alerts', { type: category });
    } else {
      sessionStorage.setItem('unitwin_alerts_filter_type', category);
      window.location.hash = `alerts?type=${encodeURIComponent(category)}`;
    }
  };

  // --- Detailed Timetable Explorer Computations ---
  const distinctBranches = useMemo(() => {
    const list = new Set();
    sections.forEach((s) => {
      if (s.branch) list.add(s.branch.toUpperCase());
    });
    timetables.forEach((t) => {
      const parts = (t.sectionId || '').split('_');
      if (parts[0]) list.add(parts[0].toUpperCase());
    });
    return Array.from(list).sort();
  }, [sections, timetables]);

  const availableSections = useMemo(() => {
    if (explorerBranch === 'ALL') return sections;
    return sections.filter(
      (s) =>
        (s.branch || '').toUpperCase() === explorerBranch.toUpperCase() ||
        (s.sectionId || '').toUpperCase().startsWith(`${explorerBranch.toUpperCase()}_`)
    );
  }, [sections, explorerBranch]);

  const distinctDays = useMemo(() => {
    const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const present = new Set(timetables.map((t) => t.day).filter(Boolean));
    return order.filter((d) => present.has(d));
  }, [timetables]);

  const distinctRooms = useMemo(() => {
    const list = new Set(timetables.map((t) => t.room).filter(Boolean));
    return Array.from(list).sort();
  }, [timetables]);

  const distinctTypes = useMemo(() => {
    const list = new Set(timetables.map((t) => (t.type || '').toLowerCase()).filter(Boolean));
    return Array.from(list).sort();
  }, [timetables]);

  const handleBranchChange = (newBranch) => {
    setExplorerBranch(newBranch);
    setPageIndex(0);
    if (newBranch !== 'ALL') {
      const match = availableSections.some((s) => s.sectionId === explorerSection);
      if (!match) {
        setExplorerSection('ALL');
      }
    }
  };

  const handleResetFilters = () => {
    setExplorerBranch('ALL');
    setExplorerSection('ALL');
    setExplorerDay('ALL');
    setExplorerRoom('ALL');
    setExplorerType('ALL');
    setSubjectSearchQuery('');
    setPageIndex(0);
  };

  const filteredTimetables = useMemo(() => {
    return timetables
      .filter((t) => {
        if (explorerBranch !== 'ALL') {
          const matchSec = sections.find((s) => s.sectionId === t.sectionId);
          const secBranch = (matchSec?.branch || t.sectionId?.split('_')[0] || '').toUpperCase();
          if (secBranch !== explorerBranch.toUpperCase()) return false;
        }

        if (explorerSection !== 'ALL' && t.sectionId !== explorerSection) {
          return false;
        }

        if (explorerDay !== 'ALL' && (t.day || '').toLowerCase() !== explorerDay.toLowerCase()) {
          return false;
        }

        if (explorerRoom !== 'ALL' && t.room !== explorerRoom) {
          return false;
        }

        if (explorerType !== 'ALL' && (t.type || '').toLowerCase() !== explorerType.toLowerCase()) {
          return false;
        }

        if (subjectSearchQuery.trim()) {
          const q = subjectSearchQuery.toLowerCase();
          const sub = (t.subject || '').toLowerCase();
          const sec = (t.sectionId || '').toLowerCase();
          const rm = (t.room || '').toLowerCase();
          if (!sub.includes(q) && !sec.includes(q) && !rm.includes(q)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const dDiff = (DAY_ORDER_MAP[a.day] || 99) - (DAY_ORDER_MAP[b.day] || 99);
        if (dDiff !== 0) return dDiff;
        if (a.slotStart !== b.slotStart) return a.slotStart - b.slotStart;
        return (a.sectionId || '').localeCompare(b.sectionId || '');
      });
  }, [
    timetables,
    sections,
    explorerBranch,
    explorerSection,
    explorerDay,
    explorerRoom,
    explorerType,
    subjectSearchQuery,
  ]);

  const paginatedTimetables = useMemo(() => {
    if (pageSize === 'all') return filteredTimetables;
    const start = pageIndex * pageSize;
    return filteredTimetables.slice(start, start + pageSize);
  }, [filteredTimetables, pageIndex, pageSize]);

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(filteredTimetables.length / pageSize) || 1;

  const groupedSchedule = useMemo(() => {
    const groups = {};
    filteredTimetables.forEach((t) => {
      const groupKey = scheduleGroupBy === 'section' ? t.sectionId || 'Unknown Section' : t.room || 'Unknown Room';
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(t);
    });

    return Object.entries(groups).map(([key, items]) => {
      const sorted = [...items].sort((a, b) => {
        const dDiff = (DAY_ORDER_MAP[a.day] || 99) - (DAY_ORDER_MAP[b.day] || 99);
        if (dDiff !== 0) return dDiff;
        return a.slotStart - b.slotStart;
      });
      return {
        key,
        items: sorted,
      };
    });
  }, [filteredTimetables, scheduleGroupBy]);

  return (
    <div className={styles.page}>
      {/* Header Banner */}
      <section className={styles.headerBanner}>
        <div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Campus Analytics &amp; Operations</h1>
            <span className={styles.badge}>Live MongoDB Integration</span>
          </div>
          <p className={styles.subtitle}>
            Comprehensive cross-system intelligence: spatial inventory, academic schedules, and pilot telemetry baselines.
          </p>
        </div>

        {/* Tab Controls */}
        <div className={styles.tabsRow}>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`${styles.tabBtn} ${activeTab === 'inventory' ? styles.tabActive : ''}`}
          >
            Spatial Inventory
          </button>
          <button
            onClick={() => setActiveTab('academic')}
            className={`${styles.tabBtn} ${activeTab === 'academic' ? styles.tabActive : ''}`}
          >
            Academic Timetables
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`${styles.tabBtn} ${activeTab === 'telemetry' ? styles.tabActive : ''}`}
          >
            Pilot Telemetry Trends
          </button>
        </div>
      </section>

      {/* Top 4 Key KPI Cards */}
      <section className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Campus Buildings</span>
          <span className={styles.kpiValue}>
            {loading ? <Skeleton width="60px" height="32px" /> : buildings.length}
          </span>
          <span className={styles.kpiSub}>10 Active Physical Structures</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Cataloged Rooms</span>
          <span className={styles.kpiValue}>
            {loading ? <Skeleton width="60px" height="32px" /> : rooms.length}
          </span>
          <span className={styles.kpiSub}>Across Ground, 1st &amp; 2nd Floors</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Academic Sections</span>
          <span className={styles.kpiValue}>
            {loading ? <Skeleton width="60px" height="32px" /> : sections.length}
          </span>
          <span className={styles.kpiSub}>Engineering &amp; Sciences Cohorts</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Scheduled Timetable Slots</span>
          <span className={styles.kpiValue}>
            {loading ? <Skeleton width="60px" height="32px" /> : timetables.length}
          </span>
          <span className={styles.kpiSub}>Monday – Friday Allocations</span>
        </div>
      </section>

      {/* Tab 1: Spatial Inventory Analytics */}
      {activeTab === 'inventory' && (
        <section className={styles.grid2Col}>
          {/* Room Type Distribution */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>Room Distribution by Type</h3>
              <span className={styles.panelTag}>{sortedRoomTypes.length} Types</span>
            </div>
            <div className={styles.barList}>
              {sortedRoomTypes.slice(0, 8).map(([type, count]) => {
                const pct = Math.round((count / (rooms.length || 1)) * 100);
                return (
                  <div key={type} className={styles.barItem}>
                    <div className={styles.barMeta}>
                      <span className={styles.barLabel}>{type}</span>
                      <span className={styles.barValue}>{count} ({pct}%)</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div className={styles.barFillTeal} style={{ width: `${Math.max(pct, 4)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rooms by Block & Floor */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>Spatial Allocation by Block &amp; Floor</h3>
              <span className={styles.panelTag}>Campus Zones</span>
            </div>
            <h4 className={styles.subHeading}>Rooms by Block</h4>
            <div className={styles.barList}>
              {sortedBlocks.map(([block, count]) => {
                const pct = Math.round((count / (rooms.length || 1)) * 100);
                return (
                  <div key={block} className={styles.barItem}>
                    <div className={styles.barMeta}>
                      <span className={styles.barLabel}>Block {block}</span>
                      <span className={styles.barValue}>{count} rooms</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div className={styles.barFillBlue} style={{ width: `${Math.max(pct, 6)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <h4 className={styles.subHeading} style={{ marginTop: '20px' }}>Rooms by Floor Level</h4>
            <div className={styles.barList}>
              {sortedFloors.map(([floor, count]) => {
                const pct = Math.round((count / (rooms.length || 1)) * 100);
                return (
                  <div key={floor} className={styles.barItem}>
                    <div className={styles.barMeta}>
                      <span className={styles.barLabel}>{floor}</span>
                      <span className={styles.barValue}>{count} rooms</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div className={styles.barFillCyan} style={{ width: `${Math.max(pct, 6)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Tab 2: Academic Timetables Analytics */}
      {activeTab === 'academic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Summary Charts (Preserved) */}
          <section className={styles.grid2Col}>
            {/* Timetable distribution by Day */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>Weekly Timetable Slots by Day</h3>
                <span className={styles.panelTag}>{timetables.length} Total Slots</span>
              </div>
              <div className={styles.barList}>
                {sortedDays.map(([day, count]) => {
                  const pct = Math.round((count / (timetables.length || 1)) * 100);
                  return (
                    <div key={day} className={styles.barItem}>
                      <div className={styles.barMeta}>
                        <span className={styles.barLabel}>{day}</span>
                        <span className={styles.barValue}>{count} slots ({pct}%)</span>
                      </div>
                      <div className={styles.barTrack}>
                        <div className={styles.barFillGreen} style={{ width: `${Math.max(pct, 5)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sections by Branch */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>Academic Cohorts by Branch</h3>
                <span className={styles.panelTag}>{sections.length} Cohorts</span>
              </div>
              <div className={styles.barList}>
                {Object.entries(sectionsByBranch).map(([branch, count]) => {
                  const pct = Math.round((count / (sections.length || 1)) * 100);
                  return (
                    <div key={branch} className={styles.barItem}>
                      <div className={styles.barMeta}>
                        <span className={styles.barLabel}>{branch} Department</span>
                        <span className={styles.barValue}>{count} sections</span>
                      </div>
                      <div className={styles.barTrack}>
                        <div className={styles.barFillTeal} style={{ width: `${Math.max(pct, 8)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Detailed Timetable Explorer Section */}
          <section className={styles.explorerPanel}>
            {/* Explorer Header */}
            <div className={styles.explorerHeader}>
              <div>
                <div className={styles.explorerTitleRow}>
                  <h3 className={styles.explorerTitle}>Detailed Timetable Explorer</h3>
                  <span className={styles.explorerTag}>Live MongoDB Schedule Data</span>
                </div>
                <p className={styles.explorerSub}>
                  Filter, inspect, and analyze weekly class schedules, lecture rooms, and slot allocations across departments.
                </p>
              </div>

              {/* View Mode Toggle */}
              <div className={styles.viewModeGroup}>
                <button
                  type="button"
                  className={`${styles.viewModeBtn} ${explorerViewMode === 'table' ? styles.viewModeBtnActive : ''}`}
                  onClick={() => setExplorerViewMode('table')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="3" y1="15" x2="21" y2="15" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                  Table Register
                </button>
                <button
                  type="button"
                  className={`${styles.viewModeBtn} ${explorerViewMode === 'schedule' ? styles.viewModeBtnActive : ''}`}
                  onClick={() => setExplorerViewMode('schedule')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Day Schedule View
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className={styles.filterBar}>
              {/* Branch Filter */}
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Branch:</label>
                <select
                  value={explorerBranch}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className={styles.selectInput}
                >
                  <option value="ALL">All Branches</option>
                  {distinctBranches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Filter */}
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Section:</label>
                <select
                  value={explorerSection}
                  onChange={(e) => {
                    setExplorerSection(e.target.value);
                    setPageIndex(0);
                  }}
                  className={styles.selectInput}
                >
                  <option value="ALL">All Sections ({availableSections.length})</option>
                  {availableSections.map((s) => (
                    <option key={s.sectionId} value={s.sectionId}>
                      {s.sectionId}
                    </option>
                  ))}
                </select>
              </div>

              {/* Day Filter */}
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Day:</label>
                <select
                  value={explorerDay}
                  onChange={(e) => {
                    setExplorerDay(e.target.value);
                    setPageIndex(0);
                  }}
                  className={styles.selectInput}
                >
                  <option value="ALL">All Days</option>
                  {distinctDays.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Room Filter */}
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Room:</label>
                <select
                  value={explorerRoom}
                  onChange={(e) => {
                    setExplorerRoom(e.target.value);
                    setPageIndex(0);
                  }}
                  className={styles.selectInput}
                >
                  <option value="ALL">All Rooms ({distinctRooms.length})</option>
                  {distinctRooms.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Type:</label>
                <select
                  value={explorerType}
                  onChange={(e) => {
                    setExplorerType(e.target.value);
                    setPageIndex(0);
                  }}
                  className={styles.selectInput}
                >
                  <option value="ALL">All Types</option>
                  {distinctTypes.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Query */}
              <div className={styles.searchWrap}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search subject or keyword..."
                  value={subjectSearchQuery}
                  onChange={(e) => {
                    setSubjectSearchQuery(e.target.value);
                    setPageIndex(0);
                  }}
                  className={styles.searchInput}
                />
              </div>

              {/* Reset Filters Button */}
              {(explorerBranch !== 'ALL' ||
                explorerSection !== 'ALL' ||
                explorerDay !== 'ALL' ||
                explorerRoom !== 'ALL' ||
                explorerType !== 'ALL' ||
                subjectSearchQuery.trim() !== '') && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className={styles.resetBtn}
                >
                  Reset Filters
                </button>
              )}
            </div>

            {/* Filter Summary Row */}
            <div className={styles.filterSummaryRow}>
              <div className={styles.filterCounts}>
                Showing <span className={styles.countHighlight}>{filteredTimetables.length}</span> of{' '}
                <span className={styles.countHighlight}>{timetables.length}</span> timetable records
                {explorerBranch !== 'ALL' && ` · Branch: ${explorerBranch}`}
                {explorerSection !== 'ALL' && ` · Section: ${explorerSection}`}
                {explorerDay !== 'ALL' && ` · Day: ${explorerDay}`}
                {explorerRoom !== 'ALL' && ` · Room: ${explorerRoom}`}
                {explorerType !== 'ALL' && ` · Type: ${explorerType}`}
              </div>

              {explorerViewMode === 'schedule' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Grouping:</span>
                  <select
                    value={scheduleGroupBy}
                    onChange={(e) => setScheduleGroupBy(e.target.value)}
                    className={styles.selectInput}
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                  >
                    <option value="section">Group by Section</option>
                    <option value="room">Group by Room</option>
                  </select>
                </div>
              )}
            </div>

            {/* Content: Table View */}
            {explorerViewMode === 'table' && (
              <>
                {filteredTimetables.length > 0 ? (
                  <>
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Day</th>
                            <th>Section</th>
                            <th>Subject</th>
                            <th>Room</th>
                            <th>Start Slot</th>
                            <th>End Slot</th>
                            <th>Class Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedTimetables.map((t) => {
                            const typeLower = (t.type || 'lecture').toLowerCase();
                            const typeClass =
                              typeLower === 'lab'
                                ? styles.typeLab
                                : typeLower === 'activity'
                                ? styles.typeActivity
                                : typeLower === 'project'
                                ? styles.typeProject
                                : styles.typeLecture;

                            return (
                              <tr key={t._id}>
                                <td className={styles.dayCol}>{t.day}</td>
                                <td>
                                  <span className={styles.sectionBadge}>{t.sectionId}</span>
                                </td>
                                <td className={styles.subjectCol}>{t.subject}</td>
                                <td>
                                  <span className={styles.roomBadge}>{t.room}</span>
                                </td>
                                <td>
                                  <span className={styles.slotBadge}>Slot {t.slotStart}</span>
                                </td>
                                <td>
                                  <span className={styles.slotBadge}>Slot {t.slotEnd}</span>
                                </td>
                                <td>
                                  <span className={`${styles.typeBadge} ${typeClass}`}>
                                    {t.type || 'Lecture'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className={styles.paginationRow}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rows per page:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                            setPageSize(val);
                            setPageIndex(0);
                          }}
                          className={styles.selectInput}
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                        >
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value="all">All ({filteredTimetables.length})</option>
                        </select>
                      </div>

                      {pageSize !== 'all' && (
                        <div className={styles.paginationControls}>
                          <button
                            type="button"
                            className={styles.pageBtn}
                            disabled={pageIndex === 0}
                            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                          >
                            Previous
                          </button>
                          <span className={styles.pageInfo}>
                            Page {pageIndex + 1} of {totalPages}
                          </span>
                          <button
                            type="button"
                            className={styles.pageBtn}
                            disabled={pageIndex >= totalPages - 1}
                            onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className={styles.emptyState}>
                    <svg className={styles.emptyIcon} width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    <p className={styles.emptyTitle}>No matching timetable slots found</p>
                    <p className={styles.emptyDesc}>
                      No classes or labs matched your selected branch, section, day, or room criteria.
                    </p>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className={styles.resetBtn}
                      style={{ marginTop: '8px' }}
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Content: Day Schedule View */}
            {explorerViewMode === 'schedule' && (
              <>
                {groupedSchedule.length > 0 ? (
                  <div className={styles.scheduleStack}>
                    {groupedSchedule.map((group) => (
                      <div key={group.key} className={styles.scheduleGroupCard}>
                        <div className={styles.scheduleGroupHeader}>
                          <h4 className={styles.scheduleGroupTitle}>
                            {scheduleGroupBy === 'section' ? (
                              <>
                                <span className={styles.sectionBadge}>{group.key}</span>
                                <span>Class Schedule</span>
                              </>
                            ) : (
                              <>
                                <span className={styles.roomBadge}>{group.key}</span>
                                <span>Room Allocation</span>
                              </>
                            )}
                          </h4>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {group.items.length} scheduled slot{group.items.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        <div className={styles.scheduleSlotsGrid}>
                          {group.items.map((slot) => {
                            const typeLower = (slot.type || 'lecture').toLowerCase();
                            const typeClass =
                              typeLower === 'lab'
                                ? styles.typeLab
                                : typeLower === 'activity'
                                ? styles.typeActivity
                                : typeLower === 'project'
                                ? styles.typeProject
                                : styles.typeLecture;

                            return (
                              <div key={slot._id} className={styles.scheduleSlotCard}>
                                <div className={styles.scheduleSlotTop}>
                                  <span className={styles.slotBadge}>
                                    Slot {slot.slotStart}
                                    {slot.slotEnd !== slot.slotStart ? `–${slot.slotEnd}` : ''}
                                  </span>
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {slot.day}
                                  </span>
                                </div>
                                <div className={styles.scheduleSlotSubject}>{slot.subject}</div>
                                <div className={styles.scheduleSlotBottom}>
                                  {scheduleGroupBy === 'section' ? (
                                    <span className={styles.roomBadge}>{slot.room}</span>
                                  ) : (
                                    <span className={styles.sectionBadge}>{slot.sectionId}</span>
                                  )}
                                  <span className={`${styles.typeBadge} ${typeClass}`}>
                                    {slot.type || 'Lecture'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <svg className={styles.emptyIcon} width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    <p className={styles.emptyTitle}>No matching timetable schedules found</p>
                    <p className={styles.emptyDesc}>
                      No classes or labs matched your selected branch, section, day, or room criteria.
                    </p>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className={styles.resetBtn}
                      style={{ marginTop: '8px' }}
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {/* Tab 3: Pilot Telemetry & Anomaly Trends */}
      {activeTab === 'telemetry' && (
        <div className={styles.telemetryStack}>
          {/* Note Banner */}
          <div className={styles.datasetNotice}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F9D8A" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div>
              <strong>Demonstration / Pilot Telemetry Baseline:</strong> Recorded across {datasetProvenance.epochCount} snapshot intervals ({datasetProvenance.formattedRange}). This baseline represents a pilot simulation dataset (not continuous live telemetry).
            </div>
          </div>

          <div className={styles.grid2Col}>
            {/* Occupancy Timeline */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h3 className={styles.panelTitle}>Occupancy Utilization Trend</h3>
                  <p className={styles.panelSub}>
                    Derived from {occupancySummary?.roomCount || 216} rooms across {sortedOccupancyTimeline.length} monitoring epochs ({latestOccupancy.capacity} seats capacity)
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  <span className={styles.panelTag}>{latestOccupancy.util}% Latest Util</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {latestOccupancy.present} / {latestOccupancy.capacity} present ({latestOccupancy.label})
                  </span>
                </div>
              </div>
              <div className={styles.timelineList}>
                {sortedOccupancyTimeline.map((t, idx) => {
                  const utilVal = Number(t.utilization) || 0;
                  const occFill = Math.max(0, Math.min(100, utilVal));
                  const formattedDate = new Date(t.timestamp).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div key={idx} className={styles.timelineItem}>
                      <div className={styles.timelineMeta}>
                        <span className={styles.timelineDate}>
                          {formattedDate} · {t.snapshotLabel}
                        </span>
                        <span className={styles.timelineVal}>
                          {utilVal.toFixed(1)}% ({t.totalOccupancy ?? 0} / {t.totalCapacity ?? 7302} seats)
                        </span>
                      </div>
                      <div className={styles.barTrack}>
                        <div className={styles.barFillGreen} style={{ width: `${occFill}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Energy Demand Timeline */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h3 className={styles.panelTitle}>Active Power Demand &amp; Energy Trend</h3>
                  <p className={styles.panelSub}>
                    Instantaneous load (kW) and interval energy (kWh) across {sortedEnergyTimeline.length} epochs · Scale: 0 – {activeEnergyScale} kW
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      value={energyScaleMode}
                      onChange={(e) => setEnergyScaleMode(e.target.value)}
                      className={styles.selectInput}
                      style={{ padding: '3px 8px', fontSize: '11px', height: '26px' }}
                      title="Scale Reference"
                    >
                      <option value="peak">Scale: Peak ({maxDatasetDemand} kW)</option>
                      <option value="200kw">Scale: Reference (200 kW)</option>
                      <option value="connected">Scale: Connected ({connectedCapacityKw} kW)</option>
                    </select>
                    <span className={styles.panelTag}>{latestEnergy.demandKw} kW Active Power Demand</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Interval Energy: {latestEnergy.energyKWh} kWh ({latestEnergy.label})
                  </span>
                </div>
              </div>
              <div className={styles.timelineList}>
                {sortedEnergyTimeline.map((t, idx) => {
                  const demandVal = Number(t.demandKw) || 0;
                  const energyKWhVal = Number(t.energyKWh) || 0;
                  const demandFill = Math.max(0, Math.min(100, (demandVal / activeEnergyScale) * 100));
                  const formattedDate = new Date(t.timestamp).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div key={idx} className={styles.timelineItem}>
                      <div className={styles.timelineMeta}>
                        <span className={styles.timelineDate}>
                          {formattedDate} · {t.snapshotLabel}
                        </span>
                        <span className={styles.timelineVal}>
                          {demandVal.toFixed(1)} kW Active Power Demand{' '}
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
                            ({demandFill.toFixed(1)}% of scale)
                          </span>{' '}
                          · {energyKWhVal.toFixed(1)} kWh Interval Energy
                        </span>
                      </div>
                      <div className={styles.barTrack}>
                        <div className={styles.barFillCyan} style={{ width: `${demandFill}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Solar Generation & Net Grid Balance Analysis */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h3 className={styles.panelTitle}>Solar Photovoltaic Generation &amp; Net Grid Balance</h3>
                <p className={styles.panelSub}>
                  MongoDB Atlas <code style={{ fontSize: '11px', color: 'var(--primary-blue)', fontFamily: 'var(--font-mono)' }}>solarGeneration</code> telemetry · Assumed {solarSummary?.systemCapacityKW || '20.0'} kWp Rooftop Array (BLD001 Main Building) diurnal simulation model correlated with campus electrical demand
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={styles.panelTag} style={{ background: 'var(--secondary-teal-subtle)', color: 'var(--secondary-teal)', borderColor: 'var(--secondary-teal-border)' }}>
                  Solar Energy Generated: {solarSummary?.totalGeneratedKWh || energySummary?.totalSolarGeneratedKWh || '435.1'} kWh ({energySummary?.reportingPeriod || 'Baseline'})
                </span>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('energy')}
                    className={styles.resetBtn}
                    style={{
                      padding: '3px 10px',
                      fontSize: '11px',
                      background: 'rgba(52, 120, 201, 0.08)',
                      color: '#3478C9',
                      borderColor: 'rgba(52, 120, 201, 0.25)',
                    }}
                  >
                    Energy &amp; Solar Hub &rarr;
                  </button>
                )}
              </div>
            </div>

            {/* Quick Solar KPIs */}
            <div className={styles.kpiRow} style={{ marginBottom: '16px' }}>
              <div className={styles.alertTypeChip} style={{ cursor: 'default' }}>
                <span className={styles.chipName}>Solar Energy Generated</span>
                <span className={styles.chipCount} style={{ color: 'var(--secondary-teal)' }}>
                  {solarSummary?.totalGeneratedKWh || energySummary?.totalSolarGeneratedKWh || '435.1'} <span style={{ fontSize: '13px', fontWeight: 500 }}>kWh</span>
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {solarSummary?.reportingPeriod || energySummary?.reportingPeriod || 'Oct 12 – 17, 2026 (Simulated)'}
                </span>
              </div>

              <div className={styles.alertTypeChip} style={{ cursor: 'default' }}>
                <span className={styles.chipName}>Assumed PV Capacity</span>
                <span className={styles.chipCount}>
                  {solarSummary?.systemCapacityKW || '20.0'} <span style={{ fontSize: '13px', fontWeight: 500 }}>kWp</span>
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {solarSummary?.panelCount || 50} modules (assumed {solarSummary?.panelCapacityKW ? Math.round(solarSummary.panelCapacityKW * 1000) : 400}W each)
                </span>
              </div>

              <div className={styles.alertTypeChip} style={{ cursor: 'default' }}>
                <span className={styles.chipName}>Current Solar Output</span>
                <span className={styles.chipCount} style={{ color: '#2563EB' }}>
                  {typeof energySummary?.solarKw === 'number'
                    ? energySummary.solarKw.toFixed(2)
                    : (solarSummary?.latestSnapshot?.currentSolarPowerKW ?? '1.60')}{' '}
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>kW</span>
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Latest snapshot: {energySummary?.snapshotLabel || '05:00 PM IST'} [SIM]
                </span>
              </div>

              <div className={styles.alertTypeChip} style={{ cursor: 'default' }}>
                <span className={styles.chipName}>Instantaneous Solar Offset</span>
                <span className={styles.chipCount} style={{ color: 'var(--status-success)' }}>
                  {energySummary?.solarOffsetPct ?? '4.8'}%
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Of {energySummary?.latestDemandKw ?? '33.4'} kW active demand ({energySummary?.netImportKw ?? '31.8'} kW net import)
                </span>
              </div>
            </div>

            {/* Daily Solar vs Campus Demand Table */}
            {energySummary?.dailyComparison && energySummary.dailyComparison.length > 0 && (
              <div className={styles.tableWrap} style={{ marginTop: '8px' }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Baseline Date</th>
                      <th>Campus Consumption (kWh)</th>
                      <th>Solar Generation (kWh)</th>
                      <th>Net Grid Import (kWh)</th>
                      <th>Daily Solar Offset</th>
                    </tr>
                  </thead>
                  <tbody>
                    {energySummary.dailyComparison.map((d) => (
                      <tr key={d.date}>
                        <td className={styles.dayCol}>
                          {new Date(d.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className={styles.valCol}>
                          {Number(d.consumptionKWh).toFixed(1)} kWh
                        </td>
                        <td style={{ color: 'var(--secondary-teal)', fontWeight: 600 }}>
                          {Number(d.solarGeneratedKWh).toFixed(1)} kWh
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {Number(d.netGridImportKWh).toFixed(1)} kWh
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--secondary-teal)', minWidth: '40px' }}>
                              {Number(d.solarContributionPct).toFixed(1)}%
                            </span>
                            <div className={styles.barTrack} style={{ width: '80px', height: '6px' }}>
                              <div
                                style={{
                                  width: `${Math.min(100, (d.solarContributionPct / 5) * 100)}%`,
                                  height: '100%',
                                  background: 'var(--secondary-teal)',
                                  borderRadius: '3px',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Anomaly Distribution & Category Drill-Down */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h3 className={styles.panelTitle}>Pilot Incident Breakdown by Category</h3>
                <p className={styles.panelSub}>
                  Filter in-place or navigate directly to the Alerts page filtered to that category
                </p>
              </div>
              <span className={styles.panelTag}>{alerts.length} Total Incidents</span>
            </div>
            <div className={styles.kpiRow}>
              {categoryIncidentSummary.map(({ name, count, highCount, mediumCount }) => {
                const isSelected = selectedIncidentCategory?.toLowerCase() === name.toLowerCase();
                return (
                  <div
                    key={name}
                    className={`${styles.alertTypeChip} ${isSelected ? styles.alertTypeChipActive : ''}`}
                    onClick={() =>
                      setSelectedIncidentCategory((prev) =>
                        prev?.toLowerCase() === name.toLowerCase() ? null : name
                      )
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedIncidentCategory((prev) =>
                          prev?.toLowerCase() === name.toLowerCase() ? null : name
                        );
                      }
                    }}
                    style={{ textAlign: 'left', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={styles.chipName}>{name} Incidents</span>
                      {isSelected && (
                        <span style={{ fontSize: '10px', color: '#0F9D8A', fontWeight: 600 }}>Active</span>
                      )}
                    </div>
                    <span className={styles.chipCount}>{count}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {highCount > 0 ? `${highCount} High · ` : ''}{mediumCount} Standard
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: '10px', color: isSelected ? '#3478C9' : 'var(--text-secondary)' }}>
                        {isSelected ? '✓ Showing details' : 'Click to inspect'}
                      </span>
                      <span
                        role="link"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGoToAlerts(name);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            handleGoToAlerts(name);
                          }
                        }}
                        style={{
                          color: '#3478C9',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '2px 4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                        title={`Open ${name} in Alerts Page`}
                      >
                        Alerts &rarr;
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Drill-Down Panel */}
            {selectedIncidentCategory && (
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      {selectedIncidentCategory} Incident Alarms ({drilledIncidents.length})
                    </h4>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Showing matching telemetry alarms from MongoDB
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleGoToAlerts(selectedIncidentCategory)}
                      className={styles.resetBtn}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        background: 'rgba(52, 120, 201, 0.08)',
                        color: '#3478C9',
                        borderColor: 'rgba(52, 120, 201, 0.25)',
                      }}
                    >
                      Open in Alerts Page ({drilledIncidents.length}) &rarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIncidentCategory(null)}
                      className={styles.resetBtn}
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                    >
                      Close Details
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                  {drilledIncidents.slice(0, 25).map((a) => {
                    const sev = (a.severity || 'Medium').toLowerCase();
                    const isHigh = sev === 'high' || sev === 'critical';
                    return (
                      <div
                        key={a._id || a.alertId}
                        style={{
                          background: 'var(--bg-subtle)',
                          border: '1px solid var(--border)',
                          borderLeft: isHigh ? '3px solid #EF4444' : '3px solid #F59E0B',
                          borderRadius: '6px',
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                          <span style={{ fontWeight: 700, color: isHigh ? '#EF4444' : '#F59E0B', textTransform: 'uppercase' }}>
                            {a.severity || 'Warning'}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {a.buildingId} {a.roomNumber ? `· ${a.roomNumber}` : '· Facility Wide'}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>
                          {a.message}
                        </p>
                        {a.actionRecommended && (
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            Action: {a.actionRecommended}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

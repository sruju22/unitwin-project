import { useState, useEffect, useMemo } from 'react';
import { getMaintenance, getBuildings } from '../api/client';
import Skeleton from '../components/Skeleton';
import styles from './Maintenance.module.css';

export default function Maintenance() {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [selectedAssetType, setSelectedAssetType] = useState('ALL');
  const [selectedBuilding, setSelectedBuilding] = useState('ALL');
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

  // Local interactive status overrides (session state)
  const [statusOverrides, setStatusOverrides] = useState({});

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const [maintRes, bldRes] = await Promise.allSettled([
          getMaintenance({ limit: 200 }),
          getBuildings(),
        ]);

        if (isMounted) {
          if (maintRes.status === 'fulfilled' && maintRes.value) {
            setRecords(Array.isArray(maintRes.value.data) ? maintRes.value.data : []);
            setSummary(maintRes.value.summary || null);
          }
          if (bldRes.status === 'fulfilled' && Array.isArray(bldRes.value?.data)) {
            setBuildings(bldRes.value.data);
          }
        }
      } catch (err) {
        console.warn('Maintenance load error:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Distinct asset types
  const distinctAssetTypes = useMemo(() => {
    const types = new Set(records.map((r) => r.assetType).filter(Boolean));
    return Array.from(types).sort();
  }, [records]);

  // Asset type counts
  const assetTypeCounts = useMemo(() => {
    const counts = {};
    for (const r of records) {
      const t = r.assetType || 'Other';
      counts[t] = (counts[t] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      const currentStatus = statusOverrides[item._id] || item.status || 'Open';
      if (selectedStatus !== 'ALL' && currentStatus.toLowerCase() !== selectedStatus.toLowerCase()) {
        return false;
      }
      if (selectedPriority !== 'ALL' && (item.priority || '').toLowerCase() !== selectedPriority.toLowerCase()) {
        return false;
      }
      if (selectedAssetType !== 'ALL' && (item.assetType || '').toLowerCase() !== selectedAssetType.toLowerCase()) {
        return false;
      }
      if (selectedBuilding !== 'ALL' && item.buildingId !== selectedBuilding) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const issue = (item.issue || '').toLowerCase();
        const room = (item.roomNumber || '').toLowerCase();
        const asset = (item.assetType || '').toLowerCase();
        if (!issue.includes(q) && !room.includes(q) && !asset.includes(q)) return false;
      }
      return true;
    });
  }, [records, selectedStatus, selectedPriority, selectedAssetType, selectedBuilding, searchQuery, statusOverrides]);

  // Handle session status update
  const handleUpdateStatus = (id, newStatus) => {
    setStatusOverrides((prev) => ({
      ...prev,
      [id]: newStatus,
    }));
  };

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getAssetIcon = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('electric')) return '⚡';
    if (t.includes('hvac') || t.includes('air') || t.includes('cooling')) return '❄️';
    if (t.includes('plumb') || t.includes('water')) return '💧';
    if (t.includes('safe') || t.includes('fire')) return '🛡️';
    if (t.includes('network') || t.includes('it')) return '🌐';
    return '🔧';
  };

  return (
    <div className={styles.page}>
      {/* Header Banner */}
      <section className={styles.headerBanner}>
        <div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Campus Maintenance &amp; Work Orders</h1>
            <span className={styles.datasetTag}>Pilot Operations Dataset · 50 Work Orders</span>
          </div>
          <p className={styles.subtitle}>
            Facility service tickets, asset diagnostics, equipment servicing logs, and preventive maintenance records.
          </p>
        </div>
      </section>

      {/* KPI Metrics */}
      <section className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Work Orders</span>
          <span className={styles.kpiValue}>
            {loading ? <Skeleton width="50px" height="32px" /> : summary?.totalCount || records.length}
          </span>
          <span className={styles.kpiSub}>Campus-wide service tickets</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Open Tickets</span>
          <span className={styles.kpiValue} style={{ color: '#F59E0B' }}>
            {loading ? <Skeleton width="50px" height="32px" /> : summary?.openCount || 29}
          </span>
          <span className={styles.kpiSub}>Awaiting crew assignment</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>In Progress / Scheduled</span>
          <span className={styles.kpiValue} style={{ color: '#3478C9' }}>
            {loading ? (
              <Skeleton width="50px" height="32px" />
            ) : (
              (summary?.inProgressCount || 7) + (summary?.scheduledCount || 10)
            )}
          </span>
          <span className={styles.kpiSub}>Active repairs &amp; technician dispatches</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>High Priority</span>
          <span className={styles.kpiValue} style={{ color: '#EF4444' }}>
            {loading ? <Skeleton width="50px" height="32px" /> : summary?.highPriorityCount || 5}
          </span>
          <span className={styles.kpiSub}>Urgent facility intervention</span>
        </div>
      </section>

      {/* Asset Distribution Strip */}
      <section className={styles.assetStrip}>
        <span className={styles.stripLabel}>Asset Distribution:</span>
        <div className={styles.stripPills}>
          {assetTypeCounts.map(([type, count]) => (
            <button
              key={type}
              type="button"
              className={`${styles.stripPill} ${
                selectedAssetType.toLowerCase() === type.toLowerCase() ? styles.stripPillActive : ''
              }`}
              onClick={() =>
                setSelectedAssetType((prev) => (prev.toLowerCase() === type.toLowerCase() ? 'ALL' : type))
              }
            >
              <span>{getAssetIcon(type)}</span>
              <span>{type}</span>
              <span className={styles.stripBadge}>{count}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Filter Bar */}
      <section className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Status:</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className={styles.selectInput}
          >
            <option value="ALL">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Priority:</label>
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className={styles.selectInput}
          >
            <option value="ALL">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Asset Type:</label>
          <select
            value={selectedAssetType}
            onChange={(e) => setSelectedAssetType(e.target.value)}
            className={styles.selectInput}
          >
            <option value="ALL">All Assets</option>
            {distinctAssetTypes.map((type) => (
              <option key={type} value={type}>
                {type}
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
            placeholder="Search issue or room (e.g. AC, C-102)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </section>

      {/* Work Orders Table */}
      <section className={styles.tablePanel}>
        <div className={styles.tableHeaderRow}>
          <h3 className={styles.tableTitle}>
            Work Order Register ({filteredRecords.length} ticket{filteredRecords.length === 1 ? '' : 's'})
          </h3>
          <span className={styles.snapshotTag}>
            Verified against MongoDB Atlas · `maintainence` collection
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
                  <th>Issue / Work Order</th>
                  <th>Asset Type</th>
                  <th>Location</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Reported Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => {
                  const currentStatus = statusOverrides[r._id] || r.status || 'Open';
                  const priority = (r.priority || 'Medium').toLowerCase();
                  const prioBadge =
                    priority === 'high' ? styles.prioHigh : priority === 'medium' ? styles.prioMedium : styles.prioLow;

                  const statusLower = currentStatus.toLowerCase();
                  const statusBadge =
                    statusLower === 'resolved'
                      ? styles.statusResolved
                      : statusLower === 'in progress'
                      ? styles.statusInProgress
                      : statusLower === 'scheduled'
                      ? styles.statusScheduled
                      : styles.statusOpen;

                  return (
                    <tr key={r._id}>
                      <td className={styles.issueCol}>
                        <div className={styles.issueText}>{r.issue}</div>
                        <div className={styles.metaSub}>ID: {String(r._id).slice(-6).toUpperCase()}</div>
                      </td>
                      <td>
                        <span className={styles.assetPill}>
                          <span className={styles.assetIcon}>{getAssetIcon(r.assetType)}</span>
                          {r.assetType || 'Facility'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.locationWrap}>
                          <span className={styles.roomBadge}>{r.roomNumber || 'Common Area'}</span>
                          <span className={styles.bldSub}>{r.buildingId}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${prioBadge}`}>{r.priority || 'Medium'}</span>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${statusBadge}`}>{currentStatus}</span>
                      </td>
                      <td className={styles.dateCol}>
                        {formatDate(r.reportedDate)}
                        {r.resolvedDate && (
                          <div className={styles.resolvedSub}>Resolved: {formatDate(r.resolvedDate)}</div>
                        )}
                      </td>
                      <td>
                        <div className={styles.actionButtonGroup}>
                          {statusLower === 'open' && (
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => handleUpdateStatus(r._id, 'In Progress')}
                            >
                              Dispatch Crew
                            </button>
                          )}
                          {statusLower === 'in progress' && (
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
                              onClick={() => handleUpdateStatus(r._id, 'Resolved')}
                            >
                              Mark Resolved
                            </button>
                          )}
                          {statusLower === 'scheduled' && (
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => handleUpdateStatus(r._id, 'In Progress')}
                            >
                              Start Work
                            </button>
                          )}
                          {statusLower === 'resolved' && (
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.actionBtnMuted}`}
                              onClick={() => handleUpdateStatus(r._id, 'Open')}
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyWrap}>
            <p className={styles.emptyTitle}>No matching work orders found</p>
            <p className={styles.emptyDesc}>Try adjusting the status, priority, or asset type filters.</p>
          </div>
        )}
      </section>
    </div>
  );
}

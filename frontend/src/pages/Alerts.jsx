import { useState, useEffect, useMemo } from 'react';
import { getAlerts, getBuildings } from '../api/client';
import { formatCampusDateTime } from '../utils/dateUtils';
import Skeleton from '../components/Skeleton';
import styles from './Alerts.module.css';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [selectedType, setSelectedType] = useState(() => {
    try {
      const stored = sessionStorage.getItem('unitwin_alerts_filter_type');
      if (stored) {
        sessionStorage.removeItem('unitwin_alerts_filter_type');
        return stored;
      }
      const hash = window.location.hash;
      if (hash.includes('?')) {
        const params = new URLSearchParams(hash.split('?')[1]);
        const typeParam = params.get('type');
        if (typeParam) return typeParam;
      }
    } catch {
      // ignore
    }
    return 'ALL';
  });
  const [selectedBuilding, setSelectedBuilding] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE'); // 'ALL' | 'ACTIVE' | 'ACKNOWLEDGED'
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive Acknowledgement state in session
  const [acknowledgedIds, setAcknowledgedIds] = useState(new Set());

  // Sync selectedType if URL hash changes
  useEffect(() => {
    const syncHashType = () => {
      try {
        const stored = sessionStorage.getItem('unitwin_alerts_filter_type');
        if (stored) {
          sessionStorage.removeItem('unitwin_alerts_filter_type');
          setSelectedType(stored);
          return;
        }
        const hash = window.location.hash;
        if (hash.includes('?')) {
          const params = new URLSearchParams(hash.split('?')[1]);
          const typeParam = params.get('type');
          if (typeParam) setSelectedType(typeParam);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('hashchange', syncHashType);
    return () => window.removeEventListener('hashchange', syncHashType);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const [alertRes, bldRes] = await Promise.allSettled([
          getAlerts(),
          getBuildings(),
        ]);

        if (isMounted) {
          if (alertRes.status === 'fulfilled' && alertRes.value) {
            setAlerts(Array.isArray(alertRes.value.data) ? alertRes.value.data : []);
            setSummary(alertRes.value.summary || null);
          }
          if (bldRes.status === 'fulfilled' && Array.isArray(bldRes.value?.data)) {
            setBuildings(bldRes.value.data);
          }
        }
      } catch (err) {
        console.warn('Alerts load error:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Distinct alert types
  const distinctAlertTypes = useMemo(() => {
    const types = new Set(alerts.map((a) => a.alertType).filter(Boolean));
    return Array.from(types).sort();
  }, [alerts]);

  // Toggle acknowledge single alert
  const toggleAcknowledge = (id) => {
    setAcknowledgedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((item) => {
      const isAck = acknowledgedIds.has(item._id) || acknowledgedIds.has(item.alertId);
      if (statusFilter === 'ACTIVE' && isAck) return false;
      if (statusFilter === 'ACKNOWLEDGED' && !isAck) return false;

      if (selectedSeverity !== 'ALL' && (item.severity || '').toLowerCase() !== selectedSeverity.toLowerCase()) {
        return false;
      }
      if (selectedType !== 'ALL' && (item.alertType || '').toLowerCase() !== selectedType.toLowerCase()) {
        return false;
      }
      if (selectedBuilding !== 'ALL' && item.buildingId !== selectedBuilding) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const msg = (item.message || '').toLowerCase();
        const action = (item.actionRecommended || '').toLowerCase();
        const room = (item.roomNumber || '').toLowerCase();
        if (!msg.includes(q) && !action.includes(q) && !room.includes(q)) return false;
      }
      return true;
    });
  }, [alerts, statusFilter, selectedSeverity, selectedType, selectedBuilding, searchQuery, acknowledgedIds]);

  // Bulk acknowledge all currently displayed
  const handleAcknowledgeAllVisible = () => {
    setAcknowledgedIds((prev) => {
      const next = new Set(prev);
      filteredAlerts.forEach((a) => {
        next.add(a._id);
        if (a.alertId) next.add(a.alertId);
      });
      return next;
    });
  };

  const getTypeIcon = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('solar')) return '☀️';
    if (t.includes('energy') || t.includes('power')) return '⚡';
    if (t.includes('occupan') || t.includes('crowd')) return '👥';
    if (t.includes('congest') || t.includes('traffic')) return '🚶';
    if (t.includes('water')) return '💧';
    if (t.includes('fire') || t.includes('safe')) return '🛡️';
    return '⚠️';
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'Recent';
    try {
      return formatCampusDateTime(ts) || ts;
    } catch {
      return ts;
    }
  };

  return (
    <div className={styles.page}>
      {/* Header Banner */}
      <section className={styles.headerBanner}>
        <div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Campus Alerts &amp; Incident Management</h1>
            <span className={styles.datasetTag}>
              Pilot Telemetry Alarms · {summary?.totalAlerts || alerts.length} Active Records
            </span>
          </div>
          <p className={styles.subtitle}>
            Cross-system anomaly telemetry, threshold excursions, sensor tripwires, and facility guidance.
          </p>
        </div>
        {filteredAlerts.length > 0 && statusFilter !== 'ACKNOWLEDGED' && (
          <button
            type="button"
            className={styles.ackAllBtn}
            onClick={handleAcknowledgeAllVisible}
          >
            Acknowledge All ({filteredAlerts.length})
          </button>
        )}
      </section>

      {/* KPI Metrics */}
      <section className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Incident Telemetry</span>
          <span className={styles.kpiValue}>
            {loading ? <Skeleton width="50px" height="32px" /> : summary?.totalAlerts || alerts.length}
          </span>
          <span className={styles.kpiSub}>Campus sensor threshold trips</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>High Severity Alarms</span>
          <span className={styles.kpiValue} style={{ color: 'var(--status-critical)' }}>
            {loading ? (
              <Skeleton width="50px" height="32px" />
            ) : (
              summary?.highSeverityCount ??
              alerts.filter(
                (a) => (a.severity || '').toLowerCase() === 'high' || (a.severity || '').toLowerCase() === 'critical'
              ).length
            )}
          </span>
          <span className={styles.kpiSub}>Urgent response recommended</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Medium Priority Warnings</span>
          <span className={styles.kpiValue} style={{ color: 'var(--status-warning)' }}>
            {loading ? (
              <Skeleton width="50px" height="32px" />
            ) : (
              summary?.mediumSeverityCount ??
              alerts.filter(
                (a) => (a.severity || '').toLowerCase() === 'medium' || (a.severity || '').toLowerCase() === 'warning'
              ).length
            )}
          </span>
          <span className={styles.kpiSub}>Operational baseline drifts</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Acknowledged In Session</span>
          <span className={styles.kpiValue} style={{ color: 'var(--status-success)' }}>
            {loading ? <Skeleton width="50px" height="32px" /> : acknowledgedIds.size}
          </span>
          <span className={styles.kpiSub}>Marked by operator</span>
        </div>
      </section>

      {/* Filter Bar */}
      <section className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.selectInput}
          >
            <option value="ACTIVE">Active Alarms</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="ALL">All Records</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Severity:</label>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className={styles.selectInput}
          >
            <option value="ALL">All Severities</option>
            <option value="High">High Severity</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Type:</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className={styles.selectInput}
          >
            <option value="ALL">All Systems</option>
            {distinctAlertTypes.map((type) => (
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
            placeholder="Search alert message, room, or action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </section>

      {/* Alert Feed */}
      <section className={styles.feedSection}>
        <div className={styles.feedHeader}>
          <h3 className={styles.feedTitle}>
            Incident Telemetry Feed ({filteredAlerts.length} alarm{filteredAlerts.length === 1 ? '' : 's'})
          </h3>
          <span className={styles.feedNotice}>
            MongoDB Atlas · `alerts` telemetry stream
          </span>
        </div>

        {loading ? (
          <div className={styles.loadingWrap}>
            <Skeleton width="100%" height="80px" />
            <Skeleton width="100%" height="80px" />
            <Skeleton width="100%" height="80px" />
          </div>
        ) : filteredAlerts.length > 0 ? (
          <div className={styles.alertList}>
            {filteredAlerts.map((a) => {
              const isAck = acknowledgedIds.has(a._id) || acknowledgedIds.has(a.alertId);
              const severity = (a.severity || 'Medium').toLowerCase();
              const isHigh = severity === 'high' || severity === 'critical';

              return (
                <div
                  key={a._id || a.alertId}
                  className={`${styles.alertCard} ${isAck ? styles.alertCardAck : ''} ${
                    isHigh ? styles.alertHighBorder : styles.alertMediumBorder
                  }`}
                >
                  <div className={styles.cardTop}>
                    <div className={styles.badgesRow}>
                      <span
                        className={`${styles.sevBadge} ${isHigh ? styles.sevHigh : styles.sevMedium}`}
                      >
                        <span className={styles.pulseDot} />
                        {a.severity || 'Warning'}
                      </span>
                      <span className={styles.typeBadge}>
                        <span>{getTypeIcon(a.alertType)}</span>
                        <span>{a.alertType || 'System'}</span>
                      </span>
                      <span className={styles.locationTag}>
                        {a.buildingId} {a.roomNumber ? `· Room ${a.roomNumber}` : '· Facility Wide'}
                      </span>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.timestamp}>{formatTimestamp(a.timestamp)}</span>
                      <button
                        type="button"
                        className={`${styles.ackBtn} ${isAck ? styles.ackBtnActive : ''}`}
                        onClick={() => toggleAcknowledge(a._id || a.alertId)}
                      >
                        {isAck ? '✓ Acknowledged' : 'Acknowledge'}
                      </button>
                    </div>
                  </div>

                  <p className={styles.messageText}>{a.message}</p>

                  {a.actionRecommended && (
                    <div className={styles.actionCallout}>
                      <span className={styles.actionLead}>Recommended Action:</span>
                      <span className={styles.actionBody}>{a.actionRecommended}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyWrap}>
            <p className={styles.emptyTitle}>
              {statusFilter === 'ACKNOWLEDGED'
                ? 'No acknowledged alerts yet'
                : 'No alerts matching active filters'}
            </p>
            <p className={styles.emptyDesc}>
              {statusFilter === 'ACKNOWLEDGED'
                ? 'Mark alarms as acknowledged to track operator review.'
                : 'All system streams are currently within normal baseline operational limits.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

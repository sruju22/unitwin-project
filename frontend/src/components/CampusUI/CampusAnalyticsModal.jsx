import React, { useState, useMemo } from 'react';
import { getLogicalBuildings, getCampusLogicalAnalytics } from '../../data/buildingRegistry';
import styles from './CampusAnalyticsModal.module.css';

export default function CampusAnalyticsModal({
  isOpen,
  onClose,
  onSelectBuilding,
  onFilterStatus,
}) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const analytics = useMemo(() => getCampusLogicalAnalytics(), [isOpen]);
  const buildings = useMemo(() => getLogicalBuildings(), [isOpen]);

  const filtered = useMemo(() => {
    return buildings.filter((b) => {
      if (typeFilter !== 'all' && b.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        return (
          b.id.toLowerCase().includes(q) ||
          b.name.toLowerCase().includes(q) ||
          b.type.toLowerCase().includes(q) ||
          (b.location || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [buildings, typeFilter, search]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Campus Infrastructure Analytics &amp; Register</h2>
            <p className={styles.subtitle}>
              Synchronized spatial intelligence across all {analytics.totalBuildings} campus facilities
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close Analytics">
            &times;
          </button>
        </div>

        {/* Interactive Status KPI Summary */}
        <div className={styles.kpiRow}>
          <div
            className={styles.kpiCard}
            onClick={() => {
              onFilterStatus('all');
              onClose();
            }}
          >
            <div className={styles.kpiNum} style={{ color: '#38bdf8' }}>
              {analytics.totalBuildings}
            </div>
            <div className={styles.kpiLabel}>Total Buildings</div>
            <div className={styles.kpiSub}>Logical Facilities</div>
          </div>

          <div
            className={styles.kpiCard}
            onClick={() => {
              onFilterStatus('operational');
              onClose();
            }}
          >
            <div className={styles.kpiNum} style={{ color: '#10b981' }}>
              {analytics.statusCounts.operational}
            </div>
            <div className={styles.kpiLabel}>Operational</div>
            <div className={styles.kpiSub}>Click to Filter Map</div>
          </div>

          <div
            className={styles.kpiCard}
            onClick={() => {
              onFilterStatus('maintenance');
              onClose();
            }}
          >
            <div className={styles.kpiNum} style={{ color: '#06b6d4' }}>
              {analytics.statusCounts.maintenance}
            </div>
            <div className={styles.kpiLabel}>Maintenance</div>
            <div className={styles.kpiSub}>Click to Filter Map</div>
          </div>

          <div
            className={styles.kpiCard}
            onClick={() => {
              onFilterStatus('warning');
              onClose();
            }}
          >
            <div className={styles.kpiNum} style={{ color: '#f59e0b' }}>
              {analytics.statusCounts.warning}
            </div>
            <div className={styles.kpiLabel}>Warnings</div>
            <div className={styles.kpiSub}>Click to Filter Map</div>
          </div>

          <div
            className={styles.kpiCard}
            onClick={() => {
              onFilterStatus('critical');
              onClose();
            }}
          >
            <div className={styles.kpiNum} style={{ color: '#ef4444' }}>
              {analytics.statusCounts.critical}
            </div>
            <div className={styles.kpiLabel}>Critical</div>
            <div className={styles.kpiSub}>Click to Filter Map</div>
          </div>
        </div>

        {/* Type distribution breakdown */}
        <div className={styles.typeDistributionSection}>
          <div className={styles.sectionTitle}>Building Type Distribution</div>
          <div className={styles.typePills}>
            <button
              className={`${styles.typePill} ${typeFilter === 'all' ? styles.typePillActive : ''}`}
              onClick={() => setTypeFilter('all')}
            >
              All Types ({analytics.totalBuildings})
            </button>
            {Object.entries(analytics.typeCounts).map(([type, count]) => (
              <button
                key={type}
                className={`${styles.typePill} ${typeFilter === type ? styles.typePillActive : ''}`}
                onClick={() => setTypeFilter(type)}
              >
                {type} ({count})
              </button>
            ))}
          </div>
        </div>

        {/* Searchable building register table */}
        <div className={styles.tableSection}>
          <div className={styles.tableToolbar}>
            <input
              type="text"
              placeholder="Filter register by name, type, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.tableSearch}
            />
            <span className={styles.matchCount}>
              Showing {filtered.length} of {buildings.length} facilities
            </span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Building Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div className={styles.tableName}>{b.name}</div>
                      {b.hasTelemetry && (
                        <span className={styles.liveTelemetryTag}>● Live Telemetry Online</span>
                      )}
                    </td>
                    <td>
                      <span className={styles.typeBadge}>{b.type}</span>
                    </td>
                    <td>
                      <span
                        className={styles.statusBadge}
                        style={{
                          color:
                            b.status === 'operational'
                              ? '#10b981'
                              : b.status === 'maintenance'
                              ? '#06b6d4'
                              : b.status === 'warning'
                              ? '#f59e0b'
                              : b.status === 'critical'
                              ? '#ef4444'
                              : '#94a3b8',
                          background:
                            b.status === 'operational'
                              ? 'rgba(16, 185, 129, 0.12)'
                              : b.status === 'maintenance'
                              ? 'rgba(6, 182, 212, 0.12)'
                              : b.status === 'warning'
                              ? 'rgba(245, 158, 11, 0.12)'
                              : b.status === 'critical'
                              ? 'rgba(239, 68, 68, 0.12)'
                              : 'rgba(148, 163, 184, 0.12)',
                        }}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className={styles.locCell}>{b.location}</td>
                    <td>
                      <button
                        className={styles.inspectBtn}
                        onClick={() => {
                          onSelectBuilding(b);
                          onClose();
                        }}
                      >
                        Inspect on Map →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

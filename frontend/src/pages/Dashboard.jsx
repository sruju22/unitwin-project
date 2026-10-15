import { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import EnergyTelemetryChart from '../components/Dashboard/EnergyTelemetryChart';
import CampusAerialTwinCard from '../components/Dashboard/CampusAerialTwinCard';
import CampusIntelligencePanel from '../components/Dashboard/CampusIntelligencePanel';
import AlertsCommandPanel from '../components/Dashboard/AlertsCommandPanel';
import { getBuildings, getOccupancy, getEnergyUsage, getAlerts, getInsights } from '../api/client';
import { formatCampusDate } from '../utils/dateUtils';
import styles from './Dashboard.module.css';

export default function Dashboard({ onNavigate, reportingDate = '2026-10-14', onSelectDate }) {
  const [buildings, setBuildings] = useState([]);
  const [occupancySummary, setOccupancySummary] = useState(null);
  const [energySummary, setEnergySummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertsSummary, setAlertsSummary] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        setLoading(true);
        // Synchronously bind all telemetry streams to the selected reporting date
        const [bldRes, occRes, nrgRes, alrRes, insRes] = await Promise.allSettled([
          getBuildings(),
          getOccupancy({ date: reportingDate }),
          getEnergyUsage({ date: reportingDate }),
          getAlerts({ asOfDate: `${reportingDate}T23:59:59.999+05:30` }),
          getInsights({ date: reportingDate }),
        ]);

        if (isMounted) {
          if (bldRes.status === 'fulfilled' && Array.isArray(bldRes.value?.data)) {
            setBuildings(bldRes.value.data);
            setDbConnected(true);
          }
          if (occRes.status === 'fulfilled' && occRes.value?.summary) {
            setOccupancySummary(occRes.value.summary);
          } else {
            setOccupancySummary(null);
          }
          if (nrgRes.status === 'fulfilled' && nrgRes.value?.summary) {
            setEnergySummary(nrgRes.value.summary);
          } else {
            setEnergySummary(null);
          }
          if (alrRes.status === 'fulfilled' && Array.isArray(alrRes.value?.data)) {
            const valid = alrRes.value.data.filter((a) => {
              if (!a || typeof a !== 'object') return false;
              const title = (a.title || a.alertType || a.alertId || '').trim();
              const detail = (a.detail || a.message || a.description || '').trim();
              return Boolean(title || detail);
            });
            setAlerts(valid);
            setAlertsSummary(alrRes.value?.summary || null);
          } else {
            setAlerts([]);
            setAlertsSummary(null);
          }
          if (insRes.status === 'fulfilled' && Array.isArray(insRes.value?.data)) {
            setInsights(insRes.value.data);
          } else {
            setInsights([]);
          }
        }
      } catch (err) {
        console.warn('Dashboard data fetch error:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, [reportingDate]);

  // Compute metrics from actual database collections or surveyed inventory
  const totalBuildings = buildings.length || 21;
  const activeBuildings = buildings.length
    ? buildings.filter(
        (b) =>
          (b.status || '').toLowerCase() === 'active' ||
          (b.status || '').toLowerCase() === 'operational'
      ).length
    : 21;

  const operationalBuildingsKPI = {
    id: 'buildings',
    title: 'Active Buildings',
    value: activeBuildings,
    unit: `/ ${totalBuildings}`,
    delta: `${Math.round((activeBuildings / totalBuildings) * 100)}% Online`,
    deltaUp: true,
    accent: 'blue',
    secondaryText: `${activeBuildings} Active Campus Buildings`,
    sparkline: Array(7).fill(activeBuildings),
    loading: loading,
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="3 9 12 2 21 9 21 20 3 20" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  };

  const occDateLabel = occupancySummary?.timestamp
    ? formatCampusDate(occupancySummary.timestamp)
    : formatCampusDate(reportingDate);
  const occupancyKPI = occupancySummary
    ? {
        id: 'occupancy',
        title: 'Campus Occupancy',
        value: Math.round(occupancySummary.averageUtilization),
        unit: '%',
        delta: 'Pilot Telemetry',
        deltaUp: true,
        accent: 'green',
        secondaryText: `${occupancySummary.totalOccupancy.toLocaleString()} Present · ${occupancySummary.totalCapacity.toLocaleString()} Cap · ${occDateLabel}, ${occupancySummary.snapshotLabel || 'Daytime'}`,
        sparkline: (occupancySummary.timeline || []).map((t) => t.utilization),
        loading: loading,
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      }
    : {
        id: 'occupancy',
        title: 'Campus Occupancy',
        value: '—',
        unit: 'Awaiting data',
        delta: 'No Readings',
        deltaUp: null,
        accent: 'green',
        secondaryText: `No occupancy telemetry for ${formatCampusDate(reportingDate)}`,
        sparkline: null,
        loading: loading,
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      };

  const energyDateLabel = energySummary?.timestamp
    ? formatCampusDate(energySummary.timestamp)
    : formatCampusDate(reportingDate);
  const energyKPI = energySummary
    ? {
        id: 'energy',
        title: 'Active Power Demand (kW)',
        value: energySummary.latestDemandKw,
        unit: 'kW',
        delta: energySummary.isHistorical
          ? 'Pilot Baseline'
          : (energySummary.isFuture ? 'Simulation' : 'Live Baseline'),
        deltaUp: null,
        accent: 'teal',
        secondaryText: `${energySummary.latestEnergyKwh} kWh interval · ${energyDateLabel}, ${energySummary.snapshotLabel}`,
        sparkline: (energySummary.timeline || []).map((t) => t.demandKw),
        loading: loading,
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        ),
      }
    : {
        id: 'energy',
        title: 'Active Power Demand (kW)',
        value: '—',
        unit: 'Awaiting data',
        delta: 'No Readings',
        deltaUp: null,
        accent: 'teal',
        secondaryText: `No meter telemetry recorded for ${formatCampusDate(reportingDate)}`,
        sparkline: null,
        loading: loading,
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        ),
      };

  const highPriorityAlertsCount = alertsSummary?.highSeverityCount ??
    alerts.filter((a) => {
      const sev = String(a.severity || '').toLowerCase();
      return (sev === 'critical' || sev === 'high') && !a.acknowledged;
    }).length;

  const criticalAlertsKPI = alerts.length > 0
    ? {
        id: 'alerts',
        title: 'Critical Alerts',
        value: highPriorityAlertsCount,
        unit: 'Active',
        delta: `${highPriorityAlertsCount} High Priority`,
        deltaUp: false,
        accent: highPriorityAlertsCount > 0 ? 'red' : 'green',
        secondaryText: `${alerts.length} Total Incidents as of ${formatCampusDate(reportingDate)}`,
        sparkline: [12, 14, 18, 15, 20, 22, highPriorityAlertsCount],
        loading: loading,
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      }
    : {
        id: 'alerts',
        title: 'Critical Alerts',
        value: 0,
        unit: 'Active',
        delta: 'All Clear',
        deltaUp: true,
        accent: 'green',
        secondaryText: `No active alarms for ${formatCampusDate(reportingDate)}`,
        sparkline: [0, 0, 0, 0, 0, 0, 0],
        loading: loading,
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      };

  const statCards = [
    operationalBuildingsKPI,
    occupancyKPI,
    energyKPI,
    criticalAlertsKPI,
  ];

  return (
    <div className={styles.page}>
      {/* Executive Overview Command Bar */}
      <section className={styles.commandBanner}>
        <div className={styles.bannerLeft}>
          <div className={styles.pulseBeacon}>
            <span className={styles.beaconRing} />
            <span className={styles.beaconDot} />
          </div>
          <div>
            <div className={styles.bannerTitleRow}>
              <h2 className={styles.bannerTitle}>Campus Operations Overview</h2>
              <span className={styles.systemStatusTag}>
                {dbConnected ? 'Database Connected' : 'Awaiting Connection'}
              </span>
              <span className={styles.activeDateTag}>
                {formatCampusDate(reportingDate, { includeYear: true })}
              </span>
            </div>
            <p className={styles.bannerSubtitle}>
              Executive digital twin · {totalBuildings || 10} Buildings Monitored · October 12–17 Pilot Baseline
            </p>
          </div>
        </div>

        {/* Synchronized Reporting Date Selector */}
        <div className={styles.dateSelectorGroup} role="group" aria-label="Select reporting date">
          <span className={styles.dateSelectorLabel}>Date:</span>
          {[
            { date: '2026-10-12', label: 'Oct 12' },
            { date: '2026-10-13', label: 'Oct 13' },
            { date: '2026-10-14', label: 'Oct 14' },
            { date: '2026-10-15', label: 'Oct 15' },
            { date: '2026-10-16', label: 'Oct 16' },
            { date: '2026-10-17', label: 'Oct 17' },
          ].map((pill) => (
            <button
              key={pill.date}
              type="button"
              className={`${styles.datePill} ${reportingDate === pill.date ? styles.datePillActive : ''}`}
              onClick={() => onSelectDate?.(pill.date)}
              title={`Switch dashboard to ${pill.label}`}
            >
              {pill.label}
            </button>
          ))}
          {/* Custom Date Input for No-Data Testing */}
          <label className={styles.customDateWrapper} title="Test custom date (e.g. Oct 18 for missing data test)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <input
              type="date"
              className={styles.customDateInput}
              value={reportingDate}
              onChange={(e) => e.target.value && onSelectDate?.(e.target.value)}
              aria-label="Pick custom reporting date"
            />
          </label>
        </div>
      </section>

      {/* Four Compact Top-Level KPI Cards */}
      <section className={styles.statsGrid} aria-label="Campus overview metrics">
        {statCards.map((stat, i) => (
          <StatCard key={stat.id} {...stat} index={i} />
        ))}
      </section>

      {/* Row 1: Energy & Solar Performance + Clean Campus Aerial Preview */}
      <section className={styles.contentRow} aria-label="Energy & Solar Performance & Campus Overview">
        <div className={styles.leftCol}>
          <EnergyTelemetryChart
            reportingDate={reportingDate}
            onSelectDate={onSelectDate}
          />
        </div>
        <div className={styles.rightCol}>
          <CampusAerialTwinCard
            buildingCount={totalBuildings || 10}
            dbConnected={dbConnected}
            onNavigateToCampus={() => onNavigate('campus')}
          />
        </div>
      </section>

      {/* Row 2: Alerts & Incidents + Campus Intelligence */}
      <section className={styles.contentRow} aria-label="Alerts & Incidents & Campus Intelligence">
        <div className={styles.leftCol}>
          <AlertsCommandPanel
            onNavigateToAlerts={() => onNavigate('alerts')}
            reportingDate={reportingDate}
          />
        </div>
        <div className={styles.rightCol}>
          <CampusIntelligencePanel
            recommendations={insights}
            onNavigateToAnalytics={() => onNavigate('analytics')}
          />
        </div>
      </section>
    </div>
  );
}

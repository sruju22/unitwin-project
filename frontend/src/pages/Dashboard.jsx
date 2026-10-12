import { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import EnergyTelemetryChart from '../components/Dashboard/EnergyTelemetryChart';
import CampusAerialTwinCard from '../components/Dashboard/CampusAerialTwinCard';
import CampusIntelligencePanel from '../components/Dashboard/CampusIntelligencePanel';
import AlertsCommandPanel from '../components/Dashboard/AlertsCommandPanel';
import { getBuildings, getOccupancy, getEnergyUsage, getAlerts, getInsights } from '../api/client';
import styles from './Dashboard.module.css';

export default function Dashboard({ onNavigate }) {
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
        const asOfDate = new Date().toISOString();
        const [bldRes, occRes, nrgRes, alrRes, insRes] = await Promise.allSettled([
          getBuildings(),
          getOccupancy({ asOfDate }),
          getEnergyUsage({ asOfDate }),
          getAlerts({ asOfDate }),
          getInsights(),
        ]);

        if (isMounted) {
          if (bldRes.status === 'fulfilled' && Array.isArray(bldRes.value?.data)) {
            setBuildings(bldRes.value.data);
            setDbConnected(true);
          }
          if (occRes.status === 'fulfilled') {
            if (occRes.value?.summary) {
              setOccupancySummary(occRes.value.summary);
            }
          }
          if (nrgRes.status === 'fulfilled') {
            if (nrgRes.value?.summary) {
              setEnergySummary(nrgRes.value.summary);
            }
          }
          if (alrRes.status === 'fulfilled' && Array.isArray(alrRes.value?.data)) {
            const valid = alrRes.value.data.filter((a) => {
              if (!a || typeof a !== 'object') return false;
              const title = (a.title || a.alertType || a.alertId || '').trim();
              const detail = (a.detail || a.message || a.description || '').trim();
              return Boolean(title || detail);
            });
            setAlerts(valid);
            if (alrRes.value?.summary) {
              setAlertsSummary(alrRes.value.summary);
            }
          }
          if (insRes.status === 'fulfilled' && Array.isArray(insRes.value?.data)) {
            setInsights(insRes.value.data);
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
  }, []);

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

  const occupancyKPI = occupancySummary
    ? {
        id: 'occupancy',
        title: 'Campus Occupancy',
        value: Math.round(occupancySummary.averageUtilization),
        unit: '%',
        delta: 'Pilot Telemetry',
        deltaUp: true,
        accent: 'green',
        secondaryText: `${occupancySummary.totalOccupancy.toLocaleString()} Present · ${occupancySummary.totalCapacity.toLocaleString()} Cap`,
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
        delta: 'Sensors Offline',
        deltaUp: null,
        accent: 'green',
        secondaryText: 'No live occupancy stream',
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

  const energyKPI = energySummary
    ? {
        id: 'energy',
        title: 'Current Energy Demand',
        value: energySummary.latestDemandKw,
        unit: 'kW',
        delta: 'Pilot Baseline',
        deltaUp: true,
        accent: 'teal',
        secondaryText: `${energySummary.latestEnergyKwh} kWh · ${energySummary.snapshotLabel}`,
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
        title: 'Current Energy Demand',
        value: '—',
        unit: 'Awaiting data',
        delta: 'Meters Offline',
        deltaUp: null,
        accent: 'teal',
        secondaryText: 'No active meter telemetry',
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
        secondaryText: `${alerts.length} Total Incidents · Pilot Feed`,
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
        secondaryText: 'No critical alarms reported',
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
                {dbConnected ? 'Database Connected · Pilot Dataset' : 'Awaiting Connection'}
              </span>
            </div>
            <p className={styles.bannerSubtitle}>
              Executive overview · {totalBuildings || 10} Buildings Monitored · Oct 12–16 Telemetry Baseline
            </p>
          </div>
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
          <EnergyTelemetryChart />
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
          <AlertsCommandPanel onNavigateToAlerts={() => onNavigate('alerts')} />
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

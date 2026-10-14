import { useState, useEffect } from 'react';
import { getEnergyUsage, getSolarGeneration, getAlerts } from '../api/client';
import { formatCampusDate, formatCampusDateTime } from '../utils/dateUtils';
import Skeleton from '../components/Skeleton';
import styles from './Energy.module.css';

export default function Energy({ onNavigate }) {
  const [energyData, setEnergyData] = useState(null);
  const [solarData, setSolarData] = useState(null);
  const [energyAlerts, setEnergyAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const [energyRes, solarRes, alertsRes] = await Promise.allSettled([
          getEnergyUsage(),
          getSolarGeneration(),
          getAlerts(),
        ]);

        if (isMounted) {
          if (energyRes.status === 'fulfilled' && energyRes.value) {
            setEnergyData(energyRes.value);
          }
          if (solarRes.status === 'fulfilled' && solarRes.value) {
            setSolarData(solarRes.value);
          }
          if (alertsRes.status === 'fulfilled' && Array.isArray(alertsRes.value?.data)) {
            const filtered = alertsRes.value.data.filter(
              (a) =>
                (a.alertType || '').toLowerCase().includes('energy') ||
                (a.alertType || '').toLowerCase().includes('solar')
            );
            setEnergyAlerts(filtered);
          }
        }
      } catch (err) {
        console.warn('Energy page data load error:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const energySummary = energyData?.summary || null;
  const solarSummary = solarData?.summary || null;
  const dailyComparison = energySummary?.dailyComparison || [];
  const appliances = energySummary?.appliances || [];
  const panels = solarSummary?.panels || [];

  const formatTime = (ts) => {
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
            <h1 className={styles.title}>Campus Energy &amp; Solar PV Performance</h1>
            <span className={styles.datasetTag}>
              MongoDB Atlas · {energySummary?.totalRecordsCount?.toLocaleString() || '43,344'} Energy &amp; {solarData?.count || solarSummary?.totalRecordsCount || 2100} Solar Records
            </span>
          </div>
          <p className={styles.subtitle}>
            Main Building electrical sub-meter telemetry coupled with rooftop Solar001 photovoltaic generation and net grid import tracking.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Refresh database streams"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>Sync Data</span>
          </button>
        </div>
      </section>

      {/* KPI Overview Grid - 6 Technically Rigorous Power & Energy Metrics */}
      <section className={styles.kpiGrid}>
        {/* Card 1: Total Campus Consumption */}
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Campus Consumption</span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>
              {loading ? (
                <Skeleton width="90px" height="32px" />
              ) : (
                (energySummary?.totalCampusEnergyKWh || 3668.7).toLocaleString()
              )}
            </span>
            <span className={styles.kpiUnit}>kWh</span>
          </div>
          <span className={styles.kpiSub}>
            {energySummary?.reportingPeriod || 'Oct 12–17, 2026 (Baseline)'}
          </span>
        </div>

        {/* Card 2: Solar Energy Generated */}
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Solar Energy Generated</span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>
              {loading ? (
                <Skeleton width="80px" height="32px" />
              ) : (
                (solarSummary?.totalGeneratedKWh || energySummary?.totalSolarGeneratedKWh || 435.1).toLocaleString()
              )}
            </span>
            <span className={styles.kpiUnit}>kWh</span>
          </div>
          <span className={styles.kpiSub}>
            {solarSummary?.reportingPeriod || energySummary?.reportingPeriod || 'Oct 12–17, 2026 (Simulated)'}
          </span>
        </div>

        {/* Card 3: Active Power Demand */}
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Active Power Demand</span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>
              {loading ? (
                <Skeleton width="80px" height="32px" />
              ) : (
                energySummary?.latestDemandKw ?? 33.4
              )}
            </span>
            <span className={styles.kpiUnit}>kW</span>
          </div>
          <span className={styles.kpiSub}>
            Latest snapshot: {energySummary?.snapshotLabel || '05:00 PM IST'}
          </span>
        </div>

        {/* Card 4: Current Solar Output */}
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Current Solar Output</span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue} style={{ color: '#0F9D8A' }}>
              {loading ? (
                <Skeleton width="80px" height="32px" />
              ) : (
                typeof energySummary?.solarKw === 'number'
                  ? energySummary.solarKw.toFixed(2)
                  : (solarSummary?.latestSnapshot?.currentSolarPowerKW ?? 1.6)
              )}
            </span>
            <span className={styles.kpiUnit}>kW</span>
          </div>
          <span className={styles.kpiSub}>
            Latest snapshot: {energySummary?.snapshotLabel || '05:00 PM IST'} [SIM]
          </span>
        </div>

        {/* Card 5: Net Grid Import */}
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Net Grid Import</span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>
              {loading ? (
                <Skeleton width="80px" height="32px" />
              ) : (
                energySummary?.netImportKw ?? 31.8
              )}
            </span>
            <span className={styles.kpiUnit}>kW</span>
          </div>
          <span className={styles.kpiSub}>
            Latest snapshot: {energySummary?.snapshotLabel || '05:00 PM IST'}
          </span>
        </div>

        {/* Card 6: Solar Offset */}
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Solar Offset</span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue} style={{ color: '#0F9D8A' }}>
              {loading ? (
                <Skeleton width="80px" height="32px" />
              ) : (
                `${energySummary?.solarOffsetPct ?? 4.8}%`
              )}
            </span>
          </div>
          <span className={styles.kpiSub}>
            Synchronized load: {energySummary?.solarKw ?? 1.6} kW / {energySummary?.latestDemandKw ?? 33.4} kW
          </span>
        </div>
      </section>

      {/* Row 2: Daily Comparison Table + Solar Array Breakdown */}
      <section className={styles.gridTwoCol}>
        {/* Daily Consumption vs Solar Generation Table */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h3 className={styles.panelTitle}>Daily Energy Consumption vs. Solar Generation</h3>
              <p className={styles.panelSubtitle}>
                Measured energy consumption (kWh) against on-site solar yield over the {dailyComparison.length || 6}-day monitoring baseline
              </p>
            </div>
            <span className={styles.panelBadge}>{dailyComparison.length || 6} Days Logged</span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Skeleton width="100%" height="40px" />
              <Skeleton width="100%" height="40px" />
              <Skeleton width="100%" height="40px" />
              <Skeleton width="100%" height="40px" />
              <Skeleton width="100%" height="40px" />
            </div>
          ) : dailyComparison.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Consumption (kWh)</th>
                    <th>Solar Generation (kWh)</th>
                    <th>Net Grid Import (kWh)</th>
                    <th>Daily Solar Offset</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyComparison.map((row) => (
                    <tr key={row.date}>
                      <td className={styles.dateCell}>{formatCampusDate(row.date, { includeYear: true }) || row.date}</td>
                      <td>{row.consumptionKWh}</td>
                      <td>{row.solarGeneratedKWh}</td>
                      <td>{row.netGridImportKWh}</td>
                      <td>
                        <span className={styles.offsetPill}>
                          {row.solarContributionPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.panelSubtitle}>No daily timeline records available.</p>
          )}
        </div>

        {/* Solar PV Array Panels Matrix */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h3 className={styles.panelTitle}>Rooftop Solar PV Array (SOLAR001)</h3>
              <p className={styles.panelSubtitle}>
                Main Building rooftop array · {solarSummary?.panelCount || panels.length || 50} simulated panels (assumed {solarSummary?.systemCapacityKW || 20.0} kWp total capacity)
              </p>
            </div>
            <span className={styles.panelBadge}>{panels.length || solarSummary?.panelCount || 50} / {solarSummary?.panelCount || 50} Modelled</span>
          </div>

          {loading ? (
            <div className={styles.panelsGrid}>
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} width="100%" height="80px" />
              ))}
            </div>
          ) : panels.length > 0 ? (
            <div className={styles.panelsGrid}>
              {panels.map((p) => {
                const currentPower = typeof p.currentPowerKW === 'number'
                  ? p.currentPowerKW.toFixed(2)
                  : ((p.totalGeneratedKWh / (solarSummary?.totalGeneratedKWh || 435.0)) * (energySummary?.solarKw || 12.0)).toFixed(2);
                return (
                  <div key={p.panelId} className={styles.panelCard}>
                    <div className={styles.panelCardHeader}>
                      <span className={styles.panelId}>{p.panelId}</span>
                      <span className={styles.panelDot} title={p.status || 'Online'} />
                    </div>
                    <div className={styles.panelMetricRow}>
                      <span className={styles.panelPowerVal}>{currentPower} kW</span>
                      <span className={styles.panelPowerLabel}>Current Power</span>
                    </div>
                    <div className={styles.panelEnergyRow}>
                      <span className={styles.panelEnergyVal}>{p.totalGeneratedKWh} kWh</span>
                      <span className={styles.panelEnergyLabel}>Total Energy</span>
                    </div>
                    <span className={styles.panelCapacity}>Assumed {p.capacityKW || 0.4} kWp</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.panelSubtitle}>No panel records found.</p>
          )}

          <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
            <strong>Simulation Model Notice:</strong> Actual campus solar panel ratings and technical specifications are unverified. Telemetry uses a configurable diurnal simulation model assuming {solarSummary?.systemCapacityKW || 20.0} kWp installed capacity ({solarSummary?.panelCapacityKW ? Math.round(solarSummary.panelCapacityKW * 1000) : 400}W/module).
          </div>
        </div>
      </section>

      {/* Row 3: Appliance Load Breakdown + Energy Incident Telemetry */}
      <section className={styles.gridTwoCol}>
        {/* Electrical Appliance Breakdown */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h3 className={styles.panelTitle}>Appliance Electrical Load Distribution</h3>
              <p className={styles.panelSubtitle}>
                Active power consumption across campus appliance categories from {energySummary?.totalRecordsCount?.toLocaleString() || '43,344'} telemetry records
              </p>
            </div>
            <span className={styles.panelBadge}>{appliances.length} Categories</span>
          </div>

          {loading ? (
            <div className={styles.applianceList}>
              <Skeleton width="100%" height="50px" />
              <Skeleton width="100%" height="50px" />
              <Skeleton width="100%" height="50px" />
            </div>
          ) : appliances.length > 0 ? (
            <>
              <div className={styles.applianceList}>
                {appliances.map((app) => (
                  <div key={app.type} className={styles.applianceItem}>
                    <div>
                      <span className={styles.applianceName}>{app.type}</span>
                      <div className={styles.applianceMeta}>
                        {app.recordCount.toLocaleString()} sub-meter records cataloged
                      </div>
                    </div>
                    <div>
                      <div className={styles.appliancePower}>
                        {(app.activeWatts / 1000).toFixed(1)} kW
                      </div>
                      <div className={styles.applianceMeta}>
                        {app.totalKWh.toLocaleString()} kWh total
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.alarmListFooter}>
                <span>Appliance inventory aggregated across {energySummary?.totalRecordsCount?.toLocaleString() || '43,344'} baseline readings</span>
                <span style={{ color: 'var(--text-muted)' }}>371.4 kW connected load</span>
              </div>
            </>
          ) : (
            <p className={styles.panelSubtitle}>No appliance records available.</p>
          )}
        </div>

        {/* Energy & Solar Alarms */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h3 className={styles.panelTitle}>Energy &amp; Solar Incident Telemetry</h3>
              <p className={styles.panelSubtitle}>
                Active alarms, consumption threshold drifts, and solar profile anomalies from MongoDB
              </p>
            </div>
            <span className={styles.panelBadge}>{energyAlerts.length} Active Records</span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Skeleton width="100%" height="60px" />
              <Skeleton width="100%" height="60px" />
              <Skeleton width="100%" height="60px" />
            </div>
          ) : energyAlerts.length > 0 ? (
            <>
              <div className={styles.alarmList}>
                {energyAlerts.map((al) => {
                  const sev = (al.severity || 'Medium').toLowerCase();
                  const isCrit = sev === 'high' || sev === 'critical';
                  const isWarn = sev === 'medium' || sev === 'warning';
                  const isLow = sev === 'low' || sev === 'info';

                  const typeLower = (al.alertType || '').toLowerCase();
                  const isSolar = typeLower.includes('solar');

                  const alertTitle = al.title || (
                    isSolar
                      ? `Solar PV Anomaly · ${al.systemId || 'SOLAR001'}`
                      : `Electrical Load Drift · ${al.roomNumber ? `Room ${al.roomNumber}` : al.buildingId || 'Main Building'}`
                  );

                  return (
                    <div
                      key={al._id || al.alertId}
                      className={`${styles.alarmItem} ${
                        isCrit ? styles.alarmItemCritical : isWarn ? styles.alarmItemWarning : isLow ? styles.alarmItemLow : ''
                      }`}
                    >
                      <div className={styles.alarmHeaderRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            className={`${styles.alarmTypeTag} ${
                              isCrit
                                ? styles.alarmTypeTagCritical
                                : isWarn
                                ? styles.alarmTypeTagWarning
                                : styles.alarmTypeTagLow
                            }`}
                          >
                            {isSolar ? '☀️ Solar' : '⚡ Energy'} · {al.severity || 'Notice'}
                          </span>
                          <span className={styles.alarmIdBadge}>{al.alertId}</span>
                        </div>
                        <span className={styles.alarmTime}>{formatTime(al.timestamp)}</span>
                      </div>

                      <h4 className={styles.alarmCardTitle}>{alertTitle}</h4>

                      <p className={styles.alarmMsg}>{al.message}</p>

                      {al.actionRecommended && (
                        <div className={styles.alarmAction}>
                          <strong className={styles.actionLabel}>Recommended Action:</strong>{' '}
                          <span>{al.actionRecommended}</span>
                        </div>
                      )}

                      <div className={styles.alarmFooterMeta}>
                        <span>Building: {al.buildingId || 'BLD001'}</span>
                        {al.roomNumber && <span>Location: Room {al.roomNumber}</span>}
                        <span>Source: {al.sourceCollection || (isSolar ? 'solarGeneration' : 'energyUsage')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={styles.alarmListFooter}>
                <span>Showing all {energyAlerts.length} verified telemetry incidents from MongoDB Atlas</span>
                <span style={{ color: 'var(--text-muted)' }}>Scroll to inspect history</span>
              </div>
            </>
          ) : (
            <p className={styles.panelSubtitle}>
              All energy and solar streams are operating within normal operational baselines.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

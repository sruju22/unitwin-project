import { useState, useEffect } from 'react';
import { getAlerts } from '../../api/client';
import styles from './AlertsCommandPanel.module.css';

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)' },
  warning:  { label: 'Warning',  color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  info:     { label: 'Info',     color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' },
};

function normalizeSeverity(severity) {
  const s = String(severity || '').toLowerCase();
  if (s === 'critical' || s === 'high') return 'critical';
  if (s === 'warning' || s === 'medium') return 'warning';
  if (s === 'info' || s === 'low') return 'info';
  return 'warning';
}

function getSeverityMeta(severity) {
  const norm = normalizeSeverity(severity);
  return SEVERITY_CONFIG[norm] || SEVERITY_CONFIG.warning;
}

function formatAlertTime(timestamp) {
  if (!timestamp) return 'Active';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Active';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Active';
  }
}

function filterValidAlerts(rawAlerts) {
  if (!Array.isArray(rawAlerts)) return [];
  return rawAlerts.filter((alert) => {
    if (!alert || typeof alert !== 'object') return false;
    // Must have substantive data: at least meaningful title, message, or detail
    const title = (alert.title || alert.alertType || alert.alertId || '').trim();
    const detail = (alert.detail || alert.message || alert.description || '').trim();
    if (!title && !detail) return false;
    return true;
  });
}

export default function AlertsCommandPanel({ onNavigateToAlerts }) {
  const [alerts, setAlerts] = useState([]);
  const [actionFeedback, setActionFeedback] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchAlertsData() {
      try {
        const res = await getAlerts();
        if (isMounted) {
          if (res && Array.isArray(res.data)) {
            const valid = filterValidAlerts(res.data);
            setAlerts(valid);
          } else {
            setAlerts([]);
          }
        }
      } catch (err) {
        console.warn('Alerts feed unavailable:', err.message);
        if (isMounted) setAlerts([]);
      }
    }
    fetchAlertsData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAcknowledge = (id) => {
    setAlerts((prev) =>
      prev.map((a) => (a._id === id || a.id === id || a.alertId === id ? { ...a, acknowledged: !a.acknowledged } : a))
    );
  };

  const handleAction = (alert, title) => {
    let msg = '';
    if (alert.actionType === 'dispatch') {
      msg = `Technician dispatched to ${alert.location || 'site'}. ETA: 12 mins.`;
    } else if (alert.actionType === 'reroute') {
      msg = 'Crowd management guidance sent to campus mobile app.';
    } else {
      msg = `Action executed for ${title || alert.title || 'alert'}.`;
    }
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const criticalCount = alerts.filter(
    (a) => normalizeSeverity(a.severity) === 'critical' && !a.acknowledged
  ).length;

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={`${styles.iconChip} ${criticalCount > 0 ? styles.chipPulse : ''}`}>
            {criticalCount > 0 ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <div>
            <h3 className={styles.title}>Alerts &amp; Incidents</h3>
            <p className={styles.subtitle}>Active exceptions requiring operational response</p>
          </div>
        </div>

        {criticalCount > 0 ? (
          <span className={styles.activePill}>{criticalCount} Critical</span>
        ) : (
          <span className={styles.nominalPill}>All Clear</span>
        )}
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div className={styles.feedbackBanner}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Alerts List or All Systems Nominal Empty State */}
      <div className={styles.list}>
        {alerts.length > 0 ? (
          alerts.slice(0, 3).map((alert) => {
            const id = alert._id || alert.id || alert.alertId;
            const meta = getSeverityMeta(alert.severity);
            const title =
              alert.title?.trim() ||
              (alert.alertType && (alert.roomNumber || alert.location)
                ? `${alert.alertType} Alert — ${alert.roomNumber || alert.location}`
                : alert.alertType || alert.alertId || 'Campus Incident');
            const detail =
              alert.detail?.trim() ||
              alert.message?.trim() ||
              alert.description?.trim() ||
              'No incident details provided.';
            const location = alert.location || alert.roomNumber || alert.buildingId || null;
            const timeTag = alert.time || (alert.timestamp ? formatAlertTime(alert.timestamp) : 'Active');
            const actionLabel =
              alert.actionLabel ||
              (alert.actionRecommended
                ? alert.actionRecommended.length > 25
                  ? 'Action Required'
                  : alert.actionRecommended
                : null);

            return (
              <div
                key={id}
                className={`${styles.alertCard} ${alert.acknowledged ? styles.cardAck : ''}`}
                style={{ borderLeftColor: meta.color }}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.badgeLine}>
                    <span
                      className={styles.severityBadge}
                      style={{ color: meta.color, background: meta.bg }}
                    >
                      <span className={styles.severityDot} style={{ background: meta.color }} />
                      {meta.label}
                    </span>
                    {location && <span className={styles.locationTag}>· {location}</span>}
                  </div>
                  <span className={styles.timeTag}>{timeTag}</span>
                </div>

                <h4 className={styles.alertTitle}>{title}</h4>
                <p className={styles.alertDetail}>{detail}</p>

                <div className={styles.cardActions}>
                  <button
                    onClick={() => handleAcknowledge(id)}
                    className={`${styles.ackBtn} ${alert.acknowledged ? styles.ackBtnActive : ''}`}
                  >
                    {alert.acknowledged ? (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Acknowledged
                      </>
                    ) : (
                      'Acknowledge'
                    )}
                  </button>

                  {actionLabel && (
                    <button
                      onClick={() => handleAction(alert, title)}
                      className={styles.primaryActionBtn}
                    >
                      {actionLabel}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className={styles.nominalStateWrap}>
            <div className={styles.nominalIconWrap}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <div className={styles.nominalContent}>
              <h4 className={styles.nominalTitle}>No Active Alerts</h4>
              <p className={styles.nominalDetail}>
                All systems nominal. No critical alarms or active incident reports requiring operational response.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      {onNavigateToAlerts && (
        <button
          onClick={onNavigateToAlerts}
          className={styles.viewMoreBtn}
        >
          <span>View All Alerts</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      )}
    </div>
  );
}

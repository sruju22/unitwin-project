import { useState } from 'react';
import styles from './CampusIntelligencePanel.module.css';

export default function CampusIntelligencePanel({ recommendations = [], onNavigateToAnalytics }) {
  const [appliedIds, setAppliedIds] = useState(new Set());

  const handleAction = (id) => {
    setAppliedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasRecommendations = recommendations && recommendations.length > 0;

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.iconChip}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div>
            <h3 className={styles.title}>Campus Intelligence</h3>
            <p className={styles.subtitle}>Prioritized real-time operational recommendations</p>
          </div>
        </div>

        {hasRecommendations ? (
          <span className={styles.efficiencyBadge}>{recommendations.length} Recommendations</span>
        ) : (
          <span className={styles.standbyBadge}>Awaiting Telemetry</span>
        )}
      </div>

      {/* List of real recommendations or clean awaiting feed empty state */}
      <div className={styles.list}>
        {hasRecommendations ? (
          recommendations.map((item) => {
            const isApplied = appliedIds.has(item.id);

            return (
              <div key={item.id} className={`${styles.card} ${isApplied ? styles.cardApplied : ''}`}>
                <div className={styles.cardHeader}>
                  <span className={styles.categoryTag}>{item.category}</span>
                  <span className={styles.impactHighlight}>{item.impact}</span>
                </div>

                <h4 className={styles.itemTitle}>{item.title}</h4>
                <p className={styles.itemDetail}>{item.detail}</p>

                <div className={styles.cardFooter}>
                  <span className={styles.subText}>{item.subText}</span>

                  <button
                    onClick={() => handleAction(item.id)}
                    className={`${styles.actionBtn} ${isApplied ? styles.btnApplied : ''}`}
                  >
                    {isApplied ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {item.appliedLabel || 'Applied'}
                      </>
                    ) : (
                      item.actionLabel || 'Apply'
                    )}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className={styles.emptyStateWrap}>
            <div className={styles.emptyIconWrap}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div className={styles.emptyContent}>
              <h4 className={styles.emptyTitle}>No Insights Available Yet</h4>
              <p className={styles.emptyDetail}>
                Operational recommendations will generate automatically once telemetry feeds are connected.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      {onNavigateToAnalytics && (
        <button
          onClick={onNavigateToAnalytics}
          className={styles.viewMoreBtn}
        >
          <span>View All Insights</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      )}
    </div>
  );
}

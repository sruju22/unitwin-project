import React, { useState, useCallback, useRef } from 'react';
import CampusMap from '../components/Campus2D/CampusMap';
import BuildingDetailsDrawer from '../components/CampusUI/BuildingDetailsDrawer';
import RoomInfoPanel from '../components/CampusUI/RoomInfoPanel';
import CampusAnalyticsModal from '../components/CampusUI/CampusAnalyticsModal';
import { getCampusLogicalAnalytics } from '../data/buildingRegistry';
import styles from './Campus.module.css';

export default function Campus() {
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [hoveredBuilding, setHoveredBuilding] = useState(null);
  const [inspectingBuildingId, setInspectingBuildingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [analytics, setAnalytics] = useState(() => getCampusLogicalAnalytics());
  const hoverLeaveTimerRef = useRef(null);

  const handleSelectBuilding = useCallback((building) => {
    setSelectedBuilding(building);
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
  }, []);

  const handleHoverBuilding = useCallback((building) => {
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
    if (building) {
      setHoveredBuilding(building);
    } else {
      // Short grace period so mouse can enter drawer smoothly
      hoverLeaveTimerRef.current = setTimeout(() => {
        setHoveredBuilding(null);
      }, 350);
    }
  }, []);

  const handleDrawerMouseEnter = useCallback(() => {
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
  }, []);

  const handleDrawerMouseLeave = useCallback(() => {
    if (!selectedBuilding) {
      setHoveredBuilding(null);
    }
  }, [selectedBuilding]);

  const handleCloseDrawer = useCallback(() => {
    setSelectedBuilding(null);
    setHoveredBuilding(null);
  }, []);

  const handleBuildingsLoaded = useCallback(() => {
    setAnalytics(getCampusLogicalAnalytics());
  }, []);

  const handleBuildingUpdated = useCallback((updatedBuilding) => {
    setSelectedBuilding(updatedBuilding);
    if (hoveredBuilding && hoveredBuilding.id === updatedBuilding.id) {
      setHoveredBuilding(updatedBuilding);
    }
    setAnalytics(getCampusLogicalAnalytics());
  }, [hoveredBuilding]);

  const activeDisplayBuilding = hoveredBuilding || selectedBuilding;
  const isHoverPreview = Boolean(
    hoveredBuilding && (!selectedBuilding || hoveredBuilding.id !== selectedBuilding.id)
  );

  return (
    <div className={styles.page}>
      {/* Top bar with synchronized status chips & analytics trigger */}
      <div className={styles.topBar}>
        <div className={styles.buildingLabel}>
          <h2 className={styles.blockName}>Campus Infrastructure Twin</h2>
          <span className={styles.blockSub}>Interactive Spatial Intelligence &amp; Facility Analytics</span>
          <span className={styles.liveTag}>
            <span className={styles.liveDot} />
            {analytics.totalBuildings} Campus Buildings
          </span>
        </div>

        {/* Synchronized status filter buttons */}
        <div className={styles.topChips}>
          <button
            className={`${styles.glassChipBtn} ${statusFilter === 'all' ? styles.chipBtnActive : ''}`}
            onClick={() => setStatusFilter('all')}
            title="Show all campus structures"
          >
            <span>Total:</span>
            <strong>{analytics.totalBuildings}</strong>
          </button>

          <button
            className={`${styles.glassChipBtn} ${statusFilter === 'operational' ? styles.chipBtnActive : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'operational' ? 'all' : 'operational')}
            title="Filter to operational facilities"
          >
            <span style={{ color: '#10b981' }}>● Oper:</span>
            <strong>{analytics.statusCounts.operational}</strong>
          </button>

          <button
            className={`${styles.glassChipBtn} ${statusFilter === 'maintenance' ? styles.chipBtnActive : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'maintenance' ? 'all' : 'maintenance')}
            title="Filter to facilities under maintenance"
          >
            <span style={{ color: '#06b6d4' }}>● Maint:</span>
            <strong>{analytics.statusCounts.maintenance}</strong>
          </button>

          <button
            className={`${styles.glassChipBtn} ${statusFilter === 'warning' ? styles.chipBtnActive : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'warning' ? 'all' : 'warning')}
            title="Filter to facilities with warnings"
          >
            <span style={{ color: '#f59e0b' }}>● Warn:</span>
            <strong>{analytics.statusCounts.warning}</strong>
          </button>

          <button
            className={`${styles.glassChipBtn} ${statusFilter === 'critical' ? styles.chipBtnActive : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'critical' ? 'all' : 'critical')}
            title="Filter to critical facilities"
          >
            <span style={{ color: '#ef4444' }}>● Crit:</span>
            <strong>{analytics.statusCounts.critical}</strong>
          </button>

          <button
            className={`${styles.glassChipBtn} ${statusFilter === 'unknown' ? styles.chipBtnActive : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'unknown' ? 'all' : 'unknown')}
            title="Filter to unverified / initial status buildings"
          >
            <span style={{ color: '#94a3b8' }}>● Unk:</span>
            <strong>{analytics.statusCounts.unknown}</strong>
          </button>

          <button
            className={styles.analyticsTriggerBtn}
            onClick={() => setIsAnalyticsModalOpen(true)}
            title="Open comprehensive building register and type breakdown"
          >
            <span>📊 Register &amp; Analytics</span>
          </button>
        </div>
      </div>

      {/* Main content: Dedicated 2D Campus Map with HUD & Details Drawer */}
      <div className={styles.content}>
        <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
          <CampusMap
            interactive={true}
            selectedBuildingId={selectedBuilding ? selectedBuilding.id : (hoveredBuilding ? hoveredBuilding.id : null)}
            onSelectBuilding={handleSelectBuilding}
            onHoverBuilding={handleHoverBuilding}
            onBuildingsLoaded={handleBuildingsLoaded}
            externalStatusFilter={statusFilter}
          />

          {/* Building Details Drawer (Previews on Hover, Locks on Click) */}
          {activeDisplayBuilding && !inspectingBuildingId && (
            <BuildingDetailsDrawer
              building={activeDisplayBuilding}
              isHoverPreview={isHoverPreview}
              onPinBuilding={(b) => setSelectedBuilding(b)}
              onClose={handleCloseDrawer}
              onBuildingUpdated={handleBuildingUpdated}
              onOpenRoomInspector={(bldId) => setInspectingBuildingId(bldId)}
              onMouseEnter={handleDrawerMouseEnter}
              onMouseLeave={handleDrawerMouseLeave}
            />
          )}

          {/* Room-Level Digital Twin Modal (for C-Block / BLD001) */}
          {inspectingBuildingId && (
            <div
              style={{
                position: 'absolute',
                inset: '1rem',
                zIndex: 65,
                background: 'rgba(11, 13, 20, 0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1.25rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(30, 41, 59, 0.5)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.95rem' }}>
                    Academic Building 1 (C Block) — Room &amp; Timetable Digital Twin
                  </span>
                </div>
                <button
                  onClick={() => setInspectingBuildingId(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: '#cbd5e1',
                    borderRadius: '6px',
                    padding: '0.35rem 0.75rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  Back to Campus Map &times;
                </button>
              </div>
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <RoomInfoPanel
                  buildingId={inspectingBuildingId}
                  onClose={() => setInspectingBuildingId(null)}
                />
              </div>
            </div>
          )}

          {/* Corner HUD labels when drawer is closed */}
          {!activeDisplayBuilding && (
            <div className={styles.mapHud} aria-hidden="true">
              <div className={styles.hudItem}>
                Survey Altitude: <span>120m AGL</span>
              </div>
              <div className={styles.hudItem}>
                Projection: <span>Orthographic</span>
              </div>
              <div className={styles.hudItem}>
                Active Filter: <span style={{ textTransform: 'capitalize' }}>{statusFilter}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comprehensive Campus Analytics & Register Modal */}
      <CampusAnalyticsModal
        isOpen={isAnalyticsModalOpen}
        onClose={() => setIsAnalyticsModalOpen(false)}
        onSelectBuilding={(b) => setSelectedBuilding(b)}
        onFilterStatus={(st) => setStatusFilter(st)}
      />
    </div>
  );
}

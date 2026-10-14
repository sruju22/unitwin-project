import React, { useState, useEffect, useCallback, useRef } from 'react';
import CampusMap from '../components/Campus2D/CampusMap';
import BuildingDetailsDrawer from '../components/CampusUI/BuildingDetailsDrawer';
import RoomInfoPanel from '../components/CampusUI/RoomInfoPanel';
import CampusAnalyticsModal from '../components/CampusUI/CampusAnalyticsModal';
import { getCampusLogicalAnalytics, getLogicalBuildings, formatBuildingCode } from '../data/buildingRegistry';
import styles from './Campus.module.css';

export default function Campus() {
  const mapRef = useRef(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [hoveredBuilding, setHoveredBuilding] = useState(null);
  const [inspectingBuildingId, setInspectingBuildingId] = useState(null);
  const [inspectingRoomNumber, setInspectingRoomNumber] = useState(null);
  const [inspectingBlock, setInspectingBlock] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [analytics, setAnalytics] = useState(() => getCampusLogicalAnalytics());
  const hoverLeaveTimerRef = useRef(null);

  const handleSelectBuilding = useCallback((building) => {
    setSelectedBuilding(building);
    if (!building) {
      setIsDrawerOpen(false);
    }
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
  }, []);

  const handleInspectBuilding = useCallback((building) => {
    setSelectedBuilding(building);
    setIsDrawerOpen(true);
  }, []);

  const handleClosePreview = useCallback(() => {
    setSelectedBuilding(null);
    setIsDrawerOpen(false);
    setHoveredBuilding(null);
    mapRef.current?.clearHover?.();
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
    setHoveredBuilding(null);
    mapRef.current?.clearHover?.();
  }, []);

  const handleDrawerMouseLeave = useCallback(() => {
    if (!selectedBuilding) {
      setHoveredBuilding(null);
    }
  }, [selectedBuilding]);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
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

  // Deep-link building selection from Command Palette or URL hash
  useEffect(() => {
    const BLD_TO_CODE = {
      BLD001: 'B02',
      BLD002: 'B10',
      BLD003: 'B06',
      BLD004: 'B04',
      BLD005: 'B17',
      BLD006: 'B18',
      BLD007: 'B07',
      BLD008: 'B19',
      BLD009: 'B20',
      BLD010: 'B08',
    };

    const syncBuildingFromExternal = () => {
      try {
        let bId = sessionStorage.getItem('unitwin_campus_selected_building');
        if (!bId && window.location.hash.includes('building=')) {
          const match = window.location.hash.match(/building=([^&]+)/);
          if (match) bId = decodeURIComponent(match[1]);
        }
        if (bId) {
          sessionStorage.removeItem('unitwin_campus_selected_building');
          const all = getLogicalBuildings();
          const mapped = BLD_TO_CODE[bId] || bId;
          const targetCode = formatBuildingCode(mapped);
          const found = all.find((b) => b.id === targetCode || b.id === mapped || b.id === bId);
          if (found) {
            setSelectedBuilding(found);
            setIsDrawerOpen(true);
          }
        }
      } catch (err) {
        // ignore
      }
    };

    syncBuildingFromExternal();
    window.addEventListener('hashchange', syncBuildingFromExternal);
    return () => window.removeEventListener('hashchange', syncBuildingFromExternal);
  }, []);

  const activeDisplayBuilding = isDrawerOpen ? selectedBuilding : null;
  const isHoverPreview = false;

  return (
    <div className={styles.page}>
      {/* Consolidated Campus Toolbar */}
      <div className={styles.topBar}>
        <div className={styles.buildingLabel}>
          <span className={styles.toolbarIcon}>🏛️</span>
          <h2 className={styles.blockName}>Campus Infrastructure Twin</h2>
          <span className={styles.toolbarDivider}>•</span>
          <span className={styles.blockSub}>Spatial Twin &amp; Analytics</span>
          <span className={styles.liveTag}>
            <span className={styles.liveDot} />
            {analytics.totalBuildings} Facilities
          </span>
        </div>

        {/* Synchronized status summary chips & analytics action */}
        <div className={styles.topChips}>
          <div className={styles.chipSegmentGroup}>
            <button
              className={`${styles.statusChipBtn} ${statusFilter === 'all' ? styles.chipBtnActive : ''}`}
              onClick={() => setStatusFilter('all')}
              title="Show all campus structures"
            >
              <span>Total</span>
              <span className={styles.chipCountBadge}>{analytics.totalBuildings}</span>
            </button>

            <button
              className={`${styles.statusChipBtn} ${statusFilter === 'operational' ? styles.chipBtnActive : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'operational' ? 'all' : 'operational')}
              title="Filter to operational facilities"
            >
              <span className={styles.chipDot} style={{ background: '#10b981' }} />
              <span>Oper</span>
              <span className={styles.chipCountBadge}>{analytics.statusCounts.operational}</span>
            </button>

            <button
              className={`${styles.statusChipBtn} ${statusFilter === 'maintenance' ? styles.chipBtnActive : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'maintenance' ? 'all' : 'maintenance')}
              title="Filter to facilities under maintenance"
            >
              <span className={styles.chipDot} style={{ background: '#06b6d4' }} />
              <span>Maint</span>
              <span className={styles.chipCountBadge}>{analytics.statusCounts.maintenance}</span>
            </button>

            <button
              className={`${styles.statusChipBtn} ${statusFilter === 'warning' ? styles.chipBtnActive : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'warning' ? 'all' : 'warning')}
              title="Filter to facilities with warnings"
            >
              <span className={styles.chipDot} style={{ background: '#f59e0b' }} />
              <span>Warn</span>
              <span className={styles.chipCountBadge}>{analytics.statusCounts.warning}</span>
            </button>

            <button
              className={`${styles.statusChipBtn} ${statusFilter === 'critical' ? styles.chipBtnActive : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'critical' ? 'all' : 'critical')}
              title="Filter to critical facilities"
            >
              <span className={styles.chipDot} style={{ background: '#ef4444' }} />
              <span>Crit</span>
              <span className={styles.chipCountBadge}>{analytics.statusCounts.critical}</span>
            </button>

            <button
              className={`${styles.statusChipBtn} ${statusFilter === 'unknown' ? styles.chipBtnActive : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'unknown' ? 'all' : 'unknown')}
              title="Filter to unverified / standby facilities"
            >
              <span className={styles.chipDot} style={{ background: '#94a3b8' }} />
              <span>Unk</span>
              <span className={styles.chipCountBadge}>{analytics.statusCounts.unknown}</span>
            </button>
          </div>

          <button
            className={styles.analyticsTriggerBtn}
            onClick={() => setIsAnalyticsModalOpen(true)}
            title="Open comprehensive building register and type breakdown"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span>Register &amp; Analytics</span>
          </button>
        </div>
      </div>

      {/* Main content: Dedicated 2D Campus Map with HUD & Docked Details Drawer */}
      <div className={styles.content}>
        <div className={styles.mapContainer}>
          <CampusMap
            ref={mapRef}
            interactive={true}
            selectedBuilding={selectedBuilding}
            selectedBuildingId={selectedBuilding ? selectedBuilding.id : null}
            onSelectBuilding={handleSelectBuilding}
            onInspectBuilding={handleInspectBuilding}
            onClosePreview={handleClosePreview}
            onHoverBuilding={handleHoverBuilding}
            onBuildingsLoaded={handleBuildingsLoaded}
            externalStatusFilter={statusFilter}
          />

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
                    Academic Building 1 (Block {inspectingBlock || (inspectingRoomNumber ? inspectingRoomNumber.charAt(0).toUpperCase() : 'C')}) — Room &amp; Timetable Digital Twin
                  </span>
                </div>
                <button
                  onClick={() => {
                    setInspectingBuildingId(null);
                    setInspectingRoomNumber(null);
                    setInspectingBlock(null);
                  }}
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
                  block={inspectingBlock}
                  selectedRoomNumber={inspectingRoomNumber}
                  onSelectRoom={(rNum) => setInspectingRoomNumber(rNum)}
                  onClose={() => {
                    setInspectingBuildingId(null);
                    setInspectingRoomNumber(null);
                    setInspectingBlock(null);
                  }}
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

        {/* Building Details Drawer (Docked side panel fitting viewport height) */}
        {activeDisplayBuilding && !inspectingBuildingId && (
          <div className={styles.detailsPanelWrapper}>
            <BuildingDetailsDrawer
              building={activeDisplayBuilding}
              isHoverPreview={isHoverPreview}
              onPinBuilding={(b) => setSelectedBuilding(b)}
              onClose={handleCloseDrawer}
              onFocusOnMap={(b) => mapRef.current?.focusBuilding(b)}
              onBuildingUpdated={handleBuildingUpdated}
              onOpenRoomInspector={(bldId, rNum, blk) => {
                setInspectingBuildingId(bldId);
                setInspectingRoomNumber(rNum || null);
                setInspectingBlock(blk || (rNum ? rNum.charAt(0).toUpperCase() : null));
              }}
              onMouseEnter={handleDrawerMouseEnter}
              onMouseLeave={handleDrawerMouseLeave}
            />
          </div>
        )}
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

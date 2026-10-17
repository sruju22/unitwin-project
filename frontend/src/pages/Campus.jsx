import React, { useState, useEffect, useCallback, useRef } from 'react';
import CampusMap from '../components/Campus2D/CampusMap';
import BuildingDetailsDrawer from '../components/CampusUI/BuildingDetailsDrawer';
import RoomInfoPanel from '../components/CampusUI/RoomInfoPanel';
import CampusAnalyticsModal from '../components/CampusUI/CampusAnalyticsModal';
import { getCampusLogicalAnalytics, getLogicalBuildings, formatBuildingCode } from '../data/buildingRegistry';
import styles from './Campus.module.css';

export default function Campus({ reportingDate = '2026-10-14' }) {
  const mapRef = useRef(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [hoveredBuilding, setHoveredBuilding] = useState(null);
  const [inspectingBuildingId, setInspectingBuildingId] = useState(null);
  const [inspectingRoomNumber, setInspectingRoomNumber] = useState(null);
  const [inspectingBlock, setInspectingBlock] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [analytics, setAnalytics] = useState(() => getCampusLogicalAnalytics());
  const hoverLeaveTimerRef = useRef(null);
  const filterMenuRef = useRef(null);

  // Close filter popover on outside mousedown or Escape
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
        setIsFilterPopoverOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsFilterPopoverOpen(false);
      }
    };
    if (isFilterPopoverOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterPopoverOpen]);

  const handleSelectBuilding = useCallback((buildingOrId) => {
    if (!buildingOrId) {
      setSelectedBuilding(null);
      setIsDrawerOpen(false);
      return;
    }
    let resolved = null;
    if (typeof buildingOrId === 'string') {
      const all = getLogicalBuildings();
      resolved = all.find((b) => b.id === buildingOrId || b.buildingId === buildingOrId || b.code === buildingOrId) || null;
    } else if (buildingOrId && typeof buildingOrId === 'object') {
      resolved = buildingOrId;
    }
    setSelectedBuilding(resolved);
    if (resolved) {
      setIsDrawerOpen(true);
      setHoveredBuilding(null);
      mapRef.current?.clearHover?.();
    } else {
      setIsDrawerOpen(false);
    }
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
  }, []);

  const handleClosePreview = useCallback(() => {
    setSelectedBuilding(null);
    setIsDrawerOpen(false);
    setHoveredBuilding(null);
    mapRef.current?.clearHover?.();
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedBuilding(null);
    setHoveredBuilding(null);
    mapRef.current?.clearHover?.();
  }, []);

  // Close drawer or room inspector on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (inspectingBuildingId) {
          if (inspectingRoomNumber) {
            setInspectingRoomNumber(null);
          } else {
            setInspectingBuildingId(null);
            setInspectingRoomNumber(null);
            setInspectingBlock(null);
          }
          return;
        }
        if (isDrawerOpen) {
          handleCloseDrawer();
        }
      }
    };
    if (isDrawerOpen || inspectingBuildingId) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, inspectingBuildingId, inspectingRoomNumber, handleCloseDrawer]);

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
      BLD005: 'B18',
      BLD006: 'B19',
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
      } catch {
        // ignore
      }
    };

    syncBuildingFromExternal();
    window.addEventListener('hashchange', syncBuildingFromExternal);
    return () => window.removeEventListener('hashchange', syncBuildingFromExternal);
  }, []);

  const activeDisplayBuilding = isDrawerOpen ? selectedBuilding : null;

  return (
    <div className={styles.page}>
      {/* Consolidated Campus Toolbar (Reduced Height, Single Status Summary & Filter Control) */}
      <div className={styles.topBar}>
        <div className={styles.leftSection}>
          <div className={styles.buildingLabel}>
            <span className={styles.toolbarIcon}>🏛️</span>
            <h2 className={styles.blockName}>Campus Infrastructure Twin</h2>
            <span className={styles.toolbarDivider}>•</span>
            <span className={styles.blockSub}>Spatial Twin &amp; Analytics</span>
          </div>
        </div>

        <div className={styles.rightSection}>
          {/* 1. Single Compact Status Summary */}
          <div className={styles.statusSummaryBar} role="status" aria-label="Campus Building Status Summary">
            <button
              type="button"
              className={`${styles.statusSummaryItem} ${statusFilter === 'all' ? styles.summaryItemActive : ''}`}
              onClick={() => setStatusFilter('all')}
              title="All campus facilities"
            >
              <span className={styles.summaryLabel}>Total</span>
              <span className={styles.summaryBadge}>{analytics.totalBuildings}</span>
            </button>
            <span className={styles.summaryDivider}>•</span>
            <button
              type="button"
              className={`${styles.statusSummaryItem} ${statusFilter === 'operational' ? styles.summaryItemActive : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'operational' ? 'all' : 'operational')}
              title={`${analytics.statusCounts.operational} Operational facilities`}
            >
              <span className={styles.summaryDot} style={{ background: '#10b981' }} />
              <span className={styles.summaryLabel}>Oper</span>
              <span className={styles.summaryVal}>{analytics.statusCounts.operational}</span>
            </button>
            <button
              type="button"
              className={`${styles.statusSummaryItem} ${statusFilter === 'maintenance' ? styles.summaryItemActive : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'maintenance' ? 'all' : 'maintenance')}
              title={`${analytics.statusCounts.maintenance} Facilities under maintenance`}
            >
              <span className={styles.summaryDot} style={{ background: '#06b6d4' }} />
              <span className={styles.summaryLabel}>Maint</span>
              <span className={styles.summaryVal}>{analytics.statusCounts.maintenance}</span>
            </button>
            <button
              type="button"
              className={`${styles.statusSummaryItem} ${statusFilter === 'warning' ? styles.summaryItemActive : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'warning' ? 'all' : 'warning')}
              title={`${analytics.statusCounts.warning} Facilities with warnings`}
            >
              <span className={styles.summaryDot} style={{ background: '#f59e0b' }} />
              <span className={styles.summaryLabel}>Warn</span>
              <span className={styles.summaryVal}>{analytics.statusCounts.warning}</span>
            </button>
            <button
              type="button"
              className={`${styles.statusSummaryItem} ${statusFilter === 'critical' ? styles.summaryItemActive : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'critical' ? 'all' : 'critical')}
              title={`${analytics.statusCounts.critical} Critical facilities`}
            >
              <span className={styles.summaryDot} style={{ background: '#ef4444' }} />
              <span className={styles.summaryLabel}>Crit</span>
              <span className={styles.summaryVal}>{analytics.statusCounts.critical}</span>
            </button>
            <button
              type="button"
              className={`${styles.statusSummaryItem} ${statusFilter === 'unknown' ? styles.summaryItemActive : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'unknown' ? 'all' : 'unknown')}
              title={`${analytics.statusCounts.unknown} Facilities with status unavailable / unverified telemetry`}
            >
              <span className={styles.summaryDot} style={{ background: '#94a3b8' }} />
              <span className={styles.summaryLabel}>Unavailable</span>
              <span className={styles.summaryVal}>{analytics.statusCounts.unknown}</span>
            </button>
          </div>

          {/* 2. Unified Filters Control Button with Popover */}
          <div className={styles.filterControlWrapper} ref={filterMenuRef}>
            <button
              type="button"
              className={`${styles.filterBtn} ${statusFilter !== 'all' ? styles.filterBtnActive : ''}`}
              onClick={() => setIsFilterPopoverOpen((prev) => !prev)}
              title="Filter campus buildings by operational status"
              aria-haspopup="true"
              aria-expanded={isFilterPopoverOpen}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <span>
                {statusFilter === 'all'
                  ? 'Filters'
                  : `Filter: ${statusFilter === 'unknown' ? 'Unavailable' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`}
              </span>
              {statusFilter !== 'all' && (
                <span
                  className={styles.filterActiveDot}
                  style={{
                    background:
                      statusFilter === 'operational'
                        ? '#10b981'
                        : statusFilter === 'maintenance'
                        ? '#06b6d4'
                        : statusFilter === 'warning'
                        ? '#f59e0b'
                        : statusFilter === 'critical'
                        ? '#ef4444'
                        : '#94a3b8',
                  }}
                />
              )}
              <svg className={`${styles.filterCaret} ${isFilterPopoverOpen ? styles.caretOpen : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isFilterPopoverOpen && (
              <div className={styles.filterPopover} role="menu">
                <div className={styles.popoverHeader}>
                  <span className={styles.popoverTitle}>Building Status Filters</span>
                  {statusFilter !== 'all' && (
                    <button
                      type="button"
                      className={styles.popoverResetTextBtn}
                      onClick={() => {
                        setStatusFilter('all');
                        setIsFilterPopoverOpen(false);
                      }}
                    >
                      Reset to All
                    </button>
                  )}
                </div>

                <div className={styles.popoverList}>
                  <button
                    type="button"
                    className={`${styles.popoverItem} ${statusFilter === 'all' ? styles.popoverItemActive : ''}`}
                    onClick={() => {
                      setStatusFilter('all');
                      setIsFilterPopoverOpen(false);
                    }}
                  >
                    <div className={styles.popoverItemLeft}>
                      <span className={styles.popoverItemIcon}>🏢</span>
                      <span className={styles.popoverItemLabel}>All Buildings</span>
                    </div>
                    <span className={styles.popoverCountBadge}>{analytics.totalBuildings}</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.popoverItem} ${statusFilter === 'operational' ? styles.popoverItemActive : ''}`}
                    onClick={() => {
                      setStatusFilter('operational');
                      setIsFilterPopoverOpen(false);
                    }}
                  >
                    <div className={styles.popoverItemLeft}>
                      <span className={styles.popoverDot} style={{ background: '#10b981' }} />
                      <span className={styles.popoverItemLabel}>Operational</span>
                    </div>
                    <span className={styles.popoverCountBadge}>{analytics.statusCounts.operational}</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.popoverItem} ${statusFilter === 'maintenance' ? styles.popoverItemActive : ''}`}
                    onClick={() => {
                      setStatusFilter('maintenance');
                      setIsFilterPopoverOpen(false);
                    }}
                  >
                    <div className={styles.popoverItemLeft}>
                      <span className={styles.popoverDot} style={{ background: '#06b6d4' }} />
                      <span className={styles.popoverItemLabel}>Maintenance</span>
                    </div>
                    <span className={styles.popoverCountBadge}>{analytics.statusCounts.maintenance}</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.popoverItem} ${statusFilter === 'warning' ? styles.popoverItemActive : ''}`}
                    onClick={() => {
                      setStatusFilter('warning');
                      setIsFilterPopoverOpen(false);
                    }}
                  >
                    <div className={styles.popoverItemLeft}>
                      <span className={styles.popoverDot} style={{ background: '#f59e0b' }} />
                      <span className={styles.popoverItemLabel}>Warning</span>
                    </div>
                    <span className={styles.popoverCountBadge}>{analytics.statusCounts.warning}</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.popoverItem} ${statusFilter === 'critical' ? styles.popoverItemActive : ''}`}
                    onClick={() => {
                      setStatusFilter('critical');
                      setIsFilterPopoverOpen(false);
                    }}
                  >
                    <div className={styles.popoverItemLeft}>
                      <span className={styles.popoverDot} style={{ background: '#ef4444' }} />
                      <span className={styles.popoverItemLabel}>Critical</span>
                    </div>
                    <span className={styles.popoverCountBadge}>{analytics.statusCounts.critical}</span>
                  </button>

                  <div className={styles.popoverDivider} />

                  <button
                    type="button"
                    className={`${styles.popoverItem} ${statusFilter === 'unknown' ? styles.popoverItemActive : ''}`}
                    onClick={() => {
                      setStatusFilter('unknown');
                      setIsFilterPopoverOpen(false);
                    }}
                  >
                    <div className={styles.popoverItemLeft}>
                      <span className={styles.popoverDot} style={{ background: '#94a3b8' }} />
                      <div>
                        <div className={styles.popoverItemLabel}>Status Unavailable</div>
                        <div className={styles.popoverItemSub}>Cadastral / unverified telemetry</div>
                      </div>
                    </div>
                    <span className={styles.popoverCountBadge}>{analytics.statusCounts.unknown}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. Register & Analytics Action */}
          <button
            type="button"
            className={styles.analyticsTriggerBtn}
            onClick={() => setIsAnalyticsModalOpen(true)}
            title="Open comprehensive building register and type breakdown"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
            onClosePreview={handleClosePreview}
            onHoverBuilding={handleHoverBuilding}
            onBuildingsLoaded={handleBuildingsLoaded}
            externalStatusFilter={statusFilter}
            onOpenRoomInspector={(bldId, rNum, blk) => {
              setInspectingBuildingId(bldId);
              setInspectingRoomNumber(rNum || null);
              setInspectingBlock(blk || (rNum ? rNum.charAt(0).toUpperCase() : null));
            }}
          />

          {/* Room-Level Digital Twin Modal */}
          {inspectingBuildingId && (
            <div
              style={{
                position: 'absolute',
                inset: '1.25rem',
                zIndex: 65,
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(28px) saturate(190%)',
                WebkitBackdropFilter: 'blur(28px) saturate(190%)',
                borderRadius: '16px',
                border: '1px solid rgba(226, 232, 240, 0.95)',
                boxShadow: '0 20px 50px -10px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(255, 255, 255, 0.8)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
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
          )}

        </div>

        {/* Building Details Drawer (Docked side panel fitting viewport height) */}
        {activeDisplayBuilding && !inspectingBuildingId && (
          <div className={styles.detailsPanelWrapper}>
            <BuildingDetailsDrawer
              building={activeDisplayBuilding}
              reportingDate={reportingDate}
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

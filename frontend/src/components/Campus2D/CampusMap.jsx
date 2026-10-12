import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { getLogicalBuildings, getBuildingByAnnotationId } from '../../data/buildingRegistry';
import styles from './CampusMap.module.css';

const IMG_WIDTH = 1280;
const IMG_HEIGHT = 851;

const STATUS_META = {
  operational: { label: 'Operational', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  maintenance: { label: 'Maintenance', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
  warning:     { label: 'Warning',     color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  critical:    { label: 'Critical',    color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  unknown:     { label: 'Unknown',     color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' },
};

export default function CampusMap({
  interactive = true,
  selectedBuildingId = null,
  onSelectBuilding = null,
  onHoverBuilding = null,
  onBuildingsLoaded = null,
  externalStatusFilter = 'all',
}) {
  const viewportRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const isDragging = useRef(false);
  const dragStartPointer = useRef({ x: 0, y: 0 });
  const didDragMove = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Logical building data & interaction states
  const [buildings, setBuildings] = useState([]);
  const [hoveredBuilding, setHoveredBuilding] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [showLabels, setShowLabels] = useState(true);
  const [isDroneFlightPlaying, setIsDroneFlightPlaying] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Synchronize external status filter (e.g. from Dashboard status card click)
  useEffect(() => {
    if (externalStatusFilter && externalStatusFilter !== statusFilter) {
      setStatusFilter(externalStatusFilter);
    }
  }, [externalStatusFilter]);

  // 1. Load logical building registry
  const refreshRegistry = useCallback(() => {
    const list = getLogicalBuildings();
    setBuildings(list);
    if (onBuildingsLoaded) onBuildingsLoaded(list);
  }, [onBuildingsLoaded]);

  useEffect(() => {
    refreshRegistry();
  }, [refreshRegistry]);

  // 2. Measure viewport dimensions dynamically
  useEffect(() => {
    if (!viewportRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setViewportSize({ width, height });
        }
      }
    });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  // 3. Constraints helper: clamp image within viewport bounds
  const applyConstraints = useCallback((newX, newY, newScale, vWidth, vHeight) => {
    const fitScale = Math.min(vWidth / IMG_WIDTH, vHeight / IMG_HEIGHT);
    const minScale = fitScale;
    const maxScale = 6.0;

    const clampedScale = Math.max(minScale, Math.min(newScale, maxScale));
    const currentW = IMG_WIDTH * clampedScale;
    const currentH = IMG_HEIGHT * clampedScale;

    let finalX;
    if (currentW <= vWidth) {
      finalX = (vWidth - currentW) / 2;
    } else {
      const minX = vWidth - currentW;
      const maxX = 0;
      finalX = Math.max(minX, Math.min(newX, maxX));
    }

    let finalY;
    if (currentH <= vHeight) {
      finalY = (vHeight - currentH) / 2;
    } else {
      const minY = vHeight - currentH;
      const maxY = 0;
      finalY = Math.max(minY, Math.min(newY, maxY));
    }

    return { x: finalX, y: finalY, scale: clampedScale };
  }, []);

  // 4. Initial fit on mount
  const fitToScreen = useCallback(() => {
    if (viewportSize.width === 0 || viewportSize.height === 0) return;
    const fitScale = Math.min(viewportSize.width / IMG_WIDTH, viewportSize.height / IMG_HEIGHT);
    const cx = (viewportSize.width - IMG_WIDTH * fitScale) / 2;
    const cy = (viewportSize.height - IMG_HEIGHT * fitScale) / 2;
    setTransform({ x: cx, y: cy, scale: fitScale });
  }, [viewportSize]);

  useEffect(() => {
    if (viewportSize.width === 0 || viewportSize.height === 0) return;
    if (!isInitialized) {
      fitToScreen();
      setIsInitialized(true);
    } else {
      setTransform((prev) =>
        applyConstraints(prev.x, prev.y, prev.scale, viewportSize.width, viewportSize.height)
      );
    }
  }, [viewportSize, isInitialized, fitToScreen, applyConstraints]);

  // 5. Mouse Wheel Zoom centered at cursor
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e) => {
      if (!interactive) return;
      e.preventDefault();

      setTransform((prev) => {
        const zoomSensitivity = 0.0018;
        const delta = -e.deltaY * zoomSensitivity;
        const targetScale = prev.scale * Math.exp(delta);

        const rect = viewport.getBoundingClientRect();
        const pointerX = e.clientX - rect.left;
        const pointerY = e.clientY - rect.top;

        const fitScale = Math.min(viewportSize.width / IMG_WIDTH, viewportSize.height / IMG_HEIGHT);
        const clampedScale = Math.max(fitScale, Math.min(targetScale, 6.0));

        const x = pointerX - (pointerX - prev.x) * (clampedScale / prev.scale);
        const y = pointerY - (pointerY - prev.y) * (clampedScale / prev.scale);

        return applyConstraints(x, y, clampedScale, viewportSize.width, viewportSize.height);
      });
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [interactive, viewportSize, applyConstraints]);

  // 6. Pointer Panning handlers
  const handlePointerDown = (e) => {
    if (!interactive || e.button !== 0) return;
    isDragging.current = true;
    didDragMove.current = false;
    dragStartPointer.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStartPointer.current.x;
    const dy = e.clientY - dragStartPointer.current.y;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      didDragMove.current = true;
    }

    dragStartPointer.current = { x: e.clientX, y: e.clientY };

    setTransform((prev) =>
      applyConstraints(prev.x + dx, prev.y + dy, prev.scale, viewportSize.width, viewportSize.height)
    );
  };

  const handlePointerUp = (e) => {
    isDragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // 7. Zoom Buttons
  const handleZoomIn = () => {
    setTransform((prev) => {
      const targetScale = prev.scale * 1.35;
      const cx = viewportSize.width / 2;
      const cy = viewportSize.height / 2;
      const x = cx - (cx - prev.x) * (targetScale / prev.scale);
      const y = cy - (cy - prev.y) * (targetScale / prev.scale);
      return applyConstraints(x, y, targetScale, viewportSize.width, viewportSize.height);
    });
  };

  const handleZoomOut = () => {
    setTransform((prev) => {
      const targetScale = prev.scale / 1.35;
      const cx = viewportSize.width / 2;
      const cy = viewportSize.height / 2;
      const x = cx - (cx - prev.x) * (targetScale / prev.scale);
      const y = cy - (cy - prev.y) * (targetScale / prev.scale);
      return applyConstraints(x, y, targetScale, viewportSize.width, viewportSize.height);
    });
  };

  // 8. Focus smoothly on a specific logical building
  const focusBuilding = useCallback(
    (building) => {
      if (!building || !viewportRef.current) return;
      const { centroid } = building;
      const targetScale = 2.4;
      const cx = viewportSize.width / 2;
      const cy = viewportSize.height / 2;
      const targetX = cx - centroid.x * targetScale;
      const targetY = cy - centroid.y * targetScale;

      const constrained = applyConstraints(
        targetX,
        targetY,
        targetScale,
        viewportSize.width,
        viewportSize.height
      );
      setTransform(constrained);
    },
    [viewportSize, applyConstraints]
  );

  // 9. Flatten all polygon geometries while tracking parent logical building
  const flatPolygons = useMemo(() => {
    const list = [];
    buildings.forEach((b) => {
      (b.geometries || []).forEach((geom) => {
        list.push({
          annotationId: geom.annotationId,
          pointsString: geom.pointsString,
          centroid: geom.centroid,
          area: geom.area,
          parentBuilding: b,
        });
      });
    });
    return list;
  }, [buildings]);

  // 10. Multi-polygon Hover & Click events
  const handlePolygonPointerEnter = (building, e) => {
    setHoveredBuilding(building);
    updateTooltipCoordinates(e);
    if (onHoverBuilding) {
      onHoverBuilding(building);
    }
  };

  const handlePolygonPointerMove = (e) => {
    updateTooltipCoordinates(e);
  };

  const handlePolygonPointerLeave = () => {
    setHoveredBuilding(null);
    if (onHoverBuilding) {
      onHoverBuilding(null);
    }
  };

  const updateTooltipCoordinates = (e) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clampedX = Math.max(130, Math.min(x, rect.width - 130));
    const clampedY = Math.max(80, Math.min(y, rect.height - 20));
    setTooltipPos({ x: clampedX, y: clampedY });
  };

  const handlePolygonClick = (building, e) => {
    e.stopPropagation();
    if (didDragMove.current) return;
    if (onSelectBuilding) {
      onSelectBuilding(building);
    }
  };

  // 11. Filtering and search matching on LOGICAL BUILDINGS
  const filteredLogicalBuildings = useMemo(() => {
    return buildings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = b.id.toLowerCase().includes(q);
        const matchesName = b.name.toLowerCase().includes(q);
        const matchesType = b.type.toLowerCase().includes(q);
        const matchesLocation = (b.location || '').toLowerCase().includes(q);
        const matchesDesc = (b.description || '').toLowerCase().includes(q);
        return matchesId || matchesName || matchesType || matchesLocation || matchesDesc;
      }
      return true;
    });
  }, [buildings, statusFilter, searchQuery]);

  // Search auto-suggest candidates
  const searchCandidates = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return buildings.filter((b) => {
      return (
        b.id.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q) ||
        b.type.toLowerCase().includes(q) ||
        (b.location || '').toLowerCase().includes(q)
      );
    });
  }, [buildings, searchQuery]);

  // Polygon styling logic: Invisible by default, luminous only on hover or selection
  const getPolygonClass = (polygonItem) => {
    const parent = polygonItem.parentBuilding;
    const isSelected = selectedBuildingId === parent.id;
    const isHovered = hoveredBuilding && hoveredBuilding.id === parent.id;
    const isDimmed = !filteredLogicalBuildings.some((f) => f.id === parent.id);

    const classes = [styles.polygon];

    if (isSelected) {
      classes.push(styles.polygonSelected);
    } else if (isHovered) {
      classes.push(styles.polygonHovered);
      if (parent.status === 'critical') classes.push(styles.hoverCritical);
      else if (parent.status === 'warning') classes.push(styles.hoverWarning);
      else if (parent.status === 'maintenance') classes.push(styles.hoverMaintenance);
      else if (parent.status === 'operational') classes.push(styles.hoverOperational);
      else classes.push(styles.hoverUnknown);
    }

    if (isDimmed) {
      classes.push(styles.polygonDimmed);
    }

    return classes.join(' ');
  };

  return (
    <div
      className={styles.viewport}
      ref={viewportRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={() => {
        if (didDragMove.current) return;
        if (onSelectBuilding) onSelectBuilding(null);
        if (onHoverBuilding) onHoverBuilding(null);
      }}
      style={{ visibility: isInitialized ? 'visible' : 'hidden' }}
    >
      {/* Optical lens vignette */}
      <div className={styles.lensVignette} aria-hidden="true" />

      {/* Main Map Content Layer */}
      <div
        className={styles.mapContent}
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        }}
      >
        <div
          className={`${styles.droneCamera} ${
            isDroneFlightPlaying && !hoveredBuilding && !selectedBuildingId
              ? styles.droneFlightActive
              : ''
          }`}
        >
          {/* Satellite Orthophoto Asset */}
          <img
            src="/satellite.jpg"
            alt="Campus Satellite Orthophoto"
            className={styles.satelliteImage}
            width={IMG_WIDTH}
            height={IMG_HEIGHT}
            onError={(e) => {
              if (!e.target.src.endsWith('satellite.png')) {
                e.target.src = '/satellite.png';
              }
            }}
          />

          {/* SVG Vector Layer with multi-polygon highlight support */}
          <svg
            viewBox={`0 0 ${IMG_WIDTH} ${IMG_HEIGHT}`}
            className={styles.svgOverlay}
            preserveAspectRatio="none"
          >
            <g id="campus-polygons">
              {flatPolygons.map((poly) => (
                <polygon
                  key={`ann-${poly.annotationId}`}
                  id={`polygon-ann-${poly.annotationId}`}
                  points={poly.pointsString}
                  className={getPolygonClass(poly)}
                  onPointerEnter={(e) => handlePolygonPointerEnter(poly.parentBuilding, e)}
                  onPointerMove={handlePolygonPointerMove}
                  onPointerLeave={handlePolygonPointerLeave}
                  onClick={(e) => handlePolygonClick(poly.parentBuilding, e)}
                  tabIndex={0}
                  aria-label={poly.parentBuilding.name}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handlePolygonClick(poly.parentBuilding, e);
                    }
                  }}
                />
              ))}
            </g>
          </svg>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredBuilding && (
        <div
          className={styles.hoverTooltip}
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
          }}
          aria-hidden="true"
        >
          <div className={styles.tooltipHeader}>
            <span className={styles.tooltipTypeBadge}>{hoveredBuilding.type}</span>
            <span
              className={styles.tooltipStatusBadge}
              style={{
                color: (STATUS_META[hoveredBuilding.status] || STATUS_META.unknown).color,
                background: (STATUS_META[hoveredBuilding.status] || STATUS_META.unknown).bg,
                border: `1px solid ${(STATUS_META[hoveredBuilding.status] || STATUS_META.unknown).color}40`,
              }}
            >
              {(STATUS_META[hoveredBuilding.status] || STATUS_META.unknown).label}
            </span>
          </div>

          <div className={styles.tooltipTitle}>{hoveredBuilding.name}</div>

          <div className={styles.tooltipMetaRow}>
            <span>📍 {hoveredBuilding.location}</span>
          </div>

          <div className={styles.tooltipFooter}>
            <span>Click to inspect facility →</span>
          </div>
        </div>
      )}

      {/* Map Floating UI Toolbar: Search & Filters */}
      <div className={styles.mapToolbar} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchContainer}>
          <svg
            className={styles.searchIcon}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={styles.searchBar}
            placeholder="Search campus buildings by name, type, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 220)}
          />
          {searchQuery && (
            <button
              className={styles.clearSearchBtn}
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              &times;
            </button>
          )}

          {/* Search Dropdown Results */}
          {isSearchFocused && searchQuery.trim() && (
            <div className={styles.searchDropdown}>
              {searchCandidates.length > 0 ? (
                searchCandidates.map((cand) => (
                  <div
                    key={cand.id}
                    className={styles.searchDropdownItem}
                    onMouseDown={() => {
                      focusBuilding(cand);
                      if (onSelectBuilding) onSelectBuilding(cand);
                      setSearchQuery('');
                    }}
                  >
                    <div className={styles.searchItemLeft}>
                      <div>
                        <div className={styles.searchItemTitle}>{cand.name}</div>
                        <div className={styles.searchItemSub}>
                          <span>{cand.type}</span>
                          <span>•</span>
                          <span>{cand.location}</span>
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        color: (STATUS_META[cand.status] || STATUS_META.unknown).color,
                        background: (STATUS_META[cand.status] || STATUS_META.unknown).bg,
                      }}
                    >
                      {(STATUS_META[cand.status] || STATUS_META.unknown).label}
                    </span>
                  </div>
                ))
              ) : (
                <div className={styles.searchNoResults}>No buildings matching "{searchQuery}"</div>
              )}
            </div>
          )}
        </div>

        {/* Operational Status Filter Chips */}
        <div className={styles.filterRow}>
          <button
            className={`${styles.filterChip} ${statusFilter === 'all' ? styles.filterChipActive : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Buildings ({buildings.length})
          </button>
          <button
            className={`${styles.filterChip} ${statusFilter === 'operational' ? styles.filterChipActive : ''}`}
            onClick={() => setStatusFilter('operational')}
          >
            <span className={styles.filterDot} style={{ background: '#10b981' }} />
            Operational ({buildings.filter((b) => b.status === 'operational').length})
          </button>
          <button
            className={`${styles.filterChip} ${statusFilter === 'maintenance' ? styles.filterChipActive : ''}`}
            onClick={() => setStatusFilter('maintenance')}
          >
            <span className={styles.filterDot} style={{ background: '#06b6d4' }} />
            Maintenance ({buildings.filter((b) => b.status === 'maintenance').length})
          </button>
          <button
            className={`${styles.filterChip} ${statusFilter === 'warning' ? styles.filterChipActive : ''}`}
            onClick={() => setStatusFilter('warning')}
          >
            <span className={styles.filterDot} style={{ background: '#f59e0b' }} />
            Warning ({buildings.filter((b) => b.status === 'warning').length})
          </button>
          <button
            className={`${styles.filterChip} ${statusFilter === 'critical' ? styles.filterChipActive : ''}`}
            onClick={() => setStatusFilter('critical')}
          >
            <span className={styles.filterDot} style={{ background: '#ef4444' }} />
            Critical ({buildings.filter((b) => b.status === 'critical').length})
          </button>
          <button
            className={`${styles.filterChip} ${statusFilter === 'unknown' ? styles.filterChipActive : ''}`}
            onClick={() => setStatusFilter('unknown')}
          >
            <span className={styles.filterDot} style={{ background: '#94a3b8' }} />
            Unknown ({buildings.filter((b) => b.status === 'unknown').length})
          </button>

          {statusFilter !== 'all' && (
            <button className={styles.clearFilterBtn} onClick={() => setStatusFilter('all')}>
              Clear Filter &times;
            </button>
          )}
        </div>
      </div>

      {/* Floating Bottom Left Navigation Controls */}
      <div className={styles.bottomControls} onClick={(e) => e.stopPropagation()}>
        <div className={styles.controlGroup}>
          <button onClick={handleZoomIn} className={styles.mapBtn} title="Zoom In (+)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button onClick={handleZoomOut} className={styles.mapBtn} title="Zoom Out (-)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <div className={styles.btnDivider} />
          <button onClick={fitToScreen} className={styles.mapBtn} title="Reset View / Fit Campus">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>

        <div className={styles.controlGroup}>
          <button
            onClick={() => setIsDroneFlightPlaying((prev) => !prev)}
            className={`${styles.mapBtn} ${isDroneFlightPlaying ? styles.mapBtnActive : ''}`}
            title={isDroneFlightPlaying ? 'Pause Drone Flight' : 'Resume Drone Flight'}
          >
            {isDroneFlightPlaying ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="4" width="4" height="16" rx="1" />
                <rect x="15" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
            )}
          </button>

          <div className={styles.btnDivider} />

          <button
            onClick={() => setShowLegend((prev) => !prev)}
            className={`${styles.mapBtn} ${showLegend ? styles.mapBtnActive : ''}`}
            title="Toggle Map Legend"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Map Legend Popover */}
      {showLegend && (
        <div className={styles.legendBox} onClick={(e) => e.stopPropagation()}>
          <div className={styles.legendTitle}>Operational Status Legend</div>
          <div className={styles.legendList}>
            <div className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  borderColor: '#10b981',
                }}
              />
              <span>Operational (Normal)</span>
            </div>
            <div className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{
                  background: 'rgba(6, 182, 212, 0.25)',
                  borderColor: '#06b6d4',
                  borderStyle: 'dashed',
                }}
              />
              <span>Under Maintenance</span>
            </div>
            <div className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{
                  background: 'rgba(245, 158, 11, 0.25)',
                  borderColor: '#f59e0b',
                }}
              />
              <span>Operational Warning</span>
            </div>
            <div className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{
                  background: 'rgba(239, 68, 68, 0.3)',
                  borderColor: '#ef4444',
                }}
              />
              <span>Critical Incident</span>
            </div>
            <div className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{
                  background: 'rgba(148, 163, 184, 0.15)',
                  borderColor: '#94a3b8',
                }}
              />
              <span>Unknown Status</span>
            </div>
            <div className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{
                  background: 'rgba(6, 182, 212, 0.4)',
                  borderColor: '#ffffff',
                }}
              />
              <span>Selected Building</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

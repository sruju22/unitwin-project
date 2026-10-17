import React, { useState, useRef, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { getLogicalBuildings } from '../../data/buildingRegistry';
import { searchCampus } from '../../api/client';
import styles from './CampusMap.module.css';

const IMG_WIDTH = 1280;
const IMG_HEIGHT = 851;

// Official mapping of BLD IDs to 2D spatial codes (B01-B21)
const BLD_TO_CODE = {
  BLD001: 'B02', // Main Building / Academic -> C & B-Block
  BLD002: 'B10', // Silver Jubilee Building -> S-Block
  BLD003: 'B06', // Library Building -> Library
  BLD004: 'B04', // Academic Block -> D-Block
  BLD005: 'B18', // Canteen Building -> DR AMBEDKAR COLLEGE CANTEEN (Polygon 18)
  BLD006: 'B19', // Boys Hostel 1 -> BOYS HOSTEL 1 (Polygon 19)
  BLD007: 'B07', // Girls Hostel Building -> Girls Hostel
  BLD008: 'B20', // Boys Hostel 2 -> BOYS HOSTEL 2 (Polygon 20)
  BLD009: 'B20', // Legacy alias -> B20
  BLD010: 'B08', // Indoor Sports Complex -> Sports
};

const STATUS_META = {
  operational: { label: 'Operational', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)' },
  maintenance: { label: 'Maintenance', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.35)' },
  warning:     { label: 'Warning',     color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)' },
  critical:    { label: 'Critical',    color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)' },
  unknown:     { label: 'Status unavailable', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.3)' },
};

const CampusMap = forwardRef(function CampusMap({
  interactive = true,
  selectedBuilding = null,
  selectedBuildingId = null,
  onSelectBuilding = null,
  onClosePreview = null,
  onHoverBuilding = null,
  onBuildingsLoaded = null,
  externalStatusFilter = 'all',
  onOpenRoomInspector = null,
}, ref) {
  const viewportRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const isDragging = useRef(false);
  const dragStartPointer = useRef({ x: 0, y: 0 });
  const didDragMove = useRef(false);
  const hoverLeaveTimerRef = useRef(null);
  const isPointerOnCardRef = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Logical building data & interaction states
  const [buildings] = useState(() => getLogicalBuildings());
  const [hoveredBuilding, setHoveredBuilding] = useState(null);
  const [isDroneFlightPlaying, setIsDroneFlightPlaying] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showGisInfo, setShowGisInfo] = useState(false);

  // Resolved selected building strictly from selection props
  const resolvedSelectedBuilding = useMemo(() => {
    if (selectedBuilding) return selectedBuilding;
    if (selectedBuildingId) {
      return buildings.find((b) => b.id === selectedBuildingId) || null;
    }
    return null;
  }, [selectedBuilding, selectedBuildingId, buildings]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const statusFilter = externalStatusFilter || 'all';
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [backendSearchResults, setBackendSearchResults] = useState(null);
  const [isBackendSearching, setIsBackendSearching] = useState(false);

  const searchRequestIdRef = useRef(0);
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Notify parent of loaded buildings if callback provided
  useEffect(() => {
    if (onBuildingsLoaded) {
      onBuildingsLoaded(buildings);
    }
  }, [onBuildingsLoaded, buildings]);

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

  // 3. Constraints helper: clamp image within viewport bounds using cover scale (no black borders)
  const applyConstraints = useCallback((newX, newY, newScale, vWidth, vHeight) => {
    if (!vWidth || !vHeight) return { x: 0, y: 0, scale: 1 };

    // coverScale ensures the satellite orthophoto completely fills the viewport in both axes without letterboxing
    const coverScale = Math.max(vWidth / IMG_WIDTH, vHeight / IMG_HEIGHT);
    const minScale = coverScale;
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

  // 4. Initial fit on mount - covers viewport with satellite image centered
  const fitToScreen = useCallback(() => {
    if (viewportSize.width === 0 || viewportSize.height === 0) return;
    const coverScale = Math.max(viewportSize.width / IMG_WIDTH, viewportSize.height / IMG_HEIGHT);
    const cx = (viewportSize.width - IMG_WIDTH * coverScale) / 2;
    const cy = (viewportSize.height - IMG_HEIGHT * coverScale) / 2;
    setTransform({ x: cx, y: cy, scale: coverScale });
  }, [viewportSize]);

  useEffect(() => {
    if (viewportSize.width === 0 || viewportSize.height === 0) return;
    if (!isInitialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

        const coverScale = Math.max(viewportSize.width / IMG_WIDTH, viewportSize.height / IMG_HEIGHT);
        const clampedScale = Math.max(coverScale, Math.min(targetScale, 6.0));

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
    // Don't initiate viewport panning/capturing on polygons or interactive overlay components
    if (
      e.target.tagName === 'polygon' ||
      e.target.closest('polygon') ||
      e.target.closest(`.${styles.hoverTooltip}`) ||
      e.target.closest(`.${styles.topControlBar}`) ||
      e.target.closest(`.${styles.mapControlSurface}`) ||
      e.target.closest(`.${styles.bottomControls}`) ||
      e.target.closest(`.${styles.legendBox}`) ||
      e.target.closest(`.${styles.gisInfoBox}`)
    ) {
      return;
    }
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
      if (!building || !viewportRef.current || viewportSize.width === 0 || viewportSize.height === 0) return;
      const { centroid } = building;
      if (!centroid || (centroid.x === 0 && centroid.y === 0)) return;

      const coverScale = Math.max(viewportSize.width / IMG_WIDTH, viewportSize.height / IMG_HEIGHT);
      const targetScale = Math.max(coverScale * 1.5, 2.2);
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

  // Expose imperative methods to parent components via ref
  useImperativeHandle(ref, () => ({
    focusBuilding,
    fitToScreen,
    clearHover: () => {
      if (hoverLeaveTimerRef.current) {
        clearTimeout(hoverLeaveTimerRef.current);
        hoverLeaveTimerRef.current = null;
      }
      setHoveredBuilding(null);
      if (onHoverBuilding) {
        onHoverBuilding(null);
      }
    },
  }), [focusBuilding, fitToScreen, onHoverBuilding]);

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

  // 10. Building Screen Coordinates & Hover Card Position Calculation (anchored strictly to hovered building)
  const previewCardData = useMemo(() => {
    if (!hoveredBuilding || !hoveredBuilding.centroid) return null;
    const { width: vWidth, height: vHeight } = viewportSize;
    if (vWidth === 0 || vHeight === 0) return null;

    // Real screen coordinates reflecting current pan and zoom
    const screenX = transform.x + hoveredBuilding.centroid.x * transform.scale;
    const screenY = transform.y + hoveredBuilding.centroid.y * transform.scale;

    // Avoid rendering card if building is scrolled far off-screen
    if (screenX < -150 || screenX > vWidth + 150 || screenY < -150 || screenY > vHeight + 150) {
      return null;
    }

    // Approximate building vertical visual radius on screen to keep card off roof
    let approxRadiusY = 24 * transform.scale;
    if (hoveredBuilding.geometries && hoveredBuilding.geometries.length > 0) {
      const maxH = Math.max(...hoveredBuilding.geometries.map((g) => g.bbox?.height || 40));
      approxRadiusY = (maxH / 2) * transform.scale;
    }
    const clampedRadiusY = Math.min(Math.max(approxRadiusY, 18), 90);

    const CARD_WIDTH = 290;
    const CARD_HEIGHT = 165;
    const MARGIN = 14;
    const POINTER_GAP = 10;

    // Docked details drawer on the right occupies 420px when a building is selected on desktop
    const drawerOffset = (resolvedSelectedBuilding && vWidth > 900) ? 420 : 0;
    const effectiveRight = vWidth - drawerOffset;

    // Center card horizontally on building screenX, clamped within viewport bounds and clear of drawer
    const minCardX = CARD_WIDTH / 2 + MARGIN;
    const maxCardX = Math.max(minCardX, effectiveRight - CARD_WIDTH / 2 - MARGIN);
    const cardX = Math.max(minCardX, Math.min(screenX, maxCardX));

    // Pointer offset relative to card center so arrow points directly to building
    const pointerOffset = screenX - cardX;
    const clampedPointerOffset = Math.max(-CARD_WIDTH / 2 + 22, Math.min(pointerOffset, CARD_WIDTH / 2 - 22));

    // Vertical placement: default ABOVE rooftop
    // Top control bar at top-left: if card is within left 430px, reserve 68px for search/filter bar
    const topReserved = (cardX - CARD_WIDTH / 2 < 430) ? 68 : 16;
    let placement = 'above';
    let cardY = screenY - clampedRadiusY - POINTER_GAP;

    // If card would clip past top edge of viewport (or top toolbar area)
    if (cardY - CARD_HEIGHT < topReserved) {
      placement = 'below';
      cardY = screenY + clampedRadiusY + POINTER_GAP;
    }

    // Clamp Y if placed below and near bottom
    if (placement === 'below' && cardY + CARD_HEIGHT > vHeight - MARGIN) {
      cardY = Math.max(topReserved, vHeight - CARD_HEIGHT - MARGIN);
    }

    return {
      x: Math.round(cardX),
      y: Math.round(cardY),
      placement,
      pointerOffset: Math.round(clampedPointerOffset),
    };
  }, [hoveredBuilding, transform, viewportSize, resolvedSelectedBuilding]);

  useEffect(() => {
    if (!hoveredBuilding) {
      isPointerOnCardRef.current = false;
    }
  }, [hoveredBuilding]);

  // Multi-polygon Hover & Click events
  const handlePolygonPointerEnter = (building) => {
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
    setHoveredBuilding(building);
    if (onHoverBuilding) {
      onHoverBuilding(building);
    }
  };

  const handlePolygonPointerLeave = () => {
    if (isPointerOnCardRef.current) return;

    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
    }
    // Grace period so moving pointer from building onto its hover card does not flicker or disappear
    hoverLeaveTimerRef.current = setTimeout(() => {
      if (!isPointerOnCardRef.current) {
        setHoveredBuilding(null);
        if (onHoverBuilding) {
          onHoverBuilding(null);
        }
      }
    }, 120);
  };

  const handleCardMouseEnter = () => {
    isPointerOnCardRef.current = true;
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
  };

  const handleCardMouseLeave = () => {
    isPointerOnCardRef.current = false;
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
    }
    hoverLeaveTimerRef.current = setTimeout(() => {
      setHoveredBuilding(null);
      if (onHoverBuilding) {
        onHoverBuilding(null);
      }
    }, 100);
  };

  const handlePolygonClick = (building, e) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    if (didDragMove.current) return;
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
    isPointerOnCardRef.current = false;
    setHoveredBuilding(null);
    if (onHoverBuilding) {
      onHoverBuilding(null);
    }
    if (onSelectBuilding) {
      onSelectBuilding(building);
    }
  };

  // Debounced real-time search (200ms) across backend rooms, labs, and areas
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBackendSearchResults(null);
      setIsBackendSearching(false);
      return;
    }

    setIsBackendSearching(true);
    const currentRequestId = ++searchRequestIdRef.current;

    const timer = setTimeout(async () => {
      try {
        const resp = await searchCampus({ q: trimmed, types: 'buildings,rooms,areas', limit: 5 });
        if (searchRequestIdRef.current === currentRequestId) {
          setBackendSearchResults(resp?.results || null);
          setIsBackendSearching(false);
        }
      } catch {
        if (searchRequestIdRef.current === currentRequestId) {
          setBackendSearchResults(null);
          setIsBackendSearching(false);
        }
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Dismiss dropdowns on outside mousedown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // 11. Filtering and search matching on LOGICAL BUILDINGS
  const filteredLogicalBuildings = useMemo(() => {
    return buildings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = b.id.toLowerCase().includes(q);
        const matchesName = b.name.toLowerCase().includes(q);
        const matchesType = (b.type || '').toLowerCase().includes(q);
        const matchesLocation = (b.location || '').toLowerCase().includes(q);
        const matchesDesc = (b.description || '').toLowerCase().includes(q);
        const matchesFac = Array.isArray(b.facilities) && b.facilities.some((f) => f.toLowerCase().includes(q));
        return matchesId || matchesName || matchesType || matchesLocation || matchesDesc || matchesFac;
      }
      return true;
    });
  }, [buildings, statusFilter, searchQuery]);

  // Unified Search candidates: local building registry + backend rooms/labs & areas
  const searchCandidates = useMemo(() => {
    if (!searchQuery.trim()) return { buildings: [], rooms: [], facilities: [], totalCount: 0 };
    const q = searchQuery.toLowerCase().trim();

    const matchedBuildings = buildings.filter((b) => {
      const matchesId = b.id.toLowerCase().includes(q);
      const matchesName = b.name.toLowerCase().includes(q);
      const matchesType = (b.type || '').toLowerCase().includes(q);
      const matchesLocation = (b.location || '').toLowerCase().includes(q);
      const matchesDesc = (b.description || '').toLowerCase().includes(q);
      const matchesFac = Array.isArray(b.facilities) && b.facilities.some((f) => f.toLowerCase().includes(q));
      return matchesId || matchesName || matchesType || matchesLocation || matchesDesc || matchesFac;
    });

    const rooms = backendSearchResults?.rooms || [];
    const areas = backendSearchResults?.areas || [];

    return {
      buildings: matchedBuildings,
      rooms,
      facilities: areas,
      totalCount: matchedBuildings.length + rooms.length + areas.length,
    };
  }, [buildings, searchQuery, backendSearchResults]);

  const handleSelectCandidate = (item, type) => {
    if (type === 'building') {
      focusBuilding(item);
      if (onSelectBuilding) onSelectBuilding(item);
    } else if (type === 'room') {
      const bldId = item.metadata?.buildingId || 'BLD001';
      const spatialCode = BLD_TO_CODE[bldId] || bldId;
      const targetBuilding = buildings.find((b) => b.id === spatialCode || b.id === bldId || b.code === spatialCode);
      if (targetBuilding) {
        focusBuilding(targetBuilding);
        if (onSelectBuilding) onSelectBuilding(targetBuilding);
      }
      if (onOpenRoomInspector) {
        onOpenRoomInspector(bldId, item.metadata?.roomNumber, item.metadata?.block || 'C');
      }
    } else if (type === 'facility') {
      const parent = buildings.find(
        (b) => b.name.toLowerCase().includes(item.title.toLowerCase()) || b.id === item.metadata?.spatialCode
      );
      if (parent) {
        focusBuilding(parent);
        if (onSelectBuilding) onSelectBuilding(parent);
      }
    }
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  // Polygon styling logic: Invisible by default, luminous only on hover or selection
  const getPolygonClass = (polygonItem) => {
    const parent = polygonItem.parentBuilding;
    const isSelected = Boolean(
      (resolvedSelectedBuilding && resolvedSelectedBuilding.id === parent.id) ||
      (selectedBuildingId && selectedBuildingId === parent.id)
    );
    const isHovered = Boolean(hoveredBuilding && hoveredBuilding.id === parent.id);
    const isDimmed = !filteredLogicalBuildings.some((f) => f.id === parent.id);

    const classes = [styles.polygon];

    if (isSelected) {
      classes.push(styles.polygonSelected);
    }

    if (isHovered) {
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
      onPointerLeave={() => {
        if (hoverLeaveTimerRef.current) {
          clearTimeout(hoverLeaveTimerRef.current);
          hoverLeaveTimerRef.current = null;
        }
        setHoveredBuilding(null);
        if (onHoverBuilding) {
          onHoverBuilding(null);
        }
      }}
      onClick={() => {
        if (didDragMove.current) return;
        isPointerOnCardRef.current = false;
        if (onSelectBuilding) onSelectBuilding(null);
        if (onClosePreview) onClosePreview();
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
            shapeRendering="geometricPrecision"
          >
            <g id="campus-polygons">
              {flatPolygons.map((poly) => (
                <polygon
                  key={`ann-${poly.annotationId}`}
                  id={`polygon-ann-${poly.annotationId}`}
                  points={poly.pointsString}
                  className={getPolygonClass(poly)}
                  vectorEffect="non-scaling-stroke"
                  shapeRendering="geometricPrecision"
                  onPointerEnter={() => handlePolygonPointerEnter(poly.parentBuilding)}
                  onPointerLeave={handlePolygonPointerLeave}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePolygonClick(poly.parentBuilding, e);
                  }}
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

      {/* Floating Building Hover Preview Card (Strictly on Hover) */}
      {hoveredBuilding && previewCardData && (
        <div
          className={`${styles.hoverTooltip} ${
            previewCardData.placement === 'above' ? styles.tooltipAbove : styles.tooltipBelow
          }`}
          style={{
            left: `${previewCardData.x}px`,
            top: `${previewCardData.y}px`,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleCardMouseLeave}
          onPointerEnter={handleCardMouseEnter}
          onPointerLeave={handleCardMouseLeave}
          onClick={(e) => {
            e.stopPropagation();
            handlePolygonClick(hoveredBuilding, e);
          }}
          role="region"
          aria-label={`Facility overview for ${hoveredBuilding.name}`}
        >
          {/* Directional connector pointer pointing to building centroid */}
          <div
            className={`${styles.tooltipPointer} ${
              previewCardData.placement === 'above' ? styles.pointerAbove : styles.pointerBelow
            }`}
            style={{
              left: `calc(50% + ${previewCardData.pointerOffset}px)`,
            }}
          />

          {/* 1. Primary Heading: Building Name */}
          <div className={styles.popupHeader}>
            <h3 className={styles.popupTitle} title={hoveredBuilding.name}>
              {hoveredBuilding.name}
            </h3>
          </div>

          {/* 2 & 3. Secondary Metadata: Building Code & Function / Type */}
          <div className={styles.popupSubMeta}>
            <span className={styles.popupCode}>{hoveredBuilding.id}</span>
            <span className={styles.metaDivider}>•</span>
            <span className={styles.popupType}>{hoveredBuilding.type || 'Campus Facility'}</span>
            {hoveredBuilding.location && (
              <>
                <span className={styles.metaDivider}>•</span>
                <span className={styles.popupLocation}>{hoveredBuilding.location}</span>
              </>
            )}
          </div>

          {/* 4 & 5. Operational Status and Monitoring Breakdown */}
          <div className={styles.popupMetricsTable}>
            {/* Tier 4: Operational Status */}
            <div className={styles.popupMetricRow}>
              <span className={styles.metricLabel}>Operational Status</span>
              <span
                className={styles.statusBadge}
                style={{
                  color: (STATUS_META[hoveredBuilding.status] || STATUS_META.unknown).color,
                  background: (STATUS_META[hoveredBuilding.status] || STATUS_META.unknown).bg,
                  borderColor: (STATUS_META[hoveredBuilding.status] || STATUS_META.unknown).border,
                }}
              >
                <span
                  className={styles.statusDot}
                  style={{
                    background: (STATUS_META[hoveredBuilding.status] || STATUS_META.unknown).color,
                  }}
                />
                {(STATUS_META[hoveredBuilding.status] || STATUS_META.unknown).label}
              </span>
            </div>

            {/* Tier 5: Monitoring / Data Availability */}
            <div className={styles.popupMetricRow}>
              <span className={styles.metricLabel}>Telemetry &amp; Data</span>
              <span className={styles.monitoringValue}>
                {hoveredBuilding.hasTelemetry ? (
                  <span className={styles.telemetryLive}>
                    <span className={styles.livePulseDot} />
                    Live IoT Telemetry
                  </span>
                ) : (
                  <span className={styles.telemetrySpatial}>
                    <span className={styles.cadastreDot} />
                    Spatial Cadastre Record
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* 6. Short building description if available */}
          {hoveredBuilding.description && (
            <p className={styles.popupDesc}>
              {hoveredBuilding.description}
            </p>
          )}

          {/* 7. Action: View building details */}
          <button
            type="button"
            className={styles.popupFooter}
            onClick={(e) => {
              e.stopPropagation();
              handlePolygonClick(hoveredBuilding, e);
            }}
            title={`View building details for ${hoveredBuilding.name} (${hoveredBuilding.buildingId || hoveredBuilding.id})`}
            aria-label={`View building details for ${hoveredBuilding.name}`}
          >
            <span>View building details</span>
            <span className={styles.footerArrow}>→</span>
          </button>
        </div>
      )}

      {/* Map Floating Operational Control Bar (Compact Search & Filter System) */}
      <div className={styles.topControlBar} onClick={(e) => e.stopPropagation()}>
        {/* Compact Search Bar with Debounced Backend Integration */}
        <div
          className={`${styles.searchContainer} ${isSearchFocused || searchQuery ? styles.searchExpanded : ''}`}
          ref={searchContainerRef}
        >
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
            ref={searchInputRef}
            type="text"
            className={styles.searchBar}
            placeholder="Search campus, rooms, labs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsSearchFocused(false);
                searchInputRef.current?.blur();
              }
            }}
          />
          {isBackendSearching && (
            <span className={styles.searchSpinner} title="Querying live campus database..." />
          )}
          {searchQuery && (
            <button
              className={styles.clearSearchBtn}
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              title="Clear search"
            >
              &times;
            </button>
          )}

          {/* Search Dropdown with Categorized Live Results */}
          {isSearchFocused && searchQuery.trim() && (
            <div className={styles.searchDropdown}>
              {searchCandidates.totalCount > 0 ? (
                <>
                  {/* Campus Buildings & Blocks */}
                  {searchCandidates.buildings.length > 0 && (
                    <div className={styles.searchGroup}>
                      <div className={styles.searchGroupHeader}>Campus Buildings &amp; Blocks</div>
                      {searchCandidates.buildings.map((cand) => (
                        <div
                          key={`bld-${cand.id}`}
                          className={styles.searchDropdownItem}
                          onMouseDown={() => handleSelectCandidate(cand, 'building')}
                        >
                          <div className={styles.searchItemLeft}>
                            <span className={styles.searchItemIcon}>🏛️</span>
                            <div>
                              <div className={styles.searchItemTitle}>{cand.name}</div>
                              <div className={styles.searchItemSub}>
                                <span className={styles.searchItemCode}>{cand.id}</span>
                                <span>•</span>
                                <span>{cand.type}</span>
                                <span>•</span>
                                <span>{cand.location}</span>
                              </div>
                            </div>
                          </div>
                          <span
                            className={styles.searchStatusBadge}
                            style={{
                              color: (STATUS_META[cand.status] || STATUS_META.unknown).color,
                              background: (STATUS_META[cand.status] || STATUS_META.unknown).bg,
                              borderColor: (STATUS_META[cand.status] || STATUS_META.unknown).border,
                            }}
                          >
                            {(STATUS_META[cand.status] || STATUS_META.unknown).label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rooms & Laboratories */}
                  {searchCandidates.rooms.length > 0 && (
                    <div className={styles.searchGroup}>
                      <div className={styles.searchGroupHeader}>Rooms &amp; Laboratories</div>
                      {searchCandidates.rooms.map((room) => (
                        <div
                          key={`room-${room.id}`}
                          className={styles.searchDropdownItem}
                          onMouseDown={() => handleSelectCandidate(room, 'room')}
                        >
                          <div className={styles.searchItemLeft}>
                            <span className={styles.searchItemIcon}>🧪</span>
                            <div>
                              <div className={styles.searchItemTitle}>{room.title}</div>
                              <div className={styles.searchItemSub}>
                                <span>{room.subtitle}</span>
                              </div>
                            </div>
                          </div>
                          <span className={styles.searchActionTag}>Inspect</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Campus Facilities */}
                  {searchCandidates.facilities.length > 0 && (
                    <div className={styles.searchGroup}>
                      <div className={styles.searchGroupHeader}>Campus Facilities</div>
                      {searchCandidates.facilities.map((fac) => (
                        <div
                          key={`fac-${fac.id}`}
                          className={styles.searchDropdownItem}
                          onMouseDown={() => handleSelectCandidate(fac, 'facility')}
                        >
                          <div className={styles.searchItemLeft}>
                            <span className={styles.searchItemIcon}>📍</span>
                            <div>
                              <div className={styles.searchItemTitle}>{fac.title}</div>
                              <div className={styles.searchItemSub}>{fac.subtitle}</div>
                            </div>
                          </div>
                          <span className={styles.searchActionTag}>Locate</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.searchNoResults}>
                  {isBackendSearching ? 'Searching campus register...' : `No campus structures or rooms matching "${searchQuery}"`}
                </div>
              )}
            </div>
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
            onClick={() => {
              setShowLegend((prev) => !prev);
              setShowGisInfo(false);
            }}
            className={`${styles.mapBtn} ${showLegend ? styles.mapBtnActive : ''}`}
            title="Toggle Operational Status Legend"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>

          <button
            onClick={() => {
              setShowGisInfo((prev) => !prev);
              setShowLegend(false);
            }}
            className={`${styles.mapBtn} ${showGisInfo ? styles.mapBtnActive : ''}`}
            title="Map Information & Specifications"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Map Information & Survey Specifications Popover */}
      {showGisInfo && (
        <div className={styles.gisInfoBox} onClick={(e) => e.stopPropagation()}>
          <div className={styles.gisInfoHeader}>
            <div className={styles.legendTitle}>Map Information &amp; Specifications</div>
            <button className={styles.closeInfoBtn} onClick={() => setShowGisInfo(false)} title="Close Specifications">
              &times;
            </button>
          </div>
          <div className={styles.gisInfoGrid}>
            <div className={styles.gisInfoRow}>
              <span className={styles.gisInfoLabel}>Active Layer Filter:</span>
              <span className={styles.gisInfoVal}>
                {statusFilter === 'all'
                  ? `All Buildings (${buildings.length} total)`
                  : `${statusFilter === 'unknown' ? 'Unavailable' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} (${filteredLogicalBuildings.length} active)`}
              </span>
            </div>
            <div className={styles.gisInfoRow}>
              <span className={styles.gisInfoLabel}>Survey Altitude:</span>
              <span className={styles.gisInfoVal}>120m AGL (Estimated UAV survey datum)</span>
            </div>
            <div className={styles.gisInfoRow}>
              <span className={styles.gisInfoLabel}>Projection:</span>
              <span className={styles.gisInfoVal}>Planimetric Orthographic 2D</span>
            </div>
            <div className={styles.gisInfoRow}>
              <span className={styles.gisInfoLabel}>Source Resolution:</span>
              <span className={styles.gisInfoVal}>1280 &times; 851 px UAV Orthophoto</span>
            </div>
            <div className={styles.gisInfoRow}>
              <span className={styles.gisInfoLabel}>Vector Cadastre:</span>
              <span className={styles.gisInfoVal}>21 Surveyed Building Polygons</span>
            </div>
            <div className={styles.gisInfoRow}>
              <span className={styles.gisInfoLabel}>Coordinate System:</span>
              <span className={styles.gisInfoVal}>Canvas / Local Orthographic</span>
            </div>
          </div>
          <div className={styles.gisInfoNote}>
            True spatial topology mapped directly from verified CVAT survey annotations.
          </div>
        </div>
      )}

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
              <span>Status unavailable</span>
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
});

export default CampusMap;

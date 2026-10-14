import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { searchCampus, getAlerts, getMaintenance, getRooms } from '../api/client';
import { getLogicalBuildings } from '../data/buildingRegistry';
import { CAMPUS_STATIC_ROOMS as STATIC_ROOMS } from '../data/cblockData';
import { getRoomDisplayName } from '../utils/roomUtils';
import styles from './CommandPalette.module.css';

// Storage key for recent destinations
const RECENT_DESTINATIONS_KEY = 'ait_recent_palette_destinations';

// Base navigation routes for the AIT Campus Intelligence platform
const NAVIGATION_ROUTES = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    desc: 'Campus operations overview, active buildings & live KPIs',
    category: 'Navigation',
    badge: 'Route',
    actionTag: 'Jump',
    page: 'dashboard',
    iconType: 'dashboard',
    keywords: ['home', 'overview', 'summary', 'status', 'kpi'],
  },
  {
    id: 'campus',
    label: 'Campus Twin',
    desc: 'Interactive 2D satellite map & spatial facility layout',
    category: 'Navigation',
    badge: 'Spatial',
    actionTag: 'Jump',
    page: 'campus',
    iconType: 'campus',
    keywords: ['map', 'twin', 'building', 'gis', 'satellite', 'layout', '2d'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    desc: 'Deep historical trends, power demand & cross-system correlation',
    category: 'Navigation',
    badge: 'Analytics',
    actionTag: 'Jump',
    page: 'analytics',
    iconType: 'analytics',
    keywords: ['charts', 'trends', 'history', 'graphs', 'correlation', 'insights'],
  },
  {
    id: 'occupancy',
    label: 'Occupancy',
    desc: 'Zone density, lecture schedules, room headcounts & space utilization',
    category: 'Navigation',
    badge: 'Sensors',
    actionTag: 'Jump',
    page: 'occupancy',
    iconType: 'occupancy',
    keywords: ['headcount', 'density', 'class', 'students', 'timetable', 'rooms', 'lecture'],
  },
  {
    id: 'energy',
    label: 'Energy & Solar Performance',
    desc: 'Active power demand (kW), rooftop solar PV yield & grid import',
    category: 'Navigation',
    badge: 'Telemetry',
    actionTag: 'Jump',
    page: 'energy',
    iconType: 'energy',
    keywords: ['power', 'solar', 'pv', 'demand', 'grid', 'kw', 'kwh', 'electricity'],
  },
  {
    id: 'congestion',
    label: 'Congestion',
    desc: 'Pathway flow, choke points & corridor pedestrian traffic',
    category: 'Navigation',
    badge: 'Flow',
    actionTag: 'Jump',
    page: 'congestion',
    iconType: 'congestion',
    keywords: ['traffic', 'pathway', 'choke', 'corridor', 'pedestrian', 'crowd'],
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    desc: 'Facility service dispatches, AHU equipment & work orders',
    category: 'Navigation',
    badge: 'Operations',
    actionTag: 'Jump',
    page: 'maintenance',
    iconType: 'maintenance',
    keywords: ['repair', 'work order', 'ahu', 'hvac', 'service', 'fix', 'equipment'],
  },
  {
    id: 'alerts',
    label: 'Alerts & Incidents',
    desc: 'Critical alarm audit log & incident resolution management',
    category: 'Navigation',
    badge: 'Alarms',
    actionTag: 'Jump',
    page: 'alerts',
    iconType: 'alerts',
    keywords: ['warning', 'alarm', 'incident', 'critical', 'emergency', 'fault'],
  },
];

// SVG Icon renderer matching the AIT design system
function renderPaletteIcon(type) {
  switch (type) {
    case 'dashboard':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'campus':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="3 9 12 2 21 9 21 20 3 20" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case 'analytics':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case 'occupancy':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'energy':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'congestion':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h18M3 6h18M3 18h18" />
          <circle cx="7" cy="6" r="2" fill="currentColor" stroke="none" />
          <circle cx="17" cy="12" r="2" fill="currentColor" stroke="none" />
          <circle cx="7" cy="18" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'maintenance':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case 'alerts':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'building':
    case 'area':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <line x1="9" y1="6" x2="9" y2="6.01" />
          <line x1="15" y1="6" x2="15" y2="6.01" />
          <line x1="9" y1="10" x2="9" y2="10.01" />
          <line x1="15" y1="10" x2="15" y2="10.01" />
          <line x1="9" y1="14" x2="9" y2="14.01" />
          <line x1="15" y1="14" x2="15" y2="14.01" />
          <path d="M10 22v-4h4v4" />
        </svg>
      );
    case 'room':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 15h18" />
          <path d="M15 3v18" />
        </svg>
      );
    case 'alert-item':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    case 'maint-item':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case 'recent':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    default:
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
  }
}

// Highlight matching search query characters safely
function highlightMatch(text, query) {
  if (!text || !query || !query.trim()) return text;
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (terms.length === 0) return text;

  try {
    const regex = new RegExp(`(${terms.join('|')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className={styles.highlight}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  } catch {
    return text;
  }
}

export default function CommandPalette({ isOpen, onClose, onSelectPage }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentItems, setRecentItems] = useState([]);
  const [backendResults, setBackendResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const requestIdRef = useRef(0);

  // 1. ESCAPE KEY & FOCUS RESTORATION ROOT CAUSE FIX
  // Intercept Escape and Cmd+K globally in the capture phase.
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current = document.activeElement;

    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);

    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        try {
          previousActiveElementRef.current.focus();
        } catch {
          // ignore if unmounted
        }
      }
    };
  }, [isOpen, onClose]);

  // Reset query and load recents when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setBackendResults(null);
      setIsSearching(false);
      setSearchError(null);
      try {
        const stored = sessionStorage.getItem(RECENT_DESTINATIONS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setRecentItems(parsed);
          }
        }
      } catch {
        setRecentItems([]);
      }
    }
  }, [isOpen]);

  // 2. REAL-TIME DEBOUNCED BACKEND SEARCH (220ms)
  // Cancels / ignores stale requests so older responses never overwrite current results
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setBackendResults(null);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    const currentRequestId = ++requestIdRef.current;

    const timer = setTimeout(async () => {
      try {
        const response = await searchCampus({ q: trimmed, limit: 6 });
        if (requestIdRef.current === currentRequestId) {
          if (response && response.success) {
            setBackendResults(response.results || {});
          }
          setIsSearching(false);
        }
      } catch (err) {
        if (requestIdRef.current === currentRequestId) {
          setSearchError('Live database search offline. Displaying local campus directory.');
          setIsSearching(false);
        }
      }
    }, 220);

    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  // 3. Fallback catalog for 0ms client-side navigation & offline resilience
  const fallbackBuildings = useMemo(() => {
    return getLogicalBuildings();
  }, []);

  // Multi-category filtering and structured grouping
  const { groupedResults, flatFilteredItems } = useMemo(() => {
    const q = query.trim().toLowerCase();

    // CASE 1: Empty Query -> Recents + Navigation + Featured Facilities
    if (!q) {
      const groups = [];
      const flat = [];

      // Section A: Recent Destinations
      if (recentItems.length > 0) {
        const recentGroup = {
          category: 'Recent Destinations',
          items: recentItems.slice(0, 4),
        };
        groups.push(recentGroup);
        flat.push(...recentGroup.items);
      }

      // Section B: Core Navigation Modules
      const navGroup = {
        category: 'Campus Navigation',
        items: NAVIGATION_ROUTES,
      };
      groups.push(navGroup);
      flat.push(...navGroup.items);

      // Section C: Featured Facilities
      const coreFacilityCodes = ['B01', 'B02', 'B06', 'B07', 'B08'];
      const featured = fallbackBuildings
        .filter((b) => coreFacilityCodes.includes(b.id))
        .map((b) => ({
          id: `featured-${b.id}`,
          title: `${b.name} (${b.id})`,
          subtitle: `${b.type} • Official Facility`,
          description: b.description || 'Surveyed campus infrastructure',
          actionTag: 'Locate',
          iconType: 'building',
          page: 'campus',
          params: { buildingId: b.id },
        }));

      if (featured.length > 0) {
        const facilityGroup = {
          category: 'Featured Facilities',
          items: featured.slice(0, 4),
        };
        groups.push(facilityGroup);
        flat.push(...facilityGroup.items);
      }

      return { groupedResults: groups, flatFilteredItems: flat };
    }

    // CASE 2: Query Entered
    const groups = [];
    const flat = [];

    // Category 1: Navigation matches (Filtered immediately with 0ms delay)
    const matchedNav = NAVIGATION_ROUTES.filter((route) => {
      const label = route.label.toLowerCase();
      const desc = route.desc.toLowerCase();
      const kws = route.keywords || [];
      return label.includes(q) || desc.includes(q) || kws.some((kw) => kw.includes(q));
    }).map((r) => ({
      ...r,
      title: r.label,
      subtitle: `${r.badge} • #${r.page}`,
      description: r.desc,
    }));

    if (matchedNav.length > 0) {
      const navGroup = {
        category: 'Campus Navigation',
        items: matchedNav,
      };
      groups.push(navGroup);
      flat.push(...navGroup.items);
    }

    // Category 2: Backend Search Results
    if (backendResults) {
      // Buildings
      if (backendResults.buildings && backendResults.buildings.length > 0) {
        const bldGroup = {
          category: 'Campus Buildings',
          items: backendResults.buildings.map((b) => ({ ...b, iconType: 'building' })),
        };
        groups.push(bldGroup);
        flat.push(...bldGroup.items);
      }

      // Rooms
      if (backendResults.rooms && backendResults.rooms.length > 0) {
        const roomGroup = {
          category: 'Rooms & Laboratories',
          items: backendResults.rooms.map((r) => ({ ...r, iconType: 'room' })),
        };
        groups.push(roomGroup);
        flat.push(...roomGroup.items);
      }

      // Space Occupancy
      if (backendResults.occupancy && backendResults.occupancy.length > 0) {
        const occGroup = {
          category: 'Space Occupancy & Headcount',
          items: backendResults.occupancy.map((o) => ({ ...o, iconType: 'occupancy' })),
        };
        groups.push(occGroup);
        flat.push(...occGroup.items);
      }

      // Alerts
      if (backendResults.alerts && backendResults.alerts.length > 0) {
        const alertGroup = {
          category: 'Operational Alerts',
          items: backendResults.alerts.map((a) => ({ ...a, iconType: 'alert-item' })),
        };
        groups.push(alertGroup);
        flat.push(...alertGroup.items);
      }

      // Maintenance
      if (backendResults.maintenance && backendResults.maintenance.length > 0) {
        const maintGroup = {
          category: 'Maintenance Work Orders',
          items: backendResults.maintenance.map((m) => ({ ...m, iconType: 'maint-item' })),
        };
        groups.push(maintGroup);
        flat.push(...maintGroup.items);
      }

      // Energy
      if (backendResults.energy && backendResults.energy.length > 0) {
        const energyGroup = {
          category: 'Energy & Solar Telemetry',
          items: backendResults.energy.map((e) => ({ ...e, iconType: 'energy' })),
        };
        groups.push(energyGroup);
        flat.push(...energyGroup.items);
      }

      // Campus Areas
      if (backendResults.areas && backendResults.areas.length > 0) {
        const areaGroup = {
          category: 'Campus Grounds & Outdoor Areas',
          items: backendResults.areas.map((a) => ({ ...a, iconType: 'area' })),
        };
        groups.push(areaGroup);
        flat.push(...areaGroup.items);
      }
    } else {
      // In-flight / Offline fallback: Local building & room matches while waiting or if offline
      const matchedLocalB = fallbackBuildings
        .filter((b) => b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q) || b.type.toLowerCase().includes(q))
        .slice(0, 4)
        .map((b) => ({
          id: `local-bld-${b.id}`,
          title: `${b.name} (${b.id})`,
          subtitle: `${b.type} • Surveyed Facility`,
          description: b.description || 'Surveyed campus structure',
          actionTag: 'Locate',
          iconType: 'building',
          page: 'campus',
          params: { buildingId: b.id },
        }));

      if (matchedLocalB.length > 0) {
        const localBGroup = {
          category: 'Campus Buildings',
          items: matchedLocalB,
        };
        groups.push(localBGroup);
        flat.push(...localBGroup.items);
      }

      // Local room matches (e.g. C101)
      const cleanQ = q.replace(/[^a-zA-Z0-9]/g, '');
      const matchedLocalR = STATIC_ROOMS
        .filter((r) => {
          const name = (r.roomName || r.label || '').toLowerCase();
          return (
            r.id.toLowerCase().includes(cleanQ) ||
            name.includes(q) ||
            r.type.toLowerCase().includes(q)
          );
        })
        .slice(0, 4)
        .map((r) => {
          const labName = getRoomDisplayName(r);
          const displayTitle = r.roomName ? `${r.id} — ${r.roomName}` : (r.label || `${r.id} — ${r.type}`);
          return {
            id: `local-room-${r.id}`,
            title: displayTitle,
            subtitle: `Floor ${r.floor} • Academic C-Block (BLD001 / B02)`,
            description: `${r.roomName ? `${r.roomName} (${r.type})` : r.type}. Capacity: ${r.capacity || 70} students. Status: Active`,
            actionTag: 'Inspect',
            iconType: 'room',
            page: 'occupancy',
            params: { search: r.id },
          };
        });

      if (matchedLocalR.length > 0) {
        const localRGroup = {
          category: 'Rooms & Laboratories',
          items: matchedLocalR,
        };
        groups.push(localRGroup);
        flat.push(...localRGroup.items);
      }
    }

    return { groupedResults: groups, flatFilteredItems: flat };
  }, [query, backendResults, recentItems, fallbackBuildings]);

  // Keep selectedIndex clamped when results update
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, backendResults]);

  // Scroll active item smoothly into view
  useEffect(() => {
    if (!isOpen) return;
    const activeEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, isOpen]);

  // Save selected destination to sessionStorage recents
  const saveRecentDestination = useCallback((item) => {
    try {
      const itemToSave = {
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        description: item.description,
        actionTag: item.actionTag,
        page: item.destination?.page || item.page,
        params: item.destination?.params || item.params,
        iconType: item.iconType,
        timestamp: Date.now(),
      };

      const existing = JSON.parse(sessionStorage.getItem(RECENT_DESTINATIONS_KEY) || '[]');
      const filtered = existing.filter((it) => it.id !== item.id);
      const updated = [itemToSave, ...filtered].slice(0, 5);
      sessionStorage.setItem(RECENT_DESTINATIONS_KEY, JSON.stringify(updated));
      setRecentItems(updated);
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Handle item selection and navigation
  const handleSelect = useCallback(
    (item) => {
      if (!item) return;
      saveRecentDestination(item);
      const targetPage = item.destination?.page || item.page;
      const targetParams = item.destination?.params || item.params;
      onSelectPage(targetPage, targetParams);
      onClose();
    },
    [onSelectPage, onClose, saveRecentDestination]
  );

  // Keyboard navigation inside the palette
  const handleInputKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < flatFilteredItems.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : flatFilteredItems.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatFilteredItems[selectedIndex]) {
        handleSelect(flatFilteredItems[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  let runningIndex = 0;

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="AIT Campus Intelligence Global Search"
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleInputKeyDown}
      >
        {/* Search header with spinner, clear button, and ESC chip */}
        <div className={styles.searchHeader}>
          <svg
            className={styles.searchIcon}
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Search campus buildings, rooms (C101, CV Raman Lab), alerts, maintenance, occupancy..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck="false"
          />

          {isSearching && (
            <div className={styles.spinner} title="Searching campus database..." />
          )}

          {query && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                setQuery('');
                setBackendResults(null);
                inputRef.current?.focus();
              }}
              title="Clear search query"
              aria-label="Clear query"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}

          <button
            type="button"
            className={styles.closeEscapeBtn}
            onClick={onClose}
            title="Press Escape to close"
            aria-label="Close palette"
          >
            ESC
          </button>
        </div>

        {/* Offline Notice banner if backend search had an issue */}
        {searchError && (
          <div className={styles.offlineNotice}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{searchError}</span>
          </div>
        )}

        {/* Categorized results list */}
        <div ref={listRef} className={styles.resultsList}>
          {groupedResults.map((group) => {
            const groupHeader = (
              <div key={`header-${group.category}`} className={styles.sectionHeading}>
                <span>{group.category}</span>
                <span className={styles.categoryCount}>{group.items.length}</span>
              </div>
            );

            const itemsElements = group.items.map((item) => {
              const itemIndex = runningIndex++;
              const isSelected = itemIndex === selectedIndex;

              return (
                <button
                  key={item.id}
                  data-index={itemIndex}
                  className={`${styles.resultItem} ${isSelected ? styles.selected : ''}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(itemIndex)}
                  type="button"
                >
                  <div className={`${styles.itemIcon} ${styles[item.iconType] || ''}`}>
                    {renderPaletteIcon(item.iconType)}
                  </div>

                  <div className={styles.itemDetails}>
                    <div className={styles.labelRow}>
                      <span className={styles.itemLabel}>
                        {highlightMatch(item.title, query)}
                      </span>
                      {item.subtitle && (
                        <span className={styles.categoryBadge}>
                          {highlightMatch(item.subtitle, query)}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <span className={styles.itemDesc}>
                        {highlightMatch(item.description, query)}
                      </span>
                    )}
                  </div>

                  <span className={styles.jumpTag}>
                    <span>{item.actionTag || 'Jump'}</span>
                    <kbd>↵</kbd>
                  </span>
                </button>
              );
            });

            return (
              <div key={`group-${group.category}`} className={styles.groupBlock}>
                {groupHeader}
                {itemsElements}
              </div>
            );
          })}

          {/* Zero results fallback with interactive suggestions */}
          {flatFilteredItems.length === 0 && !isSearching && (
            <div className={styles.noResults}>
              <div className={styles.noResultsIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </div>
              <p className={styles.noResultsTitle}>
                No campus records found for &ldquo;<strong>{query}</strong>&rdquo;
              </p>
              <div className={styles.suggestionsContainer}>
                <span className={styles.suggestionsLabel}>Try searching for:</span>
                <div className={styles.suggestionChips}>
                  {[
                    'C101',
                    'C Block',
                    'Library',
                    'CV Raman Lab',
                    'CAED Lab',
                    'critical alerts',
                    'pending maintenance',
                    'occupancy',
                    'solar generation',
                  ].map((hint) => (
                    <button
                      key={hint}
                      type="button"
                      className={styles.suggestionChip}
                      onClick={() => {
                        setQuery(hint);
                        inputRef.current?.focus();
                      }}
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className={styles.footer}>
          <div className={styles.footerKeys}>
            <span className={styles.keyHint}>
              <kbd>↑</kbd> <kbd>↓</kbd> Navigate
            </span>
            <span className={styles.keyHint}>
              <kbd>↵</kbd> Select
            </span>
            <span className={styles.keyHint}>
              <kbd>ESC</kbd> Close
            </span>
          </div>
          <div className={styles.footerBrand}>
            <span>AIT Campus Intelligence</span>
          </div>
        </div>
      </div>
    </div>
  );
}

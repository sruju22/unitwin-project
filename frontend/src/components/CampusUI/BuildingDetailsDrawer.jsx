import React, { useState, useEffect, useMemo } from 'react';
import { updateLogicalBuilding, resetLogicalBuilding } from '../../data/buildingRegistry';
import {
  getRooms,
  getOccupancy,
  getEnergyUsage,
  getAlerts,
  getMaintenance,
} from '../../api/client';
import {
  getRoomDisplayName,
  getRoomNumber,
} from '../../utils/roomUtils';
import {
  resolveFacilityConfig,
  isGenuineLaboratory,
} from '../../utils/facilityUtils';
import {
  formatCampusDate,
  formatCampusDateTime,
} from '../../utils/dateUtils';
import styles from './BuildingDetailsDrawer.module.css';

const TYPE_OPTIONS = [
  'Administration',
  'Academic Block',
  'Auditorium',
  'Library',
  'Hostel',
  'Sports Facility',
  'Parking',
  'Canteen',
  'Gate',
  'Other',
];

const STATUS_CONFIG = {
  operational: { label: 'Operational', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' },
  maintenance: { label: 'Under Maintenance', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)' },
  warning:     { label: 'Operational Warning', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' },
  critical:    { label: 'Critical Incident', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)' },
  unknown:     { label: 'Status unavailable', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)' },
};

const DEFAULT_CLIENT_ROOMS = {
  D: [
    { id: 'D-101', roomNumber: 'D-101', floorNumber: 1, roomType: 'Classroom', label: 'D-101 — Classroom', capacity: 60, block: 'D', buildingId: 'BLD001' },
    { id: 'D-102', roomNumber: 'D-102', floorNumber: 1, roomType: 'Classroom', label: 'D-102 — Classroom', capacity: 60, block: 'D', buildingId: 'BLD001' },
    { id: 'D-105', roomNumber: 'D-105', floorNumber: 1, roomType: 'Seminar Hall', roomName: 'Department Seminar Hall', label: 'D-105 — Department Seminar Hall', capacity: 80, block: 'D', buildingId: 'BLD001' },
    { id: 'D-201', roomNumber: 'D-201', floorNumber: 2, roomType: 'Lecture Hall', label: 'D-201 — Lecture Hall', capacity: 70, block: 'D', buildingId: 'BLD001' },
    { id: 'D-202', roomNumber: 'D-202', floorNumber: 2, roomType: 'Research Laboratory', roomName: 'Advanced Computing & Research Lab', label: 'D-202 — Advanced Computing & Research Lab', capacity: 35, block: 'D', buildingId: 'BLD001' },
    { id: 'D-205', roomNumber: 'D-205', floorNumber: 2, roomType: 'Faculty Chambers', label: 'D-205 — Faculty Chambers', capacity: 15, block: 'D', buildingId: 'BLD001' },
    { id: 'D-301', roomNumber: 'D-301', floorNumber: 3, roomType: 'Computer Lab', roomName: 'Computer Applications Lab', label: 'D-301 — Computer Applications Lab', capacity: 40, block: 'D', buildingId: 'BLD001' },
    { id: 'D-302', roomNumber: 'D-302', floorNumber: 3, roomType: 'Laboratory', roomName: 'Engineering Design Studio', label: 'D-302 — Engineering Design Studio', capacity: 40, block: 'D', buildingId: 'BLD001' },
  ],
  B: [
    { id: 'B-301', roomNumber: 'B-301', floorNumber: 3, roomType: 'Laboratory', roomName: 'Team Neptunex', label: 'B-301 — Team Neptunex', capacity: 30, block: 'B', buildingId: 'BLD001' },
    { id: 'B-302', roomNumber: 'B-302', floorNumber: 3, roomType: 'Laboratory', roomName: 'Siddartha Lab', label: 'B-302 — Siddartha Lab', capacity: 40, block: 'B', buildingId: 'BLD001' },
    { id: 'B-304', roomNumber: 'B-304', floorNumber: 3, roomType: 'Computer Lab', roomName: 'Computer Lab', label: 'B-304 — Computer Lab', capacity: 40, block: 'B', buildingId: 'BLD001' },
    { id: 'B-305', roomNumber: 'B-305', floorNumber: 3, roomType: 'Computer Lab', roomName: 'Computer Lab Back Entrance', label: 'B-305 — Computer Lab Back Entrance', capacity: 30, block: 'B', buildingId: 'BLD001' },
  ],
  C: [
    { id: 'C107', roomNumber: 'C107', floorNumber: 1, roomType: 'Laboratory', roomName: 'Sir CV Raman Lab', label: 'C107 — Sir CV Raman Lab', capacity: 30, block: 'C', buildingId: 'BLD001' },
    { id: 'C123', roomNumber: 'C123', floorNumber: 1, roomType: 'Laboratory', roomName: 'Capgemini Lab', label: 'C123 — Capgemini Lab', capacity: 35, block: 'C', buildingId: 'BLD001' },
    { id: 'C305', roomNumber: 'C305', floorNumber: 3, roomType: 'Laboratory', roomName: 'CAED Lab', label: 'C305 — CAED Lab', capacity: 30, block: 'C', buildingId: 'BLD001' },
    { id: 'C307', roomNumber: 'C307', floorNumber: 3, roomType: 'Laboratory', roomName: 'Virtual Instrument Lab', label: 'C307 — Virtual Instrument Lab', capacity: 30, block: 'C', buildingId: 'BLD001' },
    { id: 'C311', roomNumber: 'C311', floorNumber: 3, roomType: 'Laboratory', roomName: 'CAED Lab II', label: 'C311 — CAED Lab II', capacity: 35, block: 'C', buildingId: 'BLD001' },
    { id: 'C320', roomNumber: 'C320', floorNumber: 3, roomType: 'Laboratory', roomName: 'Sir M H Jayaprakash Narayan Computer Lab', label: 'C320 — Sir M H Jayaprakash Narayan Computer Lab', capacity: 40, block: 'C', buildingId: 'BLD001' },
    { id: 'C325', roomNumber: 'C325', floorNumber: 3, roomType: 'Laboratory', roomName: 'Dr. APJ Abdul Kalam Lab', label: 'C325 — Dr. APJ Abdul Kalam Lab', capacity: 40, block: 'C', buildingId: 'BLD001' },
  ],
  CANTEEN: [
    { id: 'CANT-001', roomNumber: 'CANT-001', floorNumber: 1, roomType: 'Cafeteria / Dining Hall', roomName: 'Main Dining Hall', label: 'CANT-001 — Main Dining Hall', capacity: 120, buildingId: 'BLD005' },
    { id: 'CANT-002', roomNumber: 'CANT-002', floorNumber: 1, roomType: 'Pantry / Kitchen', roomName: 'Food Preparation & Service Counter', label: 'CANT-002 — Food Service Counter', capacity: 25, buildingId: 'BLD005' },
    { id: 'AREA005', roomNumber: 'AREA005', floorNumber: 1, roomType: 'Common Area', roomName: 'Canteen Surroundings', label: 'AREA005 — Canteen Surroundings', capacity: 100, buildingId: 'BLD005' },
  ],
  HOSTEL1: [
    { id: 'BLD006-101', roomNumber: 'BLD006-101', floorNumber: 1, roomType: 'Hostel Room', label: 'BLD006-101 — Student Quarters', capacity: 4, buildingId: 'BLD006' },
    { id: 'BLD006-102', roomNumber: 'BLD006-102', floorNumber: 1, roomType: 'Hostel Room', label: 'BLD006-102 — Student Quarters', capacity: 4, buildingId: 'BLD006' },
    { id: 'BLD006-103', roomNumber: 'BLD006-103', floorNumber: 1, roomType: 'Hostel Room', label: 'BLD006-103 — Student Quarters', capacity: 4, buildingId: 'BLD006' },
    { id: 'BLD006-GF-02', roomNumber: 'BLD006-GF-02', floorNumber: 1, roomType: 'Dining Hall', roomName: 'Boys Hostel Dining Hall', label: 'BLD006-GF-02 — Boys Hostel Dining Hall', capacity: 120, buildingId: 'BLD006' },
  ],
};

export default function BuildingDetailsDrawer({
  building,
  reportingDate = '2026-10-14',
  onClose,
  onFocusOnMap,
  onOpenRoomInspector,
  onBuildingUpdated,
  onMouseEnter,
  onMouseLeave,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'Academic Block',
    status: 'unknown',
    location: '',
    description: '',
    facilities: '',
  });
  const [feedback, setFeedback] = useState(null);

  // Independent Expandable Sections
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    rooms: true,
    alerts: false,
    maintenance: false,
    history: false,
  });

  const toggleSection = (key) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Canonical resolution of stable buildingId and block
  const resolvedBuildingId = useMemo(() => {
    if (building?.buildingId && building.buildingId.startsWith('BLD')) return building.buildingId;
    if (building?.id === 'B02' || building?.id === 'B04' || building?.id === 'B05') return 'BLD001';
    if (building?.id === 'B10' || building?.name?.toUpperCase().includes('S-BLOCK')) return 'BLD002';
    if (building?.id === 'B06' || building?.name?.toUpperCase().includes('LIBRARY')) return 'BLD003';
    if (building?.id === 'B18' || building?.name?.toUpperCase().includes('CANTEEN')) return 'BLD005';
    if (building?.id === 'B07' || building?.name?.toUpperCase().includes('GIRLS HOSTEL')) return 'BLD007';
    if (building?.id === 'B19' || building?.name?.toUpperCase().includes('HOSTEL 2') || building?.name?.toUpperCase().includes('HOSTEL -2')) return 'BLD008';
    if (building?.id === 'B20' || building?.name?.toUpperCase().includes('HOSTEL 3') || building?.name?.toUpperCase().includes('HOSTEL -3')) return 'BLD009';
    if (building?.id === 'B08') return 'BLD010';
    if (building?.buildingId && building.buildingId !== building.id) return building.buildingId;
    return null;
  }, [building]);

  // C & B Unified Academic Complex identification
  const isCBBlock = Boolean(
    building?.id === 'B02' ||
    building?.name?.toUpperCase().includes('C & B') ||
    (Array.isArray(building?.blocks) && building.blocks.includes('C') && building.blocks.includes('B'))
  );

  // Sub-block exploration state: 'ALL' | 'C' | 'B'
  const [selectedSubBlock, setSelectedSubBlock] = useState('ALL');
  const [activeSpaceFilter, setActiveSpaceFilter] = useState('all');
  const [prevBuildingId, setPrevBuildingId] = useState(building?.id);
  const [prevSubBlock, setPrevSubBlock] = useState(selectedSubBlock);

  // Synchronize state adjustments when selected building or sub-block changes
  if (building?.id !== prevBuildingId) {
    setPrevBuildingId(building?.id);
    setSelectedSubBlock('ALL');
    setActiveSpaceFilter('all');
  } else if (selectedSubBlock !== prevSubBlock) {
    setPrevSubBlock(selectedSubBlock);
    setActiveSpaceFilter('all');
  }

  const resolvedBlock = useMemo(() => {
    if (isCBBlock) {
      if (selectedSubBlock === 'C') return 'C';
      if (selectedSubBlock === 'B') return 'B';
      return 'C & B';
    }
    if (building?.block) return building.block;
    if (building?.id === 'B05' || building?.name?.toUpperCase().includes('A-BLOCK')) return 'A';
    if (building?.id === 'B04' || building?.name?.toUpperCase().includes('D-BLOCK')) return 'D';
    if (building?.id === 'B10' || building?.name?.toUpperCase().includes('S-BLOCK')) return 'S';
    return null;
  }, [building, isCBBlock, selectedSubBlock]);

  // Consolidated fetched data state (Derived loading avoids synchronous setState in effects)
  const [dataFetchState, setDataFetchState] = useState({
    buildingId: null,
    reportingDate: null,
    rooms: [],
    roomsError: null,
    occupancy: null,
    energy: null,
    alerts: [],
    alertsSummary: null,
    maintenance: [],
    maintenanceSummary: null,
  });

  // Facility-type configuration resolved from building metadata
  const facilityConfig = useMemo(() => resolveFacilityConfig(building), [building]);

  const isDataLoading = Boolean(
    resolvedBuildingId &&
    (dataFetchState.buildingId !== resolvedBuildingId || dataFetchState.reportingDate !== reportingDate)
  );

  // Fetch actual building-specific live data from backend MongoDB Atlas
  useEffect(() => {
    let isMounted = true;

    if (!resolvedBuildingId) {
      return;
    }

    const roomParams = { buildingId: resolvedBuildingId };
    if (resolvedBuildingId === 'BLD001') {
      if (isCBBlock) {
        if (selectedSubBlock === 'C') roomParams.block = 'C';
        else if (selectedSubBlock === 'B') roomParams.block = 'B';
      } else if (resolvedBlock) {
        roomParams.block = resolvedBlock;
      }
    }

    Promise.all([
      getRooms(roomParams)
        .then((res) => {
          if (res && res.success === false) {
            return { success: false, data: [], error: res.message || 'Room query returned failure status' };
          }
          return { success: true, data: Array.isArray(res?.data) ? res.data : [], error: null };
        })
        .catch((err) => ({
          success: false,
          data: [],
          error: err?.response?.data?.message || err?.message || 'Network error connecting to rooms service',
        })),
      getOccupancy({ buildingId: resolvedBuildingId, date: reportingDate }).catch(() => null),
      getEnergyUsage({ buildingId: resolvedBuildingId, date: reportingDate }).catch(() => null),
      getAlerts({
        buildingId: resolvedBuildingId,
        asOfDate: `${reportingDate}T23:59:59.999+05:30`,
      }).catch(() => ({ data: [], summary: null })),
      getMaintenance({
        buildingId: resolvedBuildingId,
        asOfDate: `${reportingDate}T23:59:59.999+05:30`,
      }).catch(() => ({ data: [], summary: null })),
    ]).then(([roomsRes, occRes, energyRes, alertsRes, maintRes]) => {
      if (!isMounted) return;
      setDataFetchState({
        buildingId: resolvedBuildingId,
        reportingDate,
        rooms: roomsRes?.success && Array.isArray(roomsRes.data) ? roomsRes.data : [],
        roomsError: roomsRes?.error || null,
        occupancy: occRes?.success ? occRes : null,
        energy: energyRes?.success ? energyRes : null,
        alerts: alertsRes?.success && Array.isArray(alertsRes.data) ? alertsRes.data : [],
        alertsSummary: alertsRes?.summary || null,
        maintenance: maintRes?.success && Array.isArray(maintRes.data) ? maintRes.data : [],
        maintenanceSummary: maintRes?.summary || null,
      });
    });

    return () => {
      isMounted = false;
    };
  }, [resolvedBuildingId, resolvedBlock, isCBBlock, selectedSubBlock, reportingDate]);

  // Actual building rooms list (filtered by selected sub-block if viewing C & B Block)
  const buildingRooms = useMemo(() => {
    if (!resolvedBuildingId) return [];
    if (dataFetchState.roomsError) return [];
    let list = dataFetchState.rooms || [];

    // Fallback to client prototype register if server response has no rooms and no error occurred
    if (list.length === 0) {
      if (resolvedBlock === 'D') {
        list = DEFAULT_CLIENT_ROOMS.D || [];
      } else if (resolvedBlock === 'B') {
        list = DEFAULT_CLIENT_ROOMS.B || [];
      } else if (resolvedBuildingId === 'BLD005' || building?.id === 'B18') {
        list = DEFAULT_CLIENT_ROOMS.CANTEEN || [];
      } else if (resolvedBuildingId === 'BLD006') {
        list = DEFAULT_CLIENT_ROOMS.HOSTEL1 || [];
      } else if (isCBBlock) {
        if (selectedSubBlock === 'C') {
          list = DEFAULT_CLIENT_ROOMS.C || [];
        } else if (selectedSubBlock === 'B') {
          list = DEFAULT_CLIENT_ROOMS.B || [];
        } else {
          list = [...(DEFAULT_CLIENT_ROOMS.C || []), ...(DEFAULT_CLIENT_ROOMS.B || [])];
        }
      }
    }

    if (isCBBlock) {
      if (selectedSubBlock === 'C') {
        return list.filter((r) => (r.block || '').toUpperCase() === 'C' || (r.roomNumber || '').startsWith('C'));
      }
      if (selectedSubBlock === 'B') {
        return list.filter((r) => (r.block || '').toUpperCase() === 'B' || (r.roomNumber || '').startsWith('B'));
      }
      return list.filter(
        (r) =>
          (r.block || '').toUpperCase() === 'C' ||
          (r.block || '').toUpperCase() === 'B' ||
          (r.roomNumber || '').startsWith('C') ||
          (r.roomNumber || '').startsWith('B')
      );
    }
    return list;
  }, [resolvedBuildingId, dataFetchState.rooms, dataFetchState.roomsError, isCBBlock, selectedSubBlock, resolvedBlock, building?.id]);

  // Genuine laboratories verified strictly for scientific / engineering spaces
  const genuineLabs = useMemo(() => buildingRooms.filter(isGenuineLaboratory), [buildingRooms]);

  // Filtered rooms based on active space category filter tab
  const filteredRooms = useMemo(() => {
    if (activeSpaceFilter === 'all') return buildingRooms;
    const currentCategory = facilityConfig.filterCategories?.find(
      (c) => c.id === activeSpaceFilter
    );
    if (!currentCategory || !currentCategory.match) return buildingRooms;
    return buildingRooms.filter(currentCategory.match);
  }, [buildingRooms, activeSpaceFilter, facilityConfig]);

  // Determine operational status strictly from verified data
  const hasSupportedStatus = building?.status && building.status !== 'unknown';
  const statusKey = hasSupportedStatus ? building.status : 'unknown';
  const statusMeta = STATUS_CONFIG[statusKey] || STATUS_CONFIG.unknown;

  // Operational Summary Metrics:
  // 1. Occupancy Metric
  const occupancySummary = dataFetchState.occupancy?.summary;
  const hasOccupancyMetrics = Boolean(
    resolvedBuildingId &&
    occupancySummary &&
    (occupancySummary.totalCapacity > 0 || occupancySummary.totalOccupancy > 0)
  );

  // 2. Power Demand Metric (Strictly verify building-specific records exist; never substitute campus total)
  const hasEnergyRecords = Boolean(
    resolvedBuildingId &&
    dataFetchState.energy?.count > 0 &&
    dataFetchState.energy?.summary &&
    dataFetchState.energy.summary.latestDemandKw !== null &&
    dataFetchState.energy.summary.latestDemandKw !== undefined
  );
  const powerDemandKw = hasEnergyRecords ? dataFetchState.energy.summary.latestDemandKw : null;

  // 3. Active Alerts Metric
  const activeAlertsCount = resolvedBuildingId ? dataFetchState.alerts.length : 0;
  const highSeverityAlertsCount = dataFetchState.alertsSummary?.highSeverityCount || 0;
  const mediumSeverityAlertsCount = dataFetchState.alertsSummary?.mediumSeverityCount || 0;

  // 4. Maintenance Metric
  const totalMaintOrders = resolvedBuildingId ? dataFetchState.maintenance.length : 0;
  const openMaintOrders = (dataFetchState.maintenanceSummary?.openCount || 0) + (dataFetchState.maintenanceSummary?.inProgressCount || 0);

  // Derive telemetry data availability directly from verified API responses
  const hasLiveTelemetryStream = Boolean(hasEnergyRecords || hasOccupancyMetrics);
  const isTelemetryPrototype = Boolean(
    occupancySummary?.isPrototype || dataFetchState.energy?.summary?.isPrototype
  );
  const hasVerifiedLiveTelemetry = hasLiveTelemetryStream;

  // Honest telemetry badge: differentiate active stream / pilot testbed from passive baseline
  const telemetryBadgeLabel = useMemo(() => {
    if (!hasLiveTelemetryStream) return 'Passive Monitoring · No IoT';
    if (isTelemetryPrototype) return 'Telemetry Stream · Pilot Testbed';
    return 'Verified IoT Active';
  }, [hasLiveTelemetryStream, isTelemetryPrototype]);

  const handleStartEdit = () => {
    setFormData({
      name: building.name || '',
      type: building.type || 'Academic Block',
      status: building.status || 'unknown',
      location: building.location || '',
      description: building.description || '',
      facilities: (building.facilities || []).join(', '),
    });
    setIsEditing(true);
    setFeedback(null);
  };

  // Save edited building metadata
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFeedback({ type: 'error', text: 'Building name cannot be empty.' });
      return;
    }

    const parsedFacilities = formData.facilities
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);

    const updates = {
      name: formData.name.trim(),
      type: formData.type,
      status: formData.status,
      location: formData.location.trim() || 'Campus Grounds',
      description: formData.description.trim(),
      facilities: parsedFacilities,
    };

    const updated = updateLogicalBuilding(building.id, updates);

    try {
      fetch(`/api/buildings/${encodeURIComponent(building.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).catch(() => {});
    } catch {
      // Offline fallback persisted in localStorage
    }

    setIsEditing(false);
    setFeedback({ type: 'success', text: 'Building record updated successfully!' });
    setTimeout(() => setFeedback(null), 3500);

    if (onBuildingUpdated) onBuildingUpdated(updated);
  };

  const handleReset = () => {
    if (window.confirm(`Reset "${building.name}" to default settings?`)) {
      const resetRecord = resetLogicalBuilding(building.id);
      setIsEditing(false);
      setFeedback({ type: 'success', text: 'Building record reset to defaults.' });
      setTimeout(() => setFeedback(null), 3500);
      if (onBuildingUpdated) onBuildingUpdated(resetRecord);
    }
  };

  if (!building) return null;

  return (
    <aside
      className={styles.drawer}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-label={`Facility details for ${building.name}`}
    >
      {/* 1. FIXED HEADER */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <h2 className={styles.buildingTitle} title={building.name}>
              {building.name}
            </h2>
            <div className={styles.headerBadges}>
              <span className={styles.idBadge}>
                {resolvedBuildingId ? `${resolvedBuildingId} · ${building.id}` : building.id}
              </span>
              {resolvedBlock && (
                <span className={styles.blockBadge}>Block {resolvedBlock}</span>
              )}
            </div>
          </div>

          <div className={styles.metaRow}>
            <span className={styles.typeText}>{building.type || 'Campus Facility'}</span>
            <span className={styles.metaDot}>•</span>
            <span className={styles.locationText}>{building.location || 'Campus Grounds'}</span>
          </div>

          <div className={styles.statusPillsRow}>
            {/* Operational Status Pill */}
            <span
              className={styles.statusPill}
              style={{
                color: statusMeta.color,
                backgroundColor: statusMeta.bg,
                borderColor: statusMeta.border,
              }}
            >
              <span className={styles.statusDot} style={{ backgroundColor: statusMeta.color }} />
              <span>{statusMeta.label}</span>
            </span>

            {/* IoT Telemetry Availability Pill */}
            <span
              className={`${styles.telemetryPill} ${
                hasVerifiedLiveTelemetry ? styles.telemetryVerified : styles.telemetryPassive
              }`}
            >
              <span
                className={styles.telemetryDot}
                style={{ backgroundColor: hasVerifiedLiveTelemetry ? '#10b981' : '#94a3b8' }}
              />
              <span>{telemetryBadgeLabel}</span>
            </span>
          </div>

          {/* C & B Academic Complex Explorer */}
          {isCBBlock && (
            <div className={styles.subBlockNav}>
              <div className={styles.subBlockNavHeader}>
                <span className={styles.subBlockNavLabel}>Complex Navigation:</span>
                <span className={styles.subBlockNavBadge}>
                  {selectedSubBlock === 'ALL'
                    ? 'Combined View'
                    : selectedSubBlock === 'C'
                    ? 'Viewing Block C'
                    : 'Viewing Block B'}
                </span>
              </div>
              <div className={styles.subBlockNavBtns}>
                <button
                  type="button"
                  onClick={() => setSelectedSubBlock('ALL')}
                  className={`${styles.subBlockNavBtn} ${
                    selectedSubBlock === 'ALL' ? styles.subBlockNavBtnActive : ''
                  }`}
                  title="View all combined rooms across C & B Block"
                >
                  All Complex
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSubBlock('C')}
                  className={`${styles.subBlockNavBtn} ${
                    selectedSubBlock === 'C' ? styles.subBlockNavBtnActive : ''
                  }`}
                  title="Explore C-Block laboratories and classrooms"
                >
                  Explore C-Block &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSubBlock('B')}
                  className={`${styles.subBlockNavBtn} ${
                    selectedSubBlock === 'B' ? styles.subBlockNavBtnActive : ''
                  }`}
                  title="Explore B-Block laboratories and lecture halls"
                >
                  Explore B-Block &rarr;
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.headerActions}>
          {onFocusOnMap && (
            <button
              type="button"
              onClick={() => onFocusOnMap(building)}
              className={styles.headerIconBtn}
              title="Center & Focus on Map"
              aria-label="Center & Focus on Map"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={styles.closeBtn}
            title="Close Drawer (Esc)"
            aria-label="Close details drawer"
          >
            &times;
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`${styles.alertBanner} ${
            feedback.type === 'error' ? styles.alertBannerError : styles.alertBannerSuccess
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* 2. SCROLLABLE BODY CONTENT */}
      <div className={styles.bodyScroll}>
        {/* TOP BALANCED OPERATIONAL SUMMARY (4 METRIC CARDS) */}
        <section className={styles.metricsGrid}>
          {/* Card 1: Occupancy */}
          <div className={styles.metricCard}>
            <div className={styles.metricCardHeader}>
              <span className={styles.metricCardTitle}>Occupancy</span>
              {isDataLoading ? (
                <span className={styles.loadingSpinnerMini} />
              ) : hasOccupancyMetrics ? (
                <span className={styles.provenancePill}>
                  {occupancySummary.isPrototype ? 'Pilot' : 'Live'}
                </span>
              ) : (
                <span className={styles.unavailablePill}>N/A</span>
              )}
            </div>
            <div className={styles.metricCardValueRow}>
              {isDataLoading ? (
                <span className={styles.metricCardSkeleton}>...</span>
              ) : hasOccupancyMetrics ? (
                <>
                  <span className={styles.metricValueLarge}>
                    {occupancySummary.totalOccupancy.toLocaleString()}
                  </span>
                  <span className={styles.metricUnit}>people</span>
                </>
              ) : (
                <span className={styles.metricValueMuted}>--</span>
              )}
            </div>
            <div className={styles.metricCardSub}>
              {hasOccupancyMetrics ? (
                <>
                  <span>
                    of {occupancySummary.totalCapacity.toLocaleString()} cap ({occupancySummary.averageUtilization}%)
                  </span>
                  {occupancySummary.timestamp && (
                    <span className={styles.metricTime}>
                      {formatCampusDateTime(occupancySummary.timestamp)}
                    </span>
                  )}
                </>
              ) : (
                <span>No presence telemetry stream</span>
              )}
            </div>
          </div>

          {/* Card 2: Power Demand */}
          <div className={styles.metricCard}>
            <div className={styles.metricCardHeader}>
              <span className={styles.metricCardTitle}>Power Demand</span>
              {isDataLoading ? (
                <span className={styles.loadingSpinnerMini} />
              ) : hasEnergyRecords ? (
                <span className={styles.provenancePill}>
                  {dataFetchState.energy?.summary?.isPrototype ? 'Pilot' : 'Live'}
                </span>
              ) : (
                <span className={styles.unavailablePill}>N/A</span>
              )}
            </div>
            <div className={styles.metricCardValueRow}>
              {isDataLoading ? (
                <span className={styles.metricCardSkeleton}>...</span>
              ) : hasEnergyRecords ? (
                <>
                  <span className={styles.metricValueLarge}>{powerDemandKw}</span>
                  <span className={styles.metricUnit}>kW</span>
                </>
              ) : (
                <span className={styles.metricValueMuted}>--</span>
              )}
            </div>
            <div className={styles.metricCardSub}>
              {hasEnergyRecords ? (
                <>
                  <span>
                    {dataFetchState.energy.summary.latestEnergyKwh || 0} kWh interval demand
                  </span>
                  {dataFetchState.energy.summary.timestamp && (
                    <span className={styles.metricTime}>
                      {formatCampusDateTime(dataFetchState.energy.summary.timestamp)}
                    </span>
                  )}
                </>
              ) : (
                <span>No power telemetry stream</span>
              )}
            </div>
          </div>

          {/* Card 3: Active Alerts */}
          <div className={styles.metricCard}>
            <div className={styles.metricCardHeader}>
              <span className={styles.metricCardTitle}>Active Alerts</span>
              {isDataLoading ? (
                <span className={styles.loadingSpinnerMini} />
              ) : activeAlertsCount > 0 ? (
                <span className={styles.alertPillWarning}>{activeAlertsCount} active</span>
              ) : (
                <span className={styles.nominalPill}>Nominal</span>
              )}
            </div>
            <div className={styles.metricCardValueRow}>
              {isDataLoading ? (
                <span className={styles.metricCardSkeleton}>...</span>
              ) : (
                <>
                  <span className={styles.metricValueLarge}>{activeAlertsCount}</span>
                  <span className={styles.metricUnit}>incidents</span>
                </>
              )}
            </div>
            <div className={styles.metricCardSub}>
              {activeAlertsCount > 0 ? (
                <>
                  <span>
                    {highSeverityAlertsCount} High · {mediumSeverityAlertsCount} Medium
                  </span>
                  {dataFetchState.alerts[0]?.timestamp && (
                    <span className={styles.metricTime}>
                      Latest: {formatCampusDate(dataFetchState.alerts[0].timestamp)}
                    </span>
                  )}
                </>
              ) : (
                <span>All facility systems nominal</span>
              )}
            </div>
          </div>

          {/* Card 4: Maintenance */}
          <div className={styles.metricCard}>
            <div className={styles.metricCardHeader}>
              <span className={styles.metricCardTitle}>Maintenance</span>
              {isDataLoading ? (
                <span className={styles.loadingSpinnerMini} />
              ) : openMaintOrders > 0 ? (
                <span className={styles.alertPillWarning}>{openMaintOrders} open</span>
              ) : (
                <span className={styles.nominalPill}>Nominal</span>
              )}
            </div>
            <div className={styles.metricCardValueRow}>
              {isDataLoading ? (
                <span className={styles.metricCardSkeleton}>...</span>
              ) : (
                <>
                  <span className={styles.metricValueLarge}>{openMaintOrders}</span>
                  <span className={styles.metricUnit}>work orders</span>
                </>
              )}
            </div>
            <div className={styles.metricCardSub}>
              {openMaintOrders > 0 ? (
                <>
                  <span>{dataFetchState.maintenanceSummary?.highPriorityCount || 0} High Priority</span>
                  {dataFetchState.maintenance[0]?.reportedDate && (
                    <span className={styles.metricTime}>
                      Reported {formatCampusDate(dataFetchState.maintenance[0].reportedDate)}
                    </span>
                  )}
                </>
              ) : (
                <span>No active work orders ({totalMaintOrders} total logged)</span>
              )}
            </div>
          </div>
        </section>

        {/* 5 INDEPENDENT EXPANDABLE ACCORDIONS */}

        {/* SECTION 1: BUILDING OVERVIEW */}
        <div className={styles.accordionSection}>
          <button
            type="button"
            className={styles.accordionHeader}
            onClick={() => toggleSection('overview')}
            aria-expanded={expandedSections.overview}
          >
            <div className={styles.accordionHeaderLeft}>
              <span className={styles.sectionIconBadge}>🏢</span>
              <span className={styles.sectionTitle}>Building Overview</span>
            </div>
            <div className={styles.accordionHeaderRight}>
              <span className={styles.accordionMetaBadge}>
                {building.floors ? `${building.floors} Floors` : 'Metadata'}
              </span>
              <svg
                className={`${styles.accordionChevron} ${
                  expandedSections.overview ? styles.chevronOpen : ''
                }`}
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {expandedSections.overview && (
            <div className={styles.accordionBody}>
              {isEditing ? (
                <form onSubmit={handleSave} className={styles.editForm}>
                  <label className={styles.formLabel}>
                    Building Name *
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={styles.formInput}
                      required
                    />
                  </label>

                  <div className={styles.formRow}>
                    <label className={styles.formLabel} style={{ flex: 1 }}>
                      Building Type
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className={styles.formSelect}
                      >
                        {TYPE_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.formLabel} style={{ flex: 1 }}>
                      Operational Status
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className={styles.formSelect}
                      >
                        <option value="operational">Operational</option>
                        <option value="maintenance">Under Maintenance</option>
                        <option value="warning">Operational Warning</option>
                        <option value="critical">Critical Incident</option>
                        <option value="unknown">Status unavailable</option>
                      </select>
                    </label>
                  </div>

                  <label className={styles.formLabel}>
                    Campus Zone / Location
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className={styles.formInput}
                    />
                  </label>

                  <label className={styles.formLabel}>
                    Facilities (comma-separated)
                    <input
                      type="text"
                      value={formData.facilities}
                      onChange={(e) => setFormData({ ...formData, facilities: e.target.value })}
                      className={styles.formInput}
                    />
                  </label>

                  <label className={styles.formLabel}>
                    Description
                    <textarea
                      rows="3"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className={styles.formTextarea}
                    />
                  </label>

                  <div className={styles.formBtnRow}>
                    <button type="submit" className={styles.saveBtn}>
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className={styles.cancelBtn}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className={styles.resetBtn}
                    >
                      Reset Defaults
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className={styles.overviewTopBar}>
                    <p className={styles.overviewDesc}>
                      {building.description || 'No registered description provided for this campus structure.'}
                    </p>
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className={styles.editPencilBtn}
                      title="Edit facility record"
                    >
                      Edit Record ✏️
                    </button>
                  </div>

                  <div className={styles.propertiesGrid}>
                    <div className={styles.propertyItem}>
                      <span className={styles.propLabel}>Facility Type</span>
                      <span className={styles.propValue}>{building.type}</span>
                    </div>
                    <div className={styles.propertyItem}>
                      <span className={styles.propLabel}>Operational Status</span>
                      <span className={styles.propValue} style={{ color: statusMeta.color }}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <div className={styles.propertyItem}>
                      <span className={styles.propLabel}>Canonical ID</span>
                      <span className={styles.propValueMono}>
                        {resolvedBuildingId || 'Unassigned'}
                      </span>
                    </div>
                    <div className={styles.propertyItem}>
                      <span className={styles.propLabel}>Spatial Code</span>
                      <span className={styles.propValueMono}>{building.id}</span>
                    </div>
                    <div className={styles.propertyItem}>
                      <span className={styles.propLabel}>Block Sector</span>
                      <span className={styles.propValue}>
                        {resolvedBlock ? `Block ${resolvedBlock}` : 'N/A'}
                      </span>
                    </div>
                    <div className={styles.propertyItem}>
                      <span className={styles.propLabel}>Total Floors</span>
                      <span className={styles.propValue}>
                        {building.floors ? `${building.floors} Physical Floors` : 'Unspecified'}
                      </span>
                    </div>
                    <div className={styles.propertyItem}>
                      <span className={styles.propLabel}>Cataloged Spaces</span>
                      <span className={styles.propValue}>
                        {buildingRooms.length > 0
                          ? `${buildingRooms.length} ${facilityConfig.unitName || 'Spaces'} registered`
                          : building.totalRooms
                          ? `${building.totalRooms} ${facilityConfig.unitName || 'Spaces'} estimate`
                          : 'None cataloged'}
                      </span>
                    </div>
                    <div className={styles.propertyItem}>
                      <span className={styles.propLabel}>Cadastre Topology</span>
                      <span className={styles.propValue}>
                        {building.polygonIds?.length
                          ? `Polygon #${building.polygonIds.join(', #')} (120m UAV Datum)`
                          : 'UAV Planimetric Vector'}
                      </span>
                    </div>
                  </div>

                  {/* Registered Facilities */}
                  {building.facilities && building.facilities.length > 0 && (
                    <div className={styles.facilitiesContainer}>
                      <span className={styles.subSectionTitle}>
                        {facilityConfig.facilitiesSubTitle || 'Registered Facilities'}
                      </span>
                      <div className={styles.facilitiesTagsList}>
                        {building.facilities.map((fac, idx) => (
                          <span key={idx} className={styles.facilityChip}>
                            {fac}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 2: FACILITY-AWARE SPACES & ROOMS */}
        <div className={styles.accordionSection}>
          <button
            type="button"
            className={styles.accordionHeader}
            onClick={() => toggleSection('rooms')}
            aria-expanded={expandedSections.rooms}
          >
            <div className={styles.accordionHeaderLeft}>
              <span className={styles.sectionIconBadge}>{facilityConfig.sectionIcon}</span>
              <span className={styles.sectionTitle}>{facilityConfig.sectionTitle}</span>
            </div>
            <div className={styles.accordionHeaderRight}>
              <span
                className={
                  dataFetchState.roomsError
                    ? styles.accordionAlertBadge
                    : styles.accordionCountBadge
                }
              >
                {isDataLoading
                  ? '...'
                  : dataFetchState.roomsError
                  ? 'Unavailable'
                  : facilityConfig.roomCountLabel(buildingRooms.length, genuineLabs.length)}
              </span>
              <svg
                className={`${styles.accordionChevron} ${
                  expandedSections.rooms ? styles.chevronOpen : ''
                }`}
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {expandedSections.rooms && (
            <div className={styles.accordionBody}>
              {isDataLoading ? (
                <div className={styles.loadingBox}>
                  <span className={styles.loadingSpinnerMini} />
                  <span>Fetching cataloged {facilityConfig.unitName.toLowerCase()} records...</span>
                </div>
              ) : dataFetchState.roomsError ? (
                <div className={styles.errorStateBox}>
                  <span className={styles.errorIcon}>⚠️</span>
                  <div className={styles.errorTextGroup}>
                    <div className={styles.errorTitle}>Catalog Data Temporarily Unavailable</div>
                    <div className={styles.errorDesc}>
                      {dataFetchState.roomsError}. Live room-level spatial telemetry could not be verified from MongoDB Atlas.
                    </div>
                  </div>
                </div>
              ) : buildingRooms.length === 0 ? (
                <div className={styles.emptyFacilityBox}>
                  <div className={styles.emptyFacilityHeader}>
                    <span className={styles.emptyFacilityIcon}>{facilityConfig.emptyStateIcon}</span>
                    <div className={styles.emptyFacilityTexts}>
                      <div className={styles.emptyFacilityTitle}>
                        No Individual {facilityConfig.unitName} Cataloged
                      </div>
                      <div className={styles.emptyFacilitySub}>
                        {facilityConfig.emptyStateMessage}
                      </div>
                    </div>
                  </div>

                  {building.facilities && building.facilities.length > 0 && (
                    <div className={styles.emptyFacilityMetadataSection}>
                      <span className={styles.emptyFacilityMetadataLabel}>
                        Registered Facility Amenities (Non-Room Metadata)
                      </span>
                      <div className={styles.emptyFacilityMetadataChips}>
                        {building.facilities.map((fac, idx) => (
                          <span key={idx} className={styles.emptyFacilityChip}>
                            {fac}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {facilityConfig.filterCategories && facilityConfig.filterCategories.length > 1 && (
                    <div className={styles.spaceCategoryTabs}>
                      {facilityConfig.filterCategories.map((cat) => {
                        const count =
                          cat.id === 'all'
                            ? buildingRooms.length
                            : buildingRooms.filter(cat.match || (() => true)).length;
                        const isActive = activeSpaceFilter === cat.id;

                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActiveSpaceFilter(cat.id)}
                            className={`${styles.spaceCategoryTab} ${
                              isActive ? styles.spaceCategoryTabActive : ''
                            }`}
                          >
                            <span>{cat.label}</span>
                            <span className={styles.spaceCategoryBadge}>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {filteredRooms.length === 0 ? (
                    <div className={styles.emptyStateBox}>
                      <span>No spaces matching this filter category.</span>
                    </div>
                  ) : (
                    <div className={styles.roomListGrid}>
                      {filteredRooms.map((room) => {
                        const displayName = getRoomDisplayName(room);
                        const roomNum = getRoomNumber(room);
                        const badge = facilityConfig.roomTypeBadge
                          ? facilityConfig.roomTypeBadge(room)
                          : null;

                        return (
                          <div key={room.roomNumber || room._id} className={styles.roomCard}>
                            <div className={styles.roomCardLeft}>
                              <div className={styles.roomNumberPill}>{roomNum}</div>
                              <div className={styles.roomMetaInfo}>
                                <div className={styles.roomName}>{displayName}</div>
                                <div className={styles.roomSub}>
                                  Floor {room.floorNumber} • {room.roomType || 'Facility Space'}
                                  {badge && (
                                    <span
                                      className={`${styles.roomTypeBadge} ${
                                        styles['badge_' + badge.variant] || styles.labBadge
                                      }`}
                                    >
                                      {badge.label}
                                    </span>
                                  )}
                                  {room.capacity > 0 && (
                                    <span className={styles.roomCapacityTag}>
                                      {room.capacity} cap
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {onOpenRoomInspector && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenRoomInspector(
                                    resolvedBuildingId || 'BLD001',
                                    room.roomNumber,
                                    room.block || resolvedBlock
                                  )
                                }
                                className={styles.inspectRoomBtn}
                                title={`Open Room Twin for ${roomNum}`}
                              >
                                Inspect &rarr;
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* SECTION 3: ALERTS & INCIDENTS */}
        <div className={styles.accordionSection}>
          <button
            type="button"
            className={styles.accordionHeader}
            onClick={() => toggleSection('alerts')}
            aria-expanded={expandedSections.alerts}
          >
            <div className={styles.accordionHeaderLeft}>
              <span className={styles.sectionIconBadge}>⚠️</span>
              <span className={styles.sectionTitle}>Alerts &amp; Incidents</span>
            </div>
            <div className={styles.accordionHeaderRight}>
              <span
                className={
                  activeAlertsCount > 0 ? styles.accordionAlertBadge : styles.accordionCountBadge
                }
              >
                {isDataLoading ? '...' : `${activeAlertsCount} Active`}
              </span>
              <svg
                className={`${styles.accordionChevron} ${
                  expandedSections.alerts ? styles.chevronOpen : ''
                }`}
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {expandedSections.alerts && (
            <div className={styles.accordionBody}>
              {isDataLoading ? (
                <div className={styles.loadingBox}>
                  <span className={styles.loadingSpinnerMini} />
                  <span>Fetching active facility alerts...</span>
                </div>
              ) : dataFetchState.alerts.length === 0 ? (
                <div className={styles.nominalStateBox}>
                  <span className={styles.nominalCheck}>✓</span>
                  <span>No active alerts or operational incidents recorded for this facility.</span>
                </div>
              ) : (
                <div className={styles.alertsList}>
                  {dataFetchState.alerts.map((alert) => {
                    const sev = (alert.severity || 'Medium').toLowerCase();
                    const isHigh = sev === 'high' || sev === 'critical';
                    const isMed = sev === 'medium' || sev === 'warning';

                    return (
                      <div
                        key={alert.alertId || alert._id}
                        className={`${styles.alertCard} ${
                          isHigh ? styles.alertHigh : isMed ? styles.alertMed : styles.alertLow
                        }`}
                      >
                        <div className={styles.alertCardHeader}>
                          <span
                            className={`${styles.severityTag} ${
                              isHigh ? styles.sevHighTag : isMed ? styles.sevMedTag : styles.sevLowTag
                            }`}
                          >
                            {alert.severity || 'Incident'}
                          </span>
                          <span className={styles.alertTime}>
                            {formatCampusDateTime(alert.timestamp || alert.createdAt)}
                          </span>
                        </div>

                        <div className={styles.alertMessage}>
                          {alert.message || alert.title || 'Operational anomaly flagged'}
                        </div>

                        {alert.roomNumber && (
                          <div className={styles.alertLocation}>
                            <span>Affected Location: </span>
                            <strong>Room {alert.roomNumber}</strong>
                          </div>
                        )}

                        {alert.actionRecommended && (
                          <div className={styles.alertAction}>
                            <span className={styles.actionLabel}>Action:</span>{' '}
                            {alert.actionRecommended}
                          </div>
                        )}

                        <div className={styles.alertFooter}>
                          <span className={styles.alertStatusBadge}>
                            Status: {alert.status || 'Active'}
                          </span>
                          {alert.prototype && (
                            <span className={styles.pilotSmallTag}>Pilot Testbed Stream</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 4: MAINTENANCE */}
        <div className={styles.accordionSection}>
          <button
            type="button"
            className={styles.accordionHeader}
            onClick={() => toggleSection('maintenance')}
            aria-expanded={expandedSections.maintenance}
          >
            <div className={styles.accordionHeaderLeft}>
              <span className={styles.sectionIconBadge}>🔧</span>
              <span className={styles.sectionTitle}>Maintenance</span>
            </div>
            <div className={styles.accordionHeaderRight}>
              <span className={styles.accordionCountBadge}>
                {isDataLoading
                  ? '...'
                  : `${openMaintOrders} Open (${totalMaintOrders} Total)`}
              </span>
              <svg
                className={`${styles.accordionChevron} ${
                  expandedSections.maintenance ? styles.chevronOpen : ''
                }`}
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {expandedSections.maintenance && (
            <div className={styles.accordionBody}>
              {isDataLoading ? (
                <div className={styles.loadingBox}>
                  <span className={styles.loadingSpinnerMini} />
                  <span>Fetching maintenance work orders...</span>
                </div>
              ) : dataFetchState.maintenance.length === 0 ? (
                <div className={styles.nominalStateBox}>
                  <span className={styles.nominalCheck}>✓</span>
                  <span>No open maintenance tickets or repair logs for this facility.</span>
                </div>
              ) : (
                <div className={styles.maintenanceList}>
                  {dataFetchState.maintenance.map((m) => {
                    const isHigh = (m.priority || '').toLowerCase() === 'high';
                    const isOpen = (m.status || '').toLowerCase() === 'open';

                    return (
                      <div key={m._id} className={styles.maintenanceCard}>
                        <div className={styles.maintCardHeader}>
                          <div className={styles.maintHeaderLeft}>
                            <span
                              className={`${styles.maintPriorityTag} ${
                                isHigh ? styles.maintPriorityHigh : styles.maintPriorityMed
                              }`}
                            >
                              {m.priority || 'Normal'} Priority
                            </span>
                            <span className={styles.maintAssetType}>
                              {m.assetType || 'Facility'}
                            </span>
                          </div>
                          <span
                            className={`${styles.maintStatusTag} ${
                              isOpen ? styles.maintStatusOpen : styles.maintStatusProgress
                            }`}
                          >
                            {m.status || 'Open'}
                          </span>
                        </div>

                        <div className={styles.maintIssue}>{m.issue}</div>

                        <div className={styles.maintMetaRow}>
                          {m.roomNumber && (
                            <span className={styles.maintRoom}>Room {m.roomNumber}</span>
                          )}
                          <span className={styles.maintDate}>
                            Reported: {formatCampusDate(m.reportedDate)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 5: OPERATIONAL HISTORY */}
        <div className={styles.accordionSection}>
          <button
            type="button"
            className={styles.accordionHeader}
            onClick={() => toggleSection('history')}
            aria-expanded={expandedSections.history}
          >
            <div className={styles.accordionHeaderLeft}>
              <span className={styles.sectionIconBadge}>📊</span>
              <span className={styles.sectionTitle}>Operational History</span>
            </div>
            <div className={styles.accordionHeaderRight}>
              <span className={styles.accordionCountBadge}>
                {hasVerifiedLiveTelemetry ? 'Telemetry Logs' : 'Passive'}
              </span>
              <svg
                className={`${styles.accordionChevron} ${
                  expandedSections.history ? styles.chevronOpen : ''
                }`}
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {expandedSections.history && (
            <div className={styles.accordionBody}>
              {/* Provenance Banner */}
              <div className={styles.provenanceBox}>
                <span className={styles.provenanceIcon}>ℹ️</span>
                <span className={styles.provenanceText}>
                  {hasVerifiedLiveTelemetry
                    ? (isTelemetryPrototype
                        ? 'Data Provenance: Active telemetry data stream from campus pilot testbed (meter logs & occupancy models).'
                        : 'Data Provenance: Verified telemetry stream correlated from physical smart sub-meters and presence sensors.')
                    : 'Data Provenance: Facility operates under passive baseline monitoring; no telemetry log streams configured.'}
                </span>
              </div>

              {/* Occupancy Timeline */}
              {occupancySummary?.timeline && occupancySummary.timeline.length > 0 ? (
                <div className={styles.historyGroup}>
                  <span className={styles.historyGroupTitle}>Occupancy Observations</span>
                  <div className={styles.timelineList}>
                    {occupancySummary.timeline.map((item, idx) => (
                      <div key={idx} className={styles.timelineRow}>
                        <span className={styles.timelineTime}>
                          {item.snapshotLabel || formatCampusDateTime(item.timestamp)}
                        </span>
                        <div className={styles.timelineValues}>
                          <span className={styles.timelineOccupants}>
                            {item.totalOccupancy} / {item.totalCapacity}
                          </span>
                          <span className={styles.timelineUtilBadge}>
                            {item.utilization}% util
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Energy Observations */}
              {dataFetchState.energy?.data && dataFetchState.energy.data.length > 0 ? (
                <div className={styles.historyGroup}>
                  <span className={styles.historyGroupTitle}>Recent Power Observations</span>
                  <div className={styles.timelineList}>
                    {dataFetchState.energy.data.slice(0, 5).map((rec, idx) => (
                      <div key={idx} className={styles.timelineRow}>
                        <span className={styles.timelineTime}>
                          {rec.snapshotLabel || formatCampusDateTime(rec.timestamp)}
                        </span>
                        <div className={styles.timelineValues}>
                          <span className={styles.timelineDemand}>
                            {rec.activePowerDemandKW || rec.powerRatingWatts
                              ? `${((rec.powerRatingWatts * (rec.activeQuantity || 1)) / 1000).toFixed(1)} kW`
                              : `${rec.energyKWh || 0} kWh`}
                          </span>
                          <span className={styles.timelineMeterBadge}>
                            {rec.meterId || 'Sub-meter'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {!occupancySummary?.timeline?.length && !dataFetchState.energy?.data?.length && (
                <div className={styles.emptyStateBox}>
                  <span>No historical telemetry logs recorded for this building.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

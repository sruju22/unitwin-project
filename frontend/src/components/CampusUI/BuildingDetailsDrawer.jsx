import React, { useState, useEffect, useMemo } from 'react';
import { updateLogicalBuilding, resetLogicalBuilding } from '../../data/buildingRegistry';
import { getRooms } from '../../api/client';
import {
  getRoomDisplayName,
  getRoomNumber,
  isLaboratory,
  hasDesignatedLabName,
} from '../../utils/roomUtils';
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
  'Other',
];

const STATUS_CONFIG = {
  operational: { label: 'Operational (Normal)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)' },
  maintenance: { label: 'Under Maintenance', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.14)' },
  warning:     { label: 'Operational Warning', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)' },
  critical:    { label: 'Critical Incident', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.14)' },
  unknown:     { label: 'Status unavailable', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.14)' },
};

export default function BuildingDetailsDrawer({
  building,
  isHoverPreview = false,
  onPinBuilding = null,
  onClose,
  onFocusOnMap,
  onOpenRoomInspector,
  onBuildingUpdated,
  onMouseEnter,
  onMouseLeave,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: building?.name || '',
    type: building?.type || 'Academic Block',
    status: building?.status || 'unknown',
    location: building?.location || '',
    description: building?.description || '',
    facilities: (building?.facilities || []).join(', '),
  });
  const [feedback, setFeedback] = useState(null);

  // Live rooms/labs fetched from backend Atlas
  const [buildingRooms, setBuildingRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  // Canonical resolution of buildingId and block
  const resolvedBuildingId = useMemo(() => {
    if (building?.buildingId && building.buildingId !== building.id) return building.buildingId;
    if (building?.id === 'B02' || building?.id === 'B04' || building?.id === 'B05') return 'BLD001';
    if (building?.name?.toUpperCase().includes('BLOCK')) return 'BLD001';
    return building?.buildingId || null;
  }, [building]);

  const resolvedBlock = useMemo(() => {
    if (building?.block) return building.block;
    if (building?.id === 'B05' || building?.name?.toUpperCase().includes('A-BLOCK')) return 'A';
    if (building?.id === 'B04' || building?.name?.toUpperCase().includes('B-BLOCK')) return 'B';
    if (building?.id === 'B02' || building?.name?.toUpperCase().includes('C-BLOCK')) return 'C';
    return null;
  }, [building]);

  useEffect(() => {
    let isMounted = true;
    if (!resolvedBuildingId) {
      setBuildingRooms([]);
      return;
    }

    setRoomsLoading(true);
    const queryParams = { buildingId: resolvedBuildingId };
    if (resolvedBlock) {
      queryParams.block = resolvedBlock;
    }

    getRooms(queryParams)
      .then((res) => {
        if (!isMounted) return;
        if (res?.success && Array.isArray(res.data)) {
          setBuildingRooms(res.data);
        } else {
          setBuildingRooms([]);
        }
      })
      .catch(() => {
        if (isMounted) setBuildingRooms([]);
      })
      .finally(() => {
        if (isMounted) setRoomsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [resolvedBuildingId, resolvedBlock]);

  const featuredLabs = useMemo(() => {
    return buildingRooms.filter((r) => isLaboratory(r) || hasDesignatedLabName(r));
  }, [buildingRooms]);

  if (!building) return null;

  const statusMeta = STATUS_CONFIG[building.status] || STATUS_CONFIG.unknown;
  const isAcademicBlock =
    building.id === 'B02' ||
    building.id === 'B04' ||
    building.id === 'B05' ||
    resolvedBuildingId === 'BLD001' ||
    building.name.toUpperCase().includes('BLOCK');

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

    // Update in-memory & localStorage
    const updated = updateLogicalBuilding(building.id, updates);

    // Optional background sync to backend API if available
    try {
      fetch(`/api/buildings/${encodeURIComponent(building.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).catch(() => {});
    } catch {
      // Offline fallback already persisted locally
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

  return (
    <aside
      className={styles.drawer}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-label={`Details for ${building.name}`}
    >
      {/* Top Banner for Hover Preview */}
      {isHoverPreview && (
        <div className={styles.previewBanner}>
          <span>👁️ Hover Preview</span>
          {onPinBuilding && (
            <button
              onClick={() => onPinBuilding(building)}
              className={styles.pinBtn}
              title="Pin this building to keep card open"
            >
              Pin Card 📌
            </button>
          )}
        </div>
      )}

      {/* Header bar */}
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <div
            className={styles.facilityIconBadge}
            style={{
              color: statusMeta.color,
              background: statusMeta.bg,
              border: `1px solid ${statusMeta.color}40`,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" />
            </svg>
          </div>
          <div>
            <h2 className={styles.buildingTitle}>{building.name}</h2>
            <div className={styles.metaRow}>
              <span className={styles.categoryTag}>{building.type}</span>
              <span className={styles.locationTag}>📍 {building.location}</span>
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            onClick={() => onFocusOnMap && onFocusOnMap(building)}
            className={styles.iconBtn}
            title="Focus & Center on Map"
            aria-label="Focus on Map"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className={styles.closeBtn}
            title="Close Drawer"
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

      <div className={styles.bodyContent}>
        {/* Operational status card */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeading}>
            <span className={styles.sectionIcon}>⚡</span>
            <h3>Operational Status</h3>
          </div>
          <div className={styles.statusDisplay} style={{ borderColor: statusMeta.color }}>
            <span
              className={styles.statusDot}
              style={{
                backgroundColor: statusMeta.color,
                boxShadow: `0 0 10px ${statusMeta.color}`,
              }}
            />
            <div>
              <div className={styles.statusLabel} style={{ color: statusMeta.color }}>
                {statusMeta.label}
              </div>
              <div className={styles.statusSub}>
                {building.status === 'critical'
                  ? 'Immediate facility intervention required.'
                  : building.status === 'warning'
                  ? 'Operating with flagged telemetry warnings.'
                  : building.status === 'maintenance'
                  ? 'Scheduled servicing in progress.'
                  : building.status === 'operational'
                  ? 'All services operating nominal.'
                  : 'Status unverified / Initial survey condition: Unknown.'}
              </div>
            </div>
          </div>
        </section>

        {/* Edit Form OR Property Display */}
        {isEditing ? (
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeading}>
              <span className={styles.sectionIcon}>✏️</span>
              <h3>Edit Building Record</h3>
            </div>
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
                    <option value="maintenance">Maintenance</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
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
                  placeholder="e.g. Central Quad, East Wing"
                  className={styles.formInput}
                />
              </label>

              <label className={styles.formLabel}>
                Facilities (comma-separated)
                <input
                  type="text"
                  value={formData.facilities}
                  onChange={(e) => setFormData({ ...formData, facilities: e.target.value })}
                  placeholder="e.g. Lecture Halls, Computer Lab, WiFi 6"
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
                  placeholder="Operational details and usage..."
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
                  title="Reset to survey defaults"
                >
                  Reset Defaults
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeadingWithAction}>
              <div className={styles.sectionHeading}>
                <span className={styles.sectionIcon}>🏢</span>
                <h3>Building Information</h3>
              </div>
              <button
                onClick={handleStartEdit}
                className={styles.editTriggerBtn}
                title="Edit name, status, or facilities"
              >
                Edit Building
              </button>
            </div>

            <p className={styles.descText}>
              {building.description || 'No description provided for this campus structure.'}
            </p>

            <div className={styles.propertyGrid}>
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
                <span className={styles.propLabel}>Campus Zone</span>
                <span className={styles.propValue}>{building.location || 'Campus Grounds'}</span>
              </div>
              <div className={styles.propertyItem}>
                <span className={styles.propLabel}>Monitoring State</span>
                <span className={styles.propValue}>
                  {building.hasTelemetry ? 'Live IoT Active' : 'Standard Monitoring'}
                </span>
              </div>
            </div>

            {/* Facilities list */}
            {building.facilities && building.facilities.length > 0 && (
              <div style={{ marginTop: '0.85rem' }}>
                <span className={styles.propLabel} style={{ marginBottom: '0.35rem' }}>
                  Available Facilities
                </span>
                <div className={styles.facilitiesWrap}>
                  {building.facilities.map((fac, idx) => (
                    <span key={idx} className={styles.facilityTag}>
                      {fac}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Academic Laboratories & Specialized Rooms fetched from Atlas */}
        {(featuredLabs.length > 0 || roomsLoading) && (
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeadingWithAction}>
              <div className={styles.sectionHeading}>
                <span className={styles.sectionIcon}>🔬</span>
                <h3>Academic Laboratories &amp; Facilities</h3>
              </div>
              <span className={styles.labCountBadge}>
                {featuredLabs.length} Cataloged Labs
              </span>
            </div>

            <p className={styles.descText} style={{ marginBottom: '10px' }}>
              Specialized teaching laboratories and department facilities fetched from the campus database.
            </p>

            {roomsLoading ? (
              <div className={styles.labsLoadingBox}>
                <span>Loading latest laboratory records...</span>
              </div>
            ) : (
              <div className={styles.labListGrid}>
                {featuredLabs.map((lab) => {
                  const displayName = getRoomDisplayName(lab);
                  const roomNum = getRoomNumber(lab);

                  return (
                    <button
                      key={lab.roomNumber || lab.id}
                      onClick={() =>
                        onOpenRoomInspector &&
                        onOpenRoomInspector(resolvedBuildingId || 'BLD001', lab.roomNumber, lab.block || resolvedBlock)
                      }
                      className={styles.labCardBtn}
                      title={`Inspect ${displayName} (${roomNum})`}
                    >
                      <div className={styles.labCardLeft}>
                        <span className={styles.labRoomBadge}>{roomNum}</span>
                        <div className={styles.labCardInfo}>
                          <span className={styles.labCardName}>{displayName}</span>
                          <span className={styles.labCardMeta}>
                            Floor {lab.floorNumber} • {lab.roomType || 'Laboratory'}
                          </span>
                        </div>
                      </div>
                      <span className={styles.labActionHint}>Inspect &rarr;</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Telemetry & Sensor Information */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeading}>
            <span className={styles.sectionIcon}>📡</span>
            <h3>Sensors &amp; Telemetry Data</h3>
          </div>

          {building.hasTelemetry && building.liveTelemetry ? (
            <div className={styles.telemetryContent}>
              <div className={styles.kpiRow}>
                <div className={styles.kpiBox}>
                  <div className={styles.kpiValue}>
                    {building.liveTelemetry.occupancy?.totalCurrent || 0}
                  </div>
                  <div className={styles.kpiLabel}>Current Occupancy</div>
                  <div className={styles.kpiSub}>
                    of {building.liveTelemetry.occupancy?.totalCapacity || 0} Capacity
                  </div>
                </div>
                <div className={styles.kpiBox}>
                  <div className={styles.kpiValue}>
                    {building.liveTelemetry.occupancy?.utilization || 0}%
                  </div>
                  <div className={styles.kpiLabel}>Space Utilization</div>
                  <div className={styles.kpiSub}>Peak Academic Slot</div>
                </div>
                <div className={styles.kpiBox}>
                  <div className={styles.kpiValue}>
                    {building.liveTelemetry.monitoredRooms || 0}
                  </div>
                  <div className={styles.kpiLabel}>Monitored Rooms</div>
                  <div className={styles.kpiSub}>3 Physical Floors</div>
                </div>
              </div>

              <div className={styles.sensorList}>
                <div className={styles.sensorListTitle}>Configured IoT Nodes:</div>
                {building.sensorTypes.map((st, i) => (
                  <div key={i} className={styles.sensorItem}>
                    <span className={styles.sensorDot} />
                    <span>{st}</span>
                    <span className={styles.sensorStatus}>Online</span>
                  </div>
                ))}
              </div>

              {isAcademicBlock && onOpenRoomInspector && (
                <button
                  onClick={() => onOpenRoomInspector(resolvedBuildingId || 'BLD001', null, resolvedBlock)}
                  className={styles.inspectorBtn}
                >
                  <span>Open {resolvedBlock ? `Block ${resolvedBlock}` : 'Facility'} Room Level Digital Twin &amp; Timetables</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <div className={styles.emptyTelemetry}>
              <div className={styles.emptyIcon}>🛰️</div>
              <div className={styles.emptyTitle}>Passive Facility Monitoring</div>
              <p className={styles.emptySub}>
                This facility is currently tracked in standard campus monitoring mode. Live IoT telemetry,
                smart meters, and presence sensors have not yet been deployed to this building.
              </p>
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}

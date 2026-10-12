import { useState, useEffect, useMemo, useCallback } from 'react';
import { getBuilding, getRooms, getTimetables } from '../../api/client';
import styles from './RoomInfoPanel.module.css';

export default function RoomInfoPanel({
  buildingId = 'BLD001',
  selectedRoomNumber,
  onSelectRoom,
  onClose,
}) {
  // Building state
  const [building, setBuilding] = useState(null);
  const [buildingLoading, setBuildingLoading] = useState(true);
  const [buildingError, setBuildingError] = useState(null);

  // Rooms state
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState(null);

  // Floor navigation state (0 = Ground Floor, 1 = 1st Floor, 2 = 2nd Floor)
  const [selectedFloor, setSelectedFloor] = useState(0);

  // Timetable state for selected room
  const [timetables, setTimetables] = useState([]);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [timetableError, setTimetableError] = useState(null);

  // 1. Fetch building details from API
  const loadBuilding = useCallback(async () => {
    setBuildingLoading(true);
    setBuildingError(null);
    try {
      const res = await getBuilding(buildingId);
      if (res?.success && res.data) {
        setBuilding(res.data);
      } else {
        throw new Error(res?.error || 'Failed to load building data');
      }
    } catch (err) {
      console.error('API Error [getBuilding]:', err);
      setBuildingError(err.response?.data?.error || err.message || 'API connection failed');
    } finally {
      setBuildingLoading(false);
    }
  }, [buildingId]);

  // 2. Fetch all Block C rooms from API
  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    setRoomsError(null);
    try {
      const res = await getRooms({ buildingId, block: 'C' });
      if (res?.success && Array.isArray(res.data)) {
        setRooms(res.data);
        // If rooms exist and selectedFloor is not set or empty, set to first available floor
        if (res.data.length > 0) {
          const floors = Array.from(new Set(res.data.map((r) => r.floorNumber))).sort((a, b) => a - b);
          if (!floors.includes(selectedFloor)) {
            setSelectedFloor(floors[0]);
          }
        }
      } else {
        throw new Error(res?.error || 'Failed to load rooms list');
      }
    } catch (err) {
      console.error('API Error [getRooms]:', err);
      setRoomsError(err.response?.data?.error || err.message || 'API connection failed');
    } finally {
      setRoomsLoading(false);
    }
  }, [buildingId, selectedFloor]);

  // Initial load
  useEffect(() => {
    loadBuilding();
    loadRooms();
  }, [loadBuilding, loadRooms]);

  // 3. Fetch Timetable when a room is selected
  useEffect(() => {
    if (!selectedRoomNumber) {
      setTimetables([]);
      setTimetableError(null);
      setTimetableLoading(false);
      return;
    }

    let isMounted = true;
    setTimetableLoading(true);
    setTimetableError(null);

    getTimetables({ room: selectedRoomNumber })
      .then((res) => {
        if (!isMounted) return;
        if (res?.success && Array.isArray(res.data)) {
          setTimetables(res.data);
        } else {
          setTimetables([]);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('API Error [getTimetables]:', err);
        setTimetableError(err.response?.data?.error || err.message || 'Failed to load schedule');
        setTimetables([]);
      })
      .finally(() => {
        if (isMounted) setTimetableLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRoomNumber]);

  // Available floors dynamically detected from live records
  const availableFloors = useMemo(() => {
    if (!rooms.length) return [0, 1, 2];
    const set = new Set(rooms.map((r) => r.floorNumber));
    return Array.from(set).sort((a, b) => a - b);
  }, [rooms]);

  // Floor label formatter
  const getFloorName = (fn) => {
    if (fn === 0) return 'Ground (GF)';
    if (fn === 1) return '1st Floor';
    if (fn === 2) return '2nd Floor';
    if (fn === 3) return '3rd Floor';
    return `Floor ${fn}`;
  };

  // Currently selected room object
  const currentRoom = useMemo(() => {
    if (!selectedRoomNumber) return null;
    return rooms.find((r) => r.roomNumber.toLowerCase() === selectedRoomNumber.toLowerCase()) || null;
  }, [rooms, selectedRoomNumber]);

  // Filtered rooms on current floor
  const floorRooms = useMemo(() => {
    return rooms.filter((r) => r.floorNumber === selectedFloor);
  }, [rooms, selectedFloor]);

  // ── Render Loading State ──
  if (buildingLoading || roomsLoading) {
    return (
      <aside className={styles.panel} id="room-info-panel">
        <div className={styles.loadingBox}>
          <span className={styles.spinner} />
          <p className={styles.loadingText}>Fetching Block C inventory from Atlas...</p>
        </div>
      </aside>
    );
  }

  // ── Render Error State ──
  if (buildingError || roomsError) {
    return (
      <aside className={styles.panel} id="room-info-panel">
        <div className={styles.errorBox}>
          <span className={styles.errorIcon}>⚠️</span>
          <h3 className={styles.errorTitle}>API Connection Error</h3>
          <p className={styles.errorDesc}>{buildingError || roomsError}</p>
          <button
            onClick={() => {
              loadBuilding();
              loadRooms();
            }}
            className={styles.retryBtn}
          >
            Retry Connection
          </button>
        </div>
      </aside>
    );
  }

  // ── View A: Single Room Selected ──
  if (currentRoom) {
    return (
      <aside className={styles.panel} id="room-info-panel">
        {/* Back / Navigation Action */}
        <div className={styles.panelTopNav}>
          <button
            onClick={() => onSelectRoom && onSelectRoom(null)}
            className={styles.backBtn}
            title="Return to floor room list"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Back to Room List</span>
          </button>

          {onClose && (
            <button onClick={onClose} className={styles.closeBtn} title="Close Panel">
              ✕
            </button>
          )}
        </div>

        {/* Room Header */}
        <div className={styles.header}>
          <span className={styles.roomBadge}>{currentRoom.roomNumber}</span>
          <div className={styles.headerInfo}>
            <h2 className={styles.title}>{currentRoom.roomNumber}</h2>
            <p className={styles.subtitle}>{currentRoom.roomType}</p>
          </div>
        </div>

        <div className={styles.divider} />

        {/* Room Metadata Grid */}
        <div className={styles.metaGrid}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Building</span>
            <span className={styles.metaValue}>{building?.buildingName || 'Main Building'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Block</span>
            <span className={styles.metaValue}>{currentRoom.block}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Floor</span>
            <span className={styles.metaValue}>{getFloorName(currentRoom.floorNumber)}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Status</span>
            <span className={styles.metaValue} style={{ color: '#10b981' }}>{currentRoom.status}</span>
          </div>
        </div>

        <div className={styles.divider} />

        {/* Timetable Section */}
        <div className={styles.sectionHeaderRow}>
          <span className={styles.sectionLabel}>Timetable Schedule</span>
          {timetables.length > 0 && (
            <span className={styles.countBadge}>{timetables.length} Slots</span>
          )}
        </div>

        {timetableLoading ? (
          <div className={styles.ttLoadingBox}>
            <span className={styles.spinnerSm} />
            <span>Loading schedule...</span>
          </div>
        ) : timetableError ? (
          <div className={styles.ttErrorBox}>
            <p className={styles.errorTextSm}>{timetableError}</p>
            <button
              onClick={() => {
                setTimetableLoading(true);
                getTimetables({ room: selectedRoomNumber })
                  .then((res) => setTimetables(res?.data || []))
                  .catch((e) => setTimetableError(e.message))
                  .finally(() => setTimetableLoading(false));
              }}
              className={styles.retryBtnSm}
            >
              Retry
            </button>
          </div>
        ) : timetables.length > 0 ? (
          <div className={styles.timetableList}>
            {timetables.map((slot) => (
              <div key={slot._id} className={styles.timetableCard}>
                <div className={styles.ttTop}>
                  <span className={styles.ttDay}>{slot.day}</span>
                  <span className={styles.ttSlotPill}>
                    Slot {slot.slotStart}{slot.slotEnd !== slot.slotStart ? `–${slot.slotEnd}` : ''}
                  </span>
                </div>
                <div className={styles.ttSubject}>{slot.subject}</div>
                <div className={styles.ttBottom}>
                  <span className={styles.ttType}>{slot.type || 'Lecture'}</span>
                  <span className={styles.ttSection}>{slot.sectionId}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.noData}>No timetable data available for this room.</p>
        )}
      </aside>
    );
  }

  // ── View B: Building & Floor Room Inventory Overview ──
  return (
    <aside className={styles.panel} id="room-info-panel">
      {/* Panel Header */}
      <div className={styles.header}>
        <div className={styles.buildingIcon}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="3 9 12 2 21 9 21 20 3 20" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div className={styles.headerInfo}>
          <h2 className={styles.title}>Block C</h2>
          <p className={styles.subtitle}>{building?.buildingName || 'Main Building'} ({buildingId})</p>
        </div>

        {onClose && (
          <button onClick={onClose} className={styles.closeBtn} title="Close Panel">
            ✕
          </button>
        )}
      </div>

      <div className={styles.divider} />

      {/* Building Summary Metadata */}
      <div className={styles.metaGrid}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Total Block C Rooms</span>
          <span className={styles.metaValue}>{rooms.length}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Floors</span>
          <span className={styles.metaValue}>{availableFloors.length} (GF, 1F, 2F)</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Building Type</span>
          <span className={styles.metaValue}>{building?.buildingType || 'Academic'}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Status</span>
          <span className={styles.metaValue} style={{ color: '#10b981' }}>{building?.status || 'Active'}</span>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Floor Tab Selector */}
      <div className={styles.sectionHeaderRow}>
        <span className={styles.sectionLabel}>Select Floor</span>
        <span className={styles.countBadge}>{floorRooms.length} Rooms</span>
      </div>

      <div className={styles.floorTabs}>
        {availableFloors.map((fn) => {
          const count = rooms.filter((r) => r.floorNumber === fn).length;
          return (
            <button
              key={fn}
              onClick={() => setSelectedFloor(fn)}
              className={`${styles.floorTab} ${selectedFloor === fn ? styles.floorTabActive : ''}`}
            >
              <span>{getFloorName(fn)}</span>
              <span className={styles.floorBadge}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Room Inventory List on Current Floor */}
      <div className={styles.roomList}>
        {floorRooms.length > 0 ? (
          floorRooms.map((r) => (
            <button
              key={r.roomNumber}
              onClick={() => onSelectRoom && onSelectRoom(r.roomNumber)}
              className={styles.roomItemBtn}
            >
              <div className={styles.roomItemLeft}>
                <span className={styles.roomNumBadge}>{r.roomNumber}</span>
                <div className={styles.roomItemDetails}>
                  <span className={styles.roomTypeName}>{r.roomType}</span>
                  <span className={styles.roomBlockTag}>Floor {r.floorNumber}</span>
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={styles.chevronIcon}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))
        ) : (
          <p className={styles.noData}>No rooms mapped for this floor.</p>
        )}
      </div>

      <div className={styles.hint}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>Click any room to view live schedule &amp; timetable details</span>
      </div>
    </aside>
  );
}

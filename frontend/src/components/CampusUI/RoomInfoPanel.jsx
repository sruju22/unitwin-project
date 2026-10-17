import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Hls from 'hls.js';
import {
  getBuilding,
  getRooms,
  getRoom,
  getTimetables,
  startCameraStream,
  stopCameraStream,
  sendCameraHeartbeat,
  getCameraStreamUrl,
} from '../../api/client';
import {
  getRoomDisplayName,
  formatRoomSubtitle,
  getRoomNumber,
  isLaboratory,
  isRoomPreviewExcluded,
} from '../../utils/roomUtils';
import styles from './RoomInfoPanel.module.css';

/**
 * Architectural vector schematic for a Smart Classroom or Standard Classroom.
 */
function ClassroomSchematic({ roomNumber = 'C-101' }) {
  return (
    <svg viewBox="0 0 500 240" className={styles.schematicSvg} style={{ width: '100%', height: '100%' }}>
      {/* Grid background */}
      <defs>
        <pattern id="classGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="500" height="240" fill="url(#classGrid)" rx="6" />

      {/* Exterior wall boundary */}
      <rect x="20" y="15" width="460" height="210" fill="#ffffff" stroke="#1e293b" strokeWidth="2.5" rx="4" />

      {/* Front Presentation Wall & Smart Board */}
      <rect x="150" y="22" width="200" height="8" fill="#2563eb" rx="2" />
      <text x="250" y="42" fill="#1e40af" fontSize="10" fontWeight="700" textAnchor="middle" letterSpacing="1">
        INTERACTIVE SMART BOARD / DISPLAY WALL
      </text>

      {/* Teacher Podium / Console */}
      <rect x="225" y="52" width="50" height="22" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.2" rx="3" />
      <text x="250" y="66" fill="#1e3a8a" fontSize="8" fontWeight="600" textAnchor="middle">INSTRUCTOR</text>

      {/* Ceiling Sensor Node (PIR Presence + Telemetry) */}
      <circle cx="250" cy="120" r="32" fill="none" stroke="rgba(16, 185, 129, 0.35)" strokeWidth="1" strokeDasharray="3 3" />
      <circle cx="250" cy="120" r="4" fill="#10b981" />
      <text x="250" y="112" fill="#047857" fontSize="7.5" fontWeight="600" textAnchor="middle">PIR PRESENCE SENSOR</text>

      {/* Student Seating Desks (2 Columns of 3 rows) */}
      {/* Left Column */}
      <g>
        {/* Row 1 */}
        <rect x="60" y="90" width="140" height="22" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" rx="2" />
        <rect x="75" y="115" width="30" height="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" rx="1" />
        <rect x="145" y="115" width="30" height="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" rx="1" />

        {/* Row 2 */}
        <rect x="60" y="135" width="140" height="22" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" rx="2" />
        <rect x="75" y="160" width="30" height="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" rx="1" />
        <rect x="145" y="160" width="30" height="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" rx="1" />

        {/* Row 3 */}
        <rect x="60" y="180" width="140" height="22" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" rx="2" />
        <rect x="75" y="205" width="30" height="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" rx="1" />
        <rect x="145" y="205" width="30" height="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" rx="1" />
      </g>

      {/* Center Aisle */}
      <line x1="250" y1="80" x2="250" y2="215" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />
      <text x="250" y="165" fill="#64748b" fontSize="8" fontWeight="600" textAnchor="middle" letterSpacing="0.5">CENTRAL AISLE</text>

      {/* Right Column */}
      <g>
        {/* Row 1 */}
        <rect x="300" y="90" width="140" height="22" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" rx="2" />
        <rect x="315" y="115" width="30" height="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" rx="1" />
        <rect x="385" y="115" width="30" height="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" rx="1" />

        {/* Row 2 */}
        <rect x="300" y="135" width="140" height="22" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" rx="2" />
        <rect x="315" y="160" width="30" height="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" rx="1" />
        <rect x="385" y="160" width="30" height="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" rx="1" />

        {/* Row 3 */}
        <rect x="300" y="180" width="140" height="22" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" rx="2" />
        <rect x="315" y="205" width="30" height="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" rx="1" />
        <rect x="385" y="205" width="30" height="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" rx="1" />
      </g>

      {/* Entry Doorway with Swing Arc (Bottom-Left) */}
      <path d="M 20 185 A 35 35 0 0 1 55 220" fill="none" stroke="#d97706" strokeWidth="1.2" strokeDasharray="2 2" />
      <line x1="20" y1="185" x2="55" y2="185" stroke="#d97706" strokeWidth="2" />
      <text x="32" y="178" fill="#b45309" fontSize="7.5" fontWeight="700">DOOR</text>

      {/* Windows along Right Wall */}
      <line x1="480" y1="60" x2="480" y2="100" stroke="#2563eb" strokeWidth="3" />
      <line x1="480" y1="130" x2="480" y2="170" stroke="#2563eb" strokeWidth="3" />
      <text x="472" y="115" fill="#2563eb" fontSize="7" fontWeight="600" textAnchor="end">EXTERIOR WINDOWS</text>

      {/* Room Stamp */}
      <rect x="30" y="24" width="85" height="18" fill="#f1f5f9" stroke="#cbd5e1" rx="3" />
      <text x="72" y="36" fill="#334155" fontSize="8" fontWeight="700" textAnchor="middle">{roomNumber} · BLUEPRINT</text>
    </svg>
  );
}

/**
 * Specialized vector schematic for a Laboratory or Practical Facility.
 */
function LaboratorySchematic({ roomNumber = 'C-108', labName = 'Laboratory' }) {
  return (
    <svg viewBox="0 0 500 240" className={styles.schematicSvg} style={{ width: '100%', height: '100%' }}>
      <defs>
        <pattern id="labGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="500" height="240" fill="url(#labGrid)" rx="6" />

      {/* Exterior wall */}
      <rect x="20" y="15" width="460" height="210" fill="#ffffff" stroke="#1e293b" strokeWidth="2.5" rx="4" />

      {/* Front Demonstration Bench */}
      <rect x="140" y="24" width="220" height="26" fill="#eef2ff" stroke="#6366f1" strokeWidth="1.5" rx="3" />
      <text x="250" y="40" fill="#3730a3" fontSize="9" fontWeight="700" textAnchor="middle">
        INSTRUCTOR DEMO CONSOLE &amp; MASTER POWER TERMINAL
      </text>

      {/* Workstation Benches (4 Modular Lab Islands) */}
      {/* Bench 1 (Top Left) */}
      <g>
        <rect x="50" y="70" width="165" height="36" fill="#f8fafc" stroke="#6366f1" strokeWidth="1.2" rx="3" />
        <rect x="55" y="75" width="30" height="12" fill="#e0e7ff" stroke="#818cf8" strokeWidth="0.8" rx="1" />
        <rect x="115" y="75" width="30" height="12" fill="#e0e7ff" stroke="#818cf8" strokeWidth="0.8" rx="1" />
        <rect x="175" y="75" width="30" height="12" fill="#e0e7ff" stroke="#818cf8" strokeWidth="0.8" rx="1" />
        <text x="132" y="99" fill="#475569" fontSize="7.5" fontWeight="600" textAnchor="middle">STATION 1-3 · POWER RAILS</text>
      </g>

      {/* Bench 2 (Top Right) */}
      <g>
        <rect x="285" y="70" width="165" height="36" fill="#f8fafc" stroke="#6366f1" strokeWidth="1.2" rx="3" />
        <rect x="290" y="75" width="30" height="12" fill="#e0e7ff" stroke="#818cf8" strokeWidth="0.8" rx="1" />
        <rect x="350" y="75" width="30" height="12" fill="#e0e7ff" stroke="#818cf8" strokeWidth="0.8" rx="1" />
        <rect x="410" y="75" width="30" height="12" fill="#e0e7ff" stroke="#818cf8" strokeWidth="0.8" rx="1" />
        <text x="367" y="99" fill="#475569" fontSize="7.5" fontWeight="600" textAnchor="middle">STATION 4-6 · POWER RAILS</text>
      </g>

      {/* Bench 3 (Bottom Left) */}
      <g>
        <rect x="50" y="135" width="165" height="36" fill="#f8fafc" stroke="#6366f1" strokeWidth="1.2" rx="3" />
        <rect x="55" y="140" width="30" height="12" fill="#e0e7ff" stroke="#818cf8" strokeWidth="0.8" rx="1" />
        <rect x="115" y="140" width="30" height="12" fill="#e0e7ff" stroke="#818cf8" strokeWidth="0.8" rx="1" />
        <rect x="175" y="140" width="30" height="12" fill="#e0e7ff" stroke="#818cf8" strokeWidth="0.8" rx="1" />
        <text x="132" y="164" fill="#475569" fontSize="7.5" fontWeight="600" textAnchor="middle">STATION 7-9 · INSTRUMENTS</text>
      </g>

      {/* Bench 4 (Bottom Right) */}
      <g>
        <rect x="285" y="135" width="165" height="36" fill="#f8fafc" stroke="#6366f1" strokeWidth="1.2" rx="3" />
        <rect x="290" y="140" width="30" height="12" fill="#e0e7ff" stroke="#818cf8" strokeWidth="0.8" rx="1" />
        <rect x="350" y="140" width="30" height="12" fill="#e0e7ff" stroke="#818cf8" strokeWidth="0.8" rx="1" />
        <rect x="410" y="140" width="30" height="12" fill="#e0e7ff" stroke="#818cf8" strokeWidth="0.8" rx="1" />
        <text x="367" y="164" fill="#475569" fontSize="7.5" fontWeight="600" textAnchor="middle">STATION 10-12 · INSTRUMENTS</text>
      </g>

      {/* Safety & Emergency Station (Bottom Center) */}
      <rect x="200" y="190" width="100" height="24" fill="#fef2f2" stroke="#ef4444" strokeWidth="1.2" rx="3" />
      <text x="250" y="202" fill="#b91c1c" fontSize="8" fontWeight="700" textAnchor="middle">EMERGENCY SHUTOFF</text>
      <text x="250" y="210" fill="#dc2626" fontSize="6.5" textAnchor="middle">CO2 Extinguisher &amp; First Aid</text>

      {/* Doorway */}
      <path d="M 20 185 A 35 35 0 0 1 55 220" fill="none" stroke="#d97706" strokeWidth="1.2" strokeDasharray="2 2" />
      <line x1="20" y1="185" x2="55" y2="185" stroke="#d97706" strokeWidth="2" />
      <text x="32" y="178" fill="#b45309" fontSize="7.5" fontWeight="700">ENTRY</text>

      {/* Stamp */}
      <rect x="30" y="24" width="115" height="18" fill="#f1f5f9" stroke="#cbd5e1" rx="3" />
      <text x="87" y="36" fill="#334155" fontSize="8" fontWeight="700" textAnchor="middle">{roomNumber} · {labName ? 'LAB SCHEMATIC' : 'LABORATORY'}</text>
    </svg>
  );
}

/**
 * Vector schematic for Academic Staff Rooms and Offices.
 */
function StaffRoomSchematic({ roomNumber = 'C-106' }) {
  return (
    <svg viewBox="0 0 500 240" className={styles.schematicSvg} style={{ width: '100%', height: '100%' }}>
      <defs>
        <pattern id="officeGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="500" height="240" fill="url(#officeGrid)" rx="6" />

      {/* Exterior wall */}
      <rect x="20" y="15" width="460" height="210" fill="#ffffff" stroke="#1e293b" strokeWidth="2.5" rx="4" />

      {/* Faculty Workstation Cubicles */}
      <g>
        <rect x="50" y="40" width="90" height="65" fill="#faf5ff" stroke="#a855f7" strokeWidth="1" rx="3" />
        <rect x="65" y="80" width="30" height="15" fill="#f3e8ff" stroke="#d8b4fe" strokeWidth="0.8" rx="2" />
        <text x="95" y="60" fill="#7e22ce" fontSize="8" fontWeight="600" textAnchor="middle">CUBICLE 1</text>

        <rect x="160" y="40" width="90" height="65" fill="#faf5ff" stroke="#a855f7" strokeWidth="1" rx="3" />
        <rect x="175" y="80" width="30" height="15" fill="#f3e8ff" stroke="#d8b4fe" strokeWidth="0.8" rx="2" />
        <text x="205" y="60" fill="#7e22ce" fontSize="8" fontWeight="600" textAnchor="middle">CUBICLE 2</text>

        <rect x="50" y="130" width="90" height="65" fill="#faf5ff" stroke="#a855f7" strokeWidth="1" rx="3" />
        <rect x="65" y="170" width="30" height="15" fill="#f3e8ff" stroke="#d8b4fe" strokeWidth="0.8" rx="2" />
        <text x="95" y="150" fill="#7e22ce" fontSize="8" fontWeight="600" textAnchor="middle">CUBICLE 3</text>

        <rect x="160" y="130" width="90" height="65" fill="#faf5ff" stroke="#a855f7" strokeWidth="1" rx="3" />
        <rect x="175" y="170" width="30" height="15" fill="#f3e8ff" stroke="#d8b4fe" strokeWidth="0.8" rx="2" />
        <text x="205" y="150" fill="#7e22ce" fontSize="8" fontWeight="600" textAnchor="middle">CUBICLE 4</text>
      </g>

      {/* Central Advisement & Meeting Table */}
      <rect x="290" y="60" width="150" height="85" fill="#f0f9ff" stroke="#0284c7" strokeWidth="1.2" rx="6" />
      <text x="365" y="98" fill="#0369a1" fontSize="9" fontWeight="700" textAnchor="middle">DEPARTMENTAL</text>
      <text x="365" y="110" fill="#0284c7" fontSize="8" fontWeight="600" textAnchor="middle">CONSULTATION DESK</text>

      {/* Shared Network Printer / Archive */}
      <rect x="330" y="165" width="70" height="35" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" rx="3" />
      <text x="365" y="186" fill="#475569" fontSize="7.5" fontWeight="600" textAnchor="middle">ARCHIVE &amp; PRINT</text>

      {/* Doorway */}
      <path d="M 20 185 A 35 35 0 0 1 55 220" fill="none" stroke="#d97706" strokeWidth="1.2" strokeDasharray="2 2" />
      <line x1="20" y1="185" x2="55" y2="185" stroke="#d97706" strokeWidth="2" />
      <text x="32" y="178" fill="#b45309" fontSize="7.5" fontWeight="700">ACCESS</text>

      {/* Stamp */}
      <rect x="30" y="22" width="115" height="16" fill="#f1f5f9" stroke="#cbd5e1" rx="3" />
      <text x="87" y="33" fill="#334155" fontSize="7.5" fontWeight="700" textAnchor="middle">{roomNumber} · FACULTY CHAMBERS</text>
    </svg>
  );
}

export default function RoomInfoPanel({
  buildingId = 'BLD001',
  block,
  selectedRoomNumber,
  onSelectRoom,
  onClose,
}) {
  // Resolve active block dynamically
  const currentBlock = useMemo(() => {
    if (block) return block.toUpperCase();
    if (selectedRoomNumber && /^[a-zA-Z]/.test(selectedRoomNumber)) {
      return selectedRoomNumber.charAt(0).toUpperCase();
    }
    return 'C';
  }, [block, selectedRoomNumber]);

  // Building state
  const [building, setBuilding] = useState(null);
  const [buildingLoading, setBuildingLoading] = useState(true);
  const [buildingError, setBuildingError] = useState(null);

  // Rooms state
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState(null);

  // Floor navigation state
  const [selectedFloor, setSelectedFloor] = useState(0);

  // Timetable state
  const [timetables, setTimetables] = useState([]);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [timetableError, setTimetableError] = useState(null);

  // Timetable day filter tab: 'ALL' | 'Monday' | 'Tuesday' | etc.
  const [selectedDay, setSelectedDay] = useState('ALL');

  // C-110 Live Camera View state & refs
  const [isLiveViewActive, setIsLiveViewActive] = useState(false);
  const [cameraState, setCameraState] = useState('idle'); // 'idle' | 'starting' | 'live' | 'error'
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const clientIdRef = useRef('c110_client_' + Math.random().toString(36).substring(2, 9));

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

  // 2. Fetch rooms from API
  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    setRoomsError(null);
    try {
      const params = { buildingId };
      if (buildingId === 'BLD001') {
        params.block = currentBlock;
      }
      const res = await getRooms(params);
      let loaded = res?.success && Array.isArray(res.data) ? res.data : [];

      // If a specific room was passed and is not yet in the list, fetch it directly
      if (selectedRoomNumber) {
        const cleanTarget = selectedRoomNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
        const found = loaded.some(
          (r) => (r.roomNumber || r.id || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget
        );
        if (!found) {
          try {
            const singleRes = await getRoom(selectedRoomNumber);
            if (singleRes?.success && singleRes.data) {
              loaded = [singleRes.data, ...loaded];
            }
          } catch {
            // Standalone room fallback
          }
        }
      }

      setRooms(loaded);

      // Align selected floor with selected room if available
      if (loaded.length > 0) {
        const cleanTarget = selectedRoomNumber
          ? selectedRoomNumber.toLowerCase().replace(/[^a-z0-9]/g, '')
          : null;
        const targetRoom = cleanTarget
          ? loaded.find(
              (r) => (r.roomNumber || r.id || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget
            )
          : null;

        if (targetRoom && targetRoom.floorNumber !== undefined) {
          setSelectedFloor(targetRoom.floorNumber);
        } else {
          const floors = Array.from(new Set(loaded.map((r) => r.floorNumber))).sort((a, b) => a - b);
          if (!floors.includes(selectedFloor)) {
            setSelectedFloor(floors[0]);
          }
        }
      }
    } catch (err) {
      console.error('API Error [getRooms]:', err);
      setRoomsError(err.response?.data?.error || err.message || 'API connection failed');
    } finally {
      setRoomsLoading(false);
    }
  }, [buildingId, selectedRoomNumber, currentBlock, selectedFloor]);

  // Initial load
  useEffect(() => {
    loadBuilding();
    loadRooms();
  }, [loadBuilding, loadRooms]);

  // 3. Fetch Timetable when a room is selected
  useEffect(() => {
    setSelectedDay('ALL');
    setIsLiveViewActive(false);

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
    if (!rooms.length) return currentBlock === 'A' ? [1, 2, 3] : [0, 1, 2];
    const set = new Set(rooms.map((r) => r.floorNumber));
    return Array.from(set).sort((a, b) => a - b);
  }, [rooms, currentBlock]);

  // Floor label formatter
  const getFloorName = (fn) => {
    if (fn === 0) return 'Ground Floor (GF)';
    if (fn === 1) return '1st Floor';
    if (fn === 2) return '2nd Floor';
    if (fn === 3) return '3rd Floor';
    return `Floor ${fn}`;
  };

  // Currently selected room object
  const currentRoom = useMemo(() => {
    if (!selectedRoomNumber) return null;
    const cleanSel = selectedRoomNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
    return (
      rooms.find((r) => {
        const cleanR = (r.roomNumber || r.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanR === cleanSel || (r.roomNumber && r.roomNumber.toLowerCase() === selectedRoomNumber.toLowerCase());
      }) || null
    );
  }, [rooms, selectedRoomNumber]);

  // Filtered rooms on current floor
  const floorRooms = useMemo(() => {
    return rooms.filter((r) => r.floorNumber === selectedFloor);
  }, [rooms, selectedFloor]);

  // Check if room is excluded from preview (hostel rooms & washrooms)
  const isExcluded = useMemo(() => {
    return isRoomPreviewExcluded(currentRoom);
  }, [currentRoom]);

  // Check if C-110 Smart Classroom
  const isC110 = useMemo(() => {
    if (!currentRoom) return false;
    const num = getRoomNumber(currentRoom).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return num === 'C110';
  }, [currentRoom]);

  // Check room category flags
  const isLab = useMemo(() => isLaboratory(currentRoom), [currentRoom]);
  const isSmart = useMemo(() => {
    const type = String(currentRoom?.roomType || '').toLowerCase();
    return type.includes('smart');
  }, [currentRoom]);
  const isOffice = useMemo(() => {
    const type = String(currentRoom?.roomType || '').toLowerCase();
    return (
      type.includes('staff') ||
      type.includes('office') ||
      type.includes('cabin') ||
      type.includes('dean') ||
      type.includes('hod')
    );
  }, [currentRoom]);
  const isWashroom = useMemo(() => {
    const type = String(currentRoom?.roomType || '').toLowerCase();
    return type.includes('washroom') || type.includes('toilet');
  }, [currentRoom]);
  const isHostel = useMemo(() => {
    const type = String(currentRoom?.roomType || '').toLowerCase();
    const bldId = String(currentRoom?.buildingId || '').toUpperCase();
    return type.includes('hostel') || ['BLD006', 'BLD007', 'BLD008', 'BLD009'].includes(bldId);
  }, [currentRoom]);

  // Dynamic days present in timetable
  const timetableDays = useMemo(() => {
    if (!timetables || timetables.length === 0) return [];
    const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const present = new Set(timetables.map((s) => s.day));
    return order.filter((d) => present.has(d));
  }, [timetables]);

  // Filtered timetable slots by selectedDay
  const filteredTimetables = useMemo(() => {
    if (!timetables) return [];
    if (selectedDay === 'ALL') return timetables;
    return timetables.filter((s) => s.day === selectedDay);
  }, [timetables, selectedDay]);

  // Reset live view state when leaving C-110
  useEffect(() => {
    if (!isC110 && isLiveViewActive) {
      setIsLiveViewActive(false);
    }
  }, [isC110, isLiveViewActive]);

  // C-110 CP PLUS Live Camera Stream lifecycle orchestration
  useEffect(() => {
    // If not in C-110 or live view is turned off, cleanup stream resources
    if (!isC110 || !isLiveViewActive) {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      if (isC110) {
        stopCameraStream('c110', clientIdRef.current).catch(() => {});
      }
      setCameraState('idle');
      setCameraError(null);
      return;
    }

    let isMounted = true;
    setCameraState('starting');
    setCameraError(null);

    const initStream = async () => {
      try {
        const status = await startCameraStream('c110', clientIdRef.current);
        if (!isMounted) return;

        if (status.state === 'error' || status.error) {
          throw new Error(status.error || 'Failed to initialize camera RTSP stream.');
        }

        const streamUrl = getCameraStreamUrl('c110');
        const video = videoRef.current;

        if (!video) {
          throw new Error('Video player element not found.');
        }

        // Native HLS support (Safari/iOS)
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = streamUrl;
          video.play().catch((err) => {
            console.warn('Native video autoplay thwarted:', err);
          });
          setCameraState('live');
        } else if (Hls.isSupported()) {
          if (hlsRef.current) {
            hlsRef.current.destroy();
          }

          const hls = new Hls({
            liveSyncDurationCount: 3,
            maxLiveSyncPlaybackRate: 1.5,
            enableWorker: true,
            lowLatencyMode: true,
          });

          hlsRef.current = hls;
          hls.loadSource(streamUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!isMounted) return;
            setCameraState('live');
            video.play().catch((err) => {
              console.warn('HLS autoplay thwarted:', err);
            });
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.warn('HLS stream error:', data);
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  hls.destroy();
                  if (isMounted) {
                    setCameraState('error');
                    setCameraError('Live stream playback encountered a fatal error. Please retry.');
                  }
                  break;
              }
            }
          });
        } else {
          throw new Error('HLS playback is not supported in this browser.');
        }

        // Start heartbeat to keep stream alive
        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
        }
        heartbeatTimerRef.current = setInterval(() => {
          sendCameraHeartbeat('c110', clientIdRef.current).catch(() => {});
        }, 8000);

      } catch (err) {
        if (!isMounted) return;
        console.error('Camera stream initiation error:', err);
        setCameraState('error');
        setCameraError(err.message || 'Unable to connect to CP PLUS camera.');
      }
    };

    initStream();

    const activeVideo = videoRef.current;
    const activeClientId = clientIdRef.current;

    return () => {
      isMounted = false;
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (activeVideo) {
        activeVideo.pause();
        activeVideo.removeAttribute('src');
        activeVideo.load();
      }
      stopCameraStream('c110', activeClientId).catch(() => {});
    };
  }, [isC110, isLiveViewActive]);

  const handleRetryStream = useCallback(() => {
    setIsLiveViewActive(false);
    setTimeout(() => {
      setIsLiveViewActive(true);
    }, 150);
  }, []);

  // ── Render Loading State ──
  if (buildingLoading || roomsLoading) {
    return (
      <div className={styles.container} id="room-info-panel">
        <div className={styles.loadingBox}>
          <span className={styles.spinner} />
          <p style={{ color: '#475569', fontSize: '0.9rem', fontWeight: 600 }}>
            Loading Block {currentBlock} inventory from database...
          </p>
        </div>
      </div>
    );
  }

  // ── Render Error State ──
  if (buildingError || roomsError) {
    return (
      <div className={styles.container} id="room-info-panel">
        <div className={styles.errorBox}>
          <span style={{ fontSize: '2rem' }}>⚠️</span>
          <h3 style={{ color: '#f87171', margin: 0 }}>API Connection Error</h3>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>{buildingError || roomsError}</p>
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
      </div>
    );
  }

  // ── VIEW A: SINGLE ROOM INSPECTION ──
  if (currentRoom) {
    const roomNum = getRoomNumber(currentRoom);
    const roomDisplayName = getRoomDisplayName(currentRoom);
    const roomSubtitle = formatRoomSubtitle(currentRoom);
    const resolvedBuildingName = building?.name || building?.buildingName || 'Academic Complex';

    return (
      <div className={styles.container} id="room-info-panel">
        {/* 1. UNIFIED INSPECTION HEADER */}
        <header className={styles.headerBar}>
          <div className={styles.headerLeft}>
            <span className={styles.roomBadgeLarge}>{roomNum}</span>
            <div className={styles.headerTitleBlock}>
              <h2 className={styles.headerTitle} title={roomDisplayName}>
                {roomDisplayName}
              </h2>
              {roomSubtitle && roomSubtitle !== roomDisplayName && (
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                  {roomSubtitle}
                </span>
              )}
              <div className={styles.metaBadgesRow}>
                {/* Type Badge */}
                <span
                  className={`${styles.metaPill} ${
                    isSmart
                      ? styles.typePillSmart
                      : isLab
                      ? styles.typePillLab
                      : isOffice
                      ? styles.typePillOffice
                      : isWashroom
                      ? styles.typePillWashroom
                      : isHostel
                      ? styles.typePillHostel
                      : styles.typePillClassroom
                  }`}
                >
                  {currentRoom.roomType || 'Space'}
                </span>

                {/* Building / Block Pill */}
                <span className={styles.metaPill}>
                  {resolvedBuildingName} · Block {currentRoom.block || currentBlock}
                </span>

                {/* Floor Pill */}
                <span className={styles.metaPill}>
                  {getFloorName(currentRoom.floorNumber)}
                </span>

                {/* Operational Status */}
                <span className={`${styles.metaPill} ${styles.statusPillActive}`}>
                  <span className={styles.statusDot} />
                  <span>{currentRoom.status || 'Active'}</span>
                </span>
              </div>
            </div>
          </div>

          <div className={styles.headerRight}>
            <button
              type="button"
              onClick={() => onSelectRoom && onSelectRoom(null)}
              className={styles.navBackBtn}
              title="Return to floor room list"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>Back to Room List</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className={styles.navCloseBtn}
                title="Exit to Campus Map"
              >
                <span>Back to Campus Map</span>
                <span style={{ fontSize: '1rem', fontWeight: 700 }}>&times;</span>
              </button>
            )}
          </div>
        </header>

        {/* 2. INSPECTION BODY */}
        {isExcluded ? (
          /* CASE A: EXCLUDED ROOM TYPES (Washrooms & Hostel Rooms) — FULL WIDTH GRID */
          <div className={styles.fullWidthGrid}>
            {isWashroom ? (
              <>
                {/* Washroom Card 1: Facility Profile */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <span>🚻</span> Sanitation Facility Profile
                    </span>
                    <span className={styles.cardCountBadge}>Amenity</span>
                  </div>
                  <div className={styles.metaGrid}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Designation</span>
                      <span className={styles.metaValue}>{currentRoom.roomType}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Space Code</span>
                      <span className={styles.metaValue}>{roomNum}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Access Policy</span>
                      <span className={styles.metaValue}>Designated Campus Amenity</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Operating Hours</span>
                      <span className={styles.metaValue}>24/7 Facility</span>
                    </div>
                    <div className={`${styles.metaItem} ${styles.metaItemFull}`}>
                      <span className={styles.metaLabel}>Location Sector</span>
                      <span className={styles.metaValue}>
                        Block {currentRoom.block || currentBlock} · {getFloorName(currentRoom.floorNumber)} (Corridor Wing)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Washroom Card 2: Water & Infrastructure */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <span>💧</span> Water Supply &amp; Plumbing
                    </span>
                    <span className={styles.cardCountBadge} style={{ color: '#0284c7', borderColor: '#bae6fd' }}>
                      Pressurized
                    </span>
                  </div>
                  <div className={styles.specsGrid}>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>🚰</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>Domestic Water Network</span>
                        <span className={styles.specDesc}>Dual overhead storage connection with continuous delivery</span>
                      </div>
                    </div>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>🚿</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>Fixture Inventory</span>
                        <span className={styles.specDesc}>Vanity washbasins, sensor urinal arrays, sanitary cubicles</span>
                      </div>
                    </div>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>🌀</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>Ventilation System</span>
                        <span className={styles.specDesc}>Mechanical exhaust louvers with natural cross-draft</span>
                      </div>
                    </div>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>💡</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>Lighting Automation</span>
                        <span className={styles.specDesc}>Passive PIR presence-activated LED luminaires</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Washroom Card 3: Housekeeping & Maintenance */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <span>🧹</span> Housekeeping &amp; Service Roster
                    </span>
                    <span className={styles.cardCountBadge} style={{ color: '#16a34a', borderColor: '#bbf7d0' }}>
                      3x Daily
                    </span>
                  </div>
                  <div className={styles.specsGrid}>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>⏱️</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>Inspection Cadence</span>
                        <span className={styles.specDesc}>Cycles at 07:30, 13:00, and 17:30 daily</span>
                      </div>
                    </div>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>📋</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>Sanitation Checklist</span>
                        <span className={styles.specDesc}>Surface disinfection, sanitiser dispensers, floor hygiene</span>
                      </div>
                    </div>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>🔧</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>Plumbing Status</span>
                        <span className={styles.specDesc}>Nominal · 0 active drainage or leak tickets logged</span>
                      </div>
                    </div>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>📞</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>Facility Helpdesk</span>
                        <span className={styles.specDesc}>Campus Physical Plant Wing Ext. #402</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Washroom Card 4: Accessibility & Emergency Egress */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <span>🚪</span> Accessibility &amp; Corridor Context
                    </span>
                    <span className={styles.cardCountBadge}>Campus Map</span>
                  </div>
                  <div className={styles.specsGrid}>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>♿</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>Universal Access</span>
                        <span className={styles.specDesc}>Step-free level floor corridor entry</span>
                      </div>
                    </div>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>🚨</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>Emergency Egress</span>
                        <span className={styles.specDesc}>Direct path to Block {currentBlock} North stairwell exit</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Hostel Room */
              <>
                {/* Hostel Card 1: Residential Quarters Allocation */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <span>🛏️</span> Residential Quarters Allocation
                    </span>
                    <span className={styles.cardCountBadge}>Residential</span>
                  </div>
                  <div className={styles.metaGrid}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Quarters ID</span>
                      <span className={styles.metaValue}>{roomNum}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Hostel Building</span>
                      <span className={styles.metaValue}>{resolvedBuildingName}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Suite Format</span>
                      <span className={styles.metaValue}>Undergraduate Living Suite</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Capacity</span>
                      <span className={styles.metaValue}>4 Resident Students</span>
                    </div>
                    <div className={`${styles.metaItem} ${styles.metaItemFull}`}>
                      <span className={styles.metaLabel}>Floor &amp; Wing</span>
                      <span className={styles.metaValue}>
                        {getFloorName(currentRoom.floorNumber)} · Residential Sector
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hostel Card 2: Living Amenities & Furnishings */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <span>📦</span> Room Amenities &amp; Furnishings
                    </span>
                    <span className={styles.cardCountBadge} style={{ color: '#0284c7', borderColor: '#bae6fd' }}>
                      Furnished
                    </span>
                  </div>
                  <div className={styles.specsGrid}>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>🪑</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>Student Furniture</span>
                        <span className={styles.specDesc}>4 Individual study desks, ergonomic chairs, steel wardrobes, single cots</span>
                      </div>
                    </div>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>📶</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>High-Speed Internet</span>
                        <span className={styles.specDesc}>Dedicated campus Wi-Fi access point &amp; gigabit Ethernet drops</span>
                      </div>
                    </div>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>🔌</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>Electrical Distribution</span>
                        <span className={styles.specDesc}>Dedicated MCB sub-panel, desk power outlets, ceiling fans</span>
                      </div>
                    </div>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>🛡️</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>Safety &amp; Fire Protection</span>
                        <span className={styles.specDesc}>Photoelectric smoke detector &amp; emergency exit lighting</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hostel Card 3: Administration & Policies */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <span>🏛️</span> Hostel Administration &amp; Guidelines
                    </span>
                    <span className={styles.cardCountBadge}>Regulations</span>
                  </div>
                  <div className={styles.specsGrid}>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>👮</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>Resident Warden</span>
                        <span className={styles.specDesc}>Warden Office Ground Floor · 24/7 Security checkpoint</span>
                      </div>
                    </div>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>⏰</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>Visiting &amp; Curfew</span>
                        <span className={styles.specDesc}>Visitor hours: 16:30 – 18:30 (Visitors Lounge) · Gate curfew logged</span>
                      </div>
                    </div>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>🍽️</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>Hostel Mess Access</span>
                        <span className={styles.specDesc}>Direct covered corridor access to hostel dining hall</span>
                      </div>
                    </div>
                    <div className={styles.specCard}>
                      <span className={styles.specIcon}>📋</span>
                      <div className={styles.specContent}>
                        <span className={styles.specTitle}>Maintenance Log</span>
                        <span className={styles.specDesc}>Routine monthly plumbing &amp; fixture safety audit nominal</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* CASE B: ELIGIBLE ROOMS (Classrooms, Smart Rooms, Labs, Staff Rooms) — SPLIT LAYOUT */
          <div className={styles.splitLayout}>
            {/* ── LEFT COLUMN: INFORMATION PANEL & TIMETABLE ── */}
            <div className={styles.leftInfoColumn}>
              {/* Room Metadata Card */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>
                    <span>ℹ️</span> Space Specifications
                  </span>
                  <span className={styles.cardCountBadge}>{currentRoom.status || 'Active'}</span>
                </div>
                <div className={styles.metaGrid}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Room Number</span>
                    <span className={styles.metaValue}>{roomNum}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Classification</span>
                    <span className={styles.metaValue}>{currentRoom.roomType || 'Space'}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Seating Capacity</span>
                    <span className={styles.metaValue}>
                      {currentRoom.capacity || (isLab ? '30-36 Workstations' : isOffice ? '8-10 Desks' : '60-70 Students')}
                    </span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Floor Location</span>
                    <span className={styles.metaValue}>{getFloorName(currentRoom.floorNumber)}</span>
                  </div>
                  <div className={`${styles.metaItem} ${styles.metaItemFull}`}>
                    <span className={styles.metaLabel}>Building Complex</span>
                    <span className={styles.metaValue}>
                      {resolvedBuildingName} (Block {currentRoom.block || currentBlock})
                    </span>
                  </div>
                </div>
              </div>

              {/* Timetable Schedule Section */}
              <div className={styles.card} style={{ flex: 1, minHeight: 0 }}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>
                    <span>📅</span> Academic Timetable
                  </span>
                  <span className={styles.cardCountBadge}>
                    {timetables.length > 0 ? `${timetables.length} Slots` : 'No Slots'}
                  </span>
                </div>

                {/* Day Selection Tabs */}
                {timetableDays.length > 0 && (
                  <div className={styles.dayTabsRow}>
                    <button
                      type="button"
                      onClick={() => setSelectedDay('ALL')}
                      className={`${styles.dayTab} ${selectedDay === 'ALL' ? styles.dayTabActive : ''}`}
                    >
                      All Days
                    </button>
                    {timetableDays.map((day) => {
                      const dayCount = timetables.filter((s) => s.day === day).length;
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setSelectedDay(day)}
                          className={`${styles.dayTab} ${selectedDay === day ? styles.dayTabActive : ''}`}
                        >
                          {day.slice(0, 3)} ({dayCount})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Timetable Slots List */}
                <div className={styles.timetableSection}>
                  {timetableLoading ? (
                    <div className={styles.loadingBox} style={{ padding: '20px' }}>
                      <span className={styles.spinnerSm} />
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Loading schedule...</span>
                    </div>
                  ) : timetableError ? (
                    <div className={styles.errorBox} style={{ padding: '16px' }}>
                      <p style={{ color: '#f87171', fontSize: '0.75rem', margin: 0 }}>{timetableError}</p>
                    </div>
                  ) : filteredTimetables.length > 0 ? (
                    <div className={styles.timetableList}>
                      {filteredTimetables.map((slot) => (
                        <div key={slot._id} className={styles.timetableCard}>
                          <div className={styles.ttTopRow}>
                            <span className={styles.ttDayBadge}>{slot.day}</span>
                            <span className={styles.ttSlotBadge}>
                              Slot {slot.slotStart}
                              {slot.slotEnd !== slot.slotStart ? `–${slot.slotEnd}` : ''}
                            </span>
                          </div>
                          <div className={styles.ttSubject}>{slot.subject}</div>
                          <div className={styles.ttBottomRow}>
                            <span className={styles.ttTypeTag}>{slot.type || 'Lecture'}</span>
                            <span className={styles.ttSectionTag}>{slot.sectionId}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.noDataText}>
                      {selectedDay !== 'ALL'
                        ? `No lectures or sessions scheduled for ${selectedDay}.`
                        : 'No academic timetable slots assigned to this room.'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN: MAIN PREVIEW AREA ── */}
            <div className={styles.rightPreviewColumn}>
              {/* SPECIALIZED FOR C-110: LIVE CAMERA STREAM DEMONSTRATION TESTBED */}
              {isC110 ? (
                <>
                  <div className={styles.c110PreviewCard}>
                    <div className={styles.c110HeaderBar}>
                      <div className={styles.cameraTitleGroup}>
                        {cameraState === 'live' ? (
                          <span className={styles.cameraLiveDotPulse} />
                        ) : cameraState === 'starting' ? (
                          <span className={styles.cameraStartingDot} />
                        ) : cameraState === 'error' ? (
                          <span className={styles.cameraErrorDot} />
                        ) : (
                          <span className={styles.cameraStandbyDot} />
                        )}
                        <div>
                          <div className={styles.cameraHeading}>CP PLUS Wi-Fi Camera (RTSP Feed)</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            Designated Smart Classroom Live Video Testbed · Channel 0
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          className={`${styles.cameraStatusBadge} ${
                            cameraState === 'live'
                              ? styles.cameraStatusLive
                              : cameraState === 'starting'
                              ? styles.cameraStatusStarting
                              : cameraState === 'error'
                              ? styles.cameraStatusError
                              : ''
                          }`}
                        >
                          {cameraState === 'live'
                            ? '● LIVE (1080p)'
                            : cameraState === 'starting'
                            ? 'Connecting...'
                            : cameraState === 'error'
                            ? 'Offline / Error'
                            : 'Standby'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsLiveViewActive(!isLiveViewActive)}
                          className={`${styles.liveViewBtn} ${isLiveViewActive ? styles.liveViewBtnActive : ''}`}
                          title="Toggle live camera video feed"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            {isLiveViewActive ? (
                              <rect x="6" y="6" width="12" height="12" fill="currentColor" />
                            ) : (
                              <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                            )}
                          </svg>
                          <span>{isLiveViewActive ? 'Hide Live View' : 'Show Live View'}</span>
                        </button>
                      </div>
                    </div>

                    {/* 16:9 Dedicated Video Player Viewport Container */}
                    <div className={`${styles.videoViewport} ${isLiveViewActive ? styles.videoOverlayActive : ''}`}>
                      {/* Corner HUD Markers */}
                      <span className={styles.hudCornerTL} />
                      <span className={styles.hudCornerTR} />
                      <span className={styles.hudCornerBL} />
                      <span className={styles.hudCornerBR} />

                      {/* Top HUD Bar */}
                      <div className={styles.videoTopHud}>
                        <span>
                          {cameraState === 'live'
                            ? '[LIVE HLS PIPELINE ACTIVE]'
                            : cameraState === 'starting'
                            ? '[INITIALIZING HLS INGESTION]'
                            : cameraState === 'error'
                            ? '[STREAM PIPELINE ERROR]'
                            : '[STANDBY VIEWPORT]'}
                        </span>
                        <span>DEVICE: CP-PLUS-WIFI-01</span>
                        <span>H.264 / HLS · 1080p</span>
                      </div>

                      {/* Real HTML5 Live Video Element */}
                      <video
                        ref={videoRef}
                        className={styles.liveVideoElement}
                        playsInline
                        muted
                        autoPlay
                        style={{ display: cameraState === 'live' ? 'block' : 'none' }}
                      />

                      {/* Center Viewport Graphics */}
                      {cameraState === 'starting' ? (
                        <div className={styles.activeStreamBox}>
                          <span className={styles.activeStreamSpinner} />
                          <span className={styles.activeStreamTitle}>Connecting to Camera...</span>
                          <span className={styles.activeStreamEndpoint}>
                            Probing RTSP socket &amp; launching HLS transmuxer
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            Target: C-110 Smart Classroom · Waiting for first keyframe
                          </span>
                        </div>
                      ) : cameraState === 'error' ? (
                        <div className={styles.streamErrorBox}>
                          <span style={{ fontSize: '2rem' }}>⚠️</span>
                          <span className={styles.streamErrorTitle}>Camera Connection Error</span>
                          <span className={styles.streamErrorDesc}>
                            {cameraError || 'Unable to connect to camera RTSP stream.'}
                          </span>
                          <button
                            type="button"
                            onClick={handleRetryStream}
                            className={styles.retryStreamBtn}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="23 4 23 10 17 10" />
                              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                            </svg>
                            <span>Retry Connection</span>
                          </button>
                        </div>
                      ) : cameraState === 'live' ? (
                        /* Transparent spacer allowing video through while preserving flex structure */
                        <div style={{ flex: 1 }} />
                      ) : (
                        <div className={styles.videoCenterStandby}>
                          <svg className={styles.apertureIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="14.31" y1="8" x2="20.05" y2="17.94" />
                            <line x1="9.69" y1="8" x2="21.17" y2="8" />
                            <line x1="7.38" y1="12" x2="13.12" y2="2.06" />
                            <line x1="9.69" y1="16" x2="3.95" y2="6.06" />
                            <line x1="14.31" y1="16" x2="2.83" y2="16" />
                            <line x1="16.62" y1="12" x2="10.88" y2="21.94" />
                          </svg>
                          <span className={styles.standbyMainText}>CP PLUS Wi-Fi Camera Standby</span>
                          <span className={styles.standbySubText}>
                            Direct camera stream proxy ready. Click &ldquo;Show Live View&rdquo; to start the real-time HLS video pipeline.
                          </span>
                        </div>
                      )}

                      {/* Bottom HUD Bar */}
                      <div className={styles.videoBottomHud}>
                        <span>TARGET: C-110 SMART CLASSROOM</span>
                        <span>
                          STATUS: {cameraState === 'live' ? 'ONLINE' : cameraState.toUpperCase()}
                        </span>
                        <span>LATENCY: {cameraState === 'live' ? '< 1.5s (LOW-LATENCY HLS)' : 'STANDBY'}</span>
                      </div>
                    </div>

                    {/* Architecture Isolation Callout */}
                    <div className={styles.streamNoteBanner}>
                      <span>ℹ️</span>
                      <span>
                        <strong>Architecture Isolation:</strong> C-110 is the sole classroom connected to the CP PLUS Wi-Fi camera demonstration.
                        The live RTSP video stream operates independently from algorithmic occupancy counting sensors.
                      </span>
                    </div>
                  </div>

                  {/* C-110 Smart Classroom Equipment Grid */}
                  <div className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardTitle}>
                        <span>⚡</span> Smart Classroom Equipment &amp; Features
                      </span>
                      <span className={styles.cardCountBadge}>Smart Room</span>
                    </div>
                    <div className={styles.specsGrid}>
                      <div className={styles.specCard}>
                        <span className={styles.specIcon}>🖥️</span>
                        <div className={styles.specContent}>
                          <span className={styles.specTitle}>Interactive 86&quot; Smart Board</span>
                          <span className={styles.specDesc}>4K UHD Multi-touch interactive display with digital pen casting</span>
                        </div>
                      </div>
                      <div className={styles.specCard}>
                        <span className={styles.specIcon}>📽️</span>
                        <div className={styles.specContent}>
                          <span className={styles.specTitle}>Dual Projector Array</span>
                          <span className={styles.specDesc}>Synchronized dual projection for hybrid lecture capture</span>
                        </div>
                      </div>
                      <div className={styles.specCard}>
                        <span className={styles.specIcon}>🎙️</span>
                        <div className={styles.specContent}>
                          <span className={styles.specTitle}>Boundary Microphone Array</span>
                          <span className={styles.specDesc}>Ceiling-mounted omnidirectional audio pickup &amp; PA amplifier</span>
                        </div>
                      </div>
                      <div className={styles.specCard}>
                        <span className={styles.specIcon}>📡</span>
                        <div className={styles.specContent}>
                          <span className={styles.specTitle}>Dedicated PIR Sensor Node</span>
                          <span className={styles.specDesc}>Ceiling-mounted passive presence detector for telemetry</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : isLab ? (
                /* LABORATORY PREVIEW VIEW */
                <>
                  <div className={styles.schematicCard}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardTitle}>
                        <span>🔬</span> Laboratory Floorplan Schematic
                      </span>
                      <span className={styles.cardCountBadge}>{roomNum} · Lab Twin</span>
                    </div>
                    <div className={styles.schematicViewport}>
                      <LaboratorySchematic roomNumber={roomNum} labName={roomDisplayName} />
                    </div>
                    <div className={styles.schematicLegend}>
                      <span className={styles.legendItem}>
                        <span className={styles.legendSwatch} style={{ background: '#818cf8' }} />
                        <span>Workstations</span>
                      </span>
                      <span className={styles.legendItem}>
                        <span className={styles.legendSwatch} style={{ background: '#38bdf8' }} />
                        <span>Instrument Rails</span>
                      </span>
                      <span className={styles.legendItem}>
                        <span className={styles.legendSwatch} style={{ background: '#ef4444' }} />
                        <span>Emergency Shutoff</span>
                      </span>
                    </div>
                  </div>

                  {/* Laboratory Equipment Specifications */}
                  <div className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardTitle}>
                        <span>⚙️</span> Research &amp; Testing Equipment
                      </span>
                      <span className={styles.cardCountBadge}>Lab Inventory</span>
                    </div>
                    <div className={styles.specsGrid}>
                      <div className={styles.specCard}>
                        <span className={styles.specIcon}>📊</span>
                        <div className={styles.specContent}>
                          <span className={styles.specTitle}>Test &amp; Measurement Rails</span>
                          <span className={styles.specDesc}>Digital Storage Oscilloscopes, Signal Generators, Regulated DC supplies</span>
                        </div>
                      </div>
                      <div className={styles.specCard}>
                        <span className={styles.specIcon}>💻</span>
                        <div className={styles.specContent}>
                          <span className={styles.specTitle}>Simulation Workstations</span>
                          <span className={styles.specDesc}>High-performance computing terminals with specialized EDA toolchains</span>
                        </div>
                      </div>
                      <div className={styles.specCard}>
                        <span className={styles.specIcon}>🧯</span>
                        <div className={styles.specContent}>
                          <span className={styles.specTitle}>Safety Protocols</span>
                          <span className={styles.specDesc}>Master emergency power breaker, chemical safety kit, CO2 fire extinguisher</span>
                        </div>
                      </div>
                      <div className={styles.specCard}>
                        <span className={styles.specIcon}>👨‍🏫</span>
                        <div className={styles.specContent}>
                          <span className={styles.specTitle}>Faculty Coordination</span>
                          <span className={styles.specDesc}>Departmental lab in-charge &amp; technical assistant console</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : isOffice ? (
                /* STAFF ROOM & ACADEMIC OFFICES */
                <>
                  <div className={styles.schematicCard}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardTitle}>
                        <span>🏛️</span> Departmental Office Layout
                      </span>
                      <span className={styles.cardCountBadge}>{roomNum} · Office Twin</span>
                    </div>
                    <div className={styles.schematicViewport}>
                      <StaffRoomSchematic roomNumber={roomNum} />
                    </div>
                  </div>

                  <div className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardTitle}>
                        <span>📁</span> Departmental Facilities &amp; Advisement
                      </span>
                      <span className={styles.cardCountBadge}>Chambers</span>
                    </div>
                    <div className={styles.specsGrid}>
                      <div className={styles.specCard}>
                        <span className={styles.specIcon}>🪑</span>
                        <div className={styles.specContent}>
                          <span className={styles.specTitle}>Faculty Workstations</span>
                          <span className={styles.specDesc}>Individual privacy workstations with ergonomic seating</span>
                        </div>
                      </div>
                      <div className={styles.specCard}>
                        <span className={styles.specIcon}>🤝</span>
                        <div className={styles.specContent}>
                          <span className={styles.specTitle}>Student Consultation Area</span>
                          <span className={styles.specDesc}>Central conference and academic advisement desk</span>
                        </div>
                      </div>
                      <div className={styles.specCard}>
                        <span className={styles.specIcon}>🖨️</span>
                        <div className={styles.specContent}>
                          <span className={styles.specTitle}>Shared Infrastructure</span>
                          <span className={styles.specDesc}>Networked high-speed document printing, scanning &amp; archive storage</span>
                        </div>
                      </div>
                      <div className={styles.specCard}>
                        <span className={styles.specIcon}>📞</span>
                        <div className={styles.specContent}>
                          <span className={styles.specTitle}>Intercom &amp; Connectivity</span>
                          <span className={styles.specDesc}>Direct campus PBX extension &amp; Gigabit LAN terminals</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* STANDARD CLASSROOMS */
                <>
                  <div className={styles.schematicCard}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardTitle}>
                        <span>📐</span> Architectural Room Schematic
                      </span>
                      <span className={styles.cardCountBadge}>{roomNum} · Room Layout</span>
                    </div>
                    <div className={styles.schematicViewport}>
                      <ClassroomSchematic roomNumber={roomNum} />
                    </div>
                    <div className={styles.schematicLegend}>
                      <span className={styles.legendItem}>
                        <span className={styles.legendSwatch} style={{ background: '#2563eb' }} />
                        <span>Smart Board Wall</span>
                      </span>
                      <span className={styles.legendItem}>
                        <span className={styles.legendSwatch} style={{ background: '#94a3b8' }} />
                        <span>Student Desks</span>
                      </span>
                      <span className={styles.legendItem}>
                        <span className={styles.legendSwatch} style={{ background: '#10b981' }} />
                        <span>PIR Sensor Coverage</span>
                      </span>
                      <span className={styles.legendItem}>
                        <span className={styles.legendSwatch} style={{ background: '#d97706' }} />
                        <span>Door Access</span>
                      </span>
                    </div>
                  </div>

                  <div className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardTitle}>
                        <span>📽️</span> Audio-Visual &amp; Environmental Amenities
                      </span>
                      <span className={styles.cardCountBadge}>Classroom Inventory</span>
                    </div>
                    <div className={styles.specsGrid}>
                      <div className={styles.specCard}>
                        <span className={styles.specIcon}>📽️</span>
                        <div className={styles.specContent}>
                          <span className={styles.specTitle}>Projection System</span>
                          <span className={styles.specDesc}>Ceiling-mounted high-lumen digital projector with motorized screen</span>
                        </div>
                      </div>
                      <div className={styles.specCard}>
                        <span className={styles.specIcon}>🪑</span>
                        <div className={styles.specContent}>
                          <span className={styles.specTitle}>Seating Format</span>
                          <span className={styles.specDesc}>Dual-bench tiered seating for 60-70 students</span>
                        </div>
                      </div>
                      <div className={styles.specCard}>
                        <span className={styles.specIcon}>📶</span>
                        <div className={styles.specContent}>
                          <span className={styles.specTitle}>Wireless Network</span>
                          <span className={styles.specDesc}>High-density campus Wi-Fi 6 access point coverage</span>
                        </div>
                      </div>
                      <div className={styles.specCard}>
                        <span className={styles.specIcon}>🌀</span>
                        <div className={styles.specContent}>
                          <span className={styles.specTitle}>Ventilation &amp; Climate</span>
                          <span className={styles.specDesc}>Cross-ventilation architectural louvers &amp; high-efficiency ceiling fans</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── VIEW B: FLOOR ROOM INVENTORY DIRECTORY (When no room is selected) ──
  const resolvedBuildingName = building?.name || building?.buildingName || 'Academic Complex';

  return (
    <div className={styles.container} id="room-info-panel">
      {/* Top Header */}
      <header className={styles.directoryHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.buildingIconBadge}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="3 9 12 2 21 9 21 20 3 20" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div className={styles.headerTitleBlock}>
            <h2 className={styles.headerTitle}>
              {resolvedBuildingName} · Block {currentBlock}
            </h2>
            <div className={styles.metaBadgesRow}>
              <span className={styles.metaPill}>Room &amp; Space Directory</span>
              <span className={styles.metaPill} style={{ color: '#2563eb', fontWeight: 600 }}>
                {rooms.length} Spaces Catalogued
              </span>
              <span className={styles.metaPill}>
                {availableFloors.length} Floors
              </span>
            </div>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={styles.navCloseBtn}
            title="Exit to Campus Map"
          >
            <span>Back to Campus Map</span>
            <span style={{ fontSize: '1rem', fontWeight: 700 }}>&times;</span>
          </button>
        )}
      </header>

      {/* Floor Selection Tabs */}
      <div className={styles.floorTabsRow}>
        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '6px' }}>
          Select Floor:
        </span>
        {availableFloors.map((fn) => {
          const count = rooms.filter((r) => r.floorNumber === fn).length;
          return (
            <button
              key={fn}
              type="button"
              onClick={() => setSelectedFloor(fn)}
              className={`${styles.floorTabBtn} ${selectedFloor === fn ? styles.floorTabBtnActive : ''}`}
            >
              <span>{getFloorName(fn)}</span>
              <span className={styles.floorCountPill}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Room Inventory Grid */}
      <div className={styles.roomGridContainer}>
        {floorRooms.length > 0 ? (
          floorRooms.map((r) => {
            const rNum = getRoomNumber(r);
            const rDisplayName = getRoomDisplayName(r);
            const isRLab = isLaboratory(r);
            const isRSmart = String(r.roomType || '').toLowerCase().includes('smart');
            const isROffice =
              String(r.roomType || '').toLowerCase().includes('staff') ||
              String(r.roomType || '').toLowerCase().includes('office') ||
              String(r.roomType || '').toLowerCase().includes('cabin');
            const isRWashroom =
              String(r.roomType || '').toLowerCase().includes('washroom') ||
              String(r.roomType || '').toLowerCase().includes('toilet');

            return (
              <div
                key={r.roomNumber || r.id}
                onClick={() => onSelectRoom && onSelectRoom(r.roomNumber)}
                className={styles.roomCard}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelectRoom && onSelectRoom(r.roomNumber);
                  }
                }}
              >
                <div className={styles.roomCardLeft}>
                  <span className={styles.roomCardBadge}>{rNum}</span>
                  <div className={styles.roomCardInfo}>
                    <span className={styles.roomCardTitle} title={rDisplayName}>
                      {rDisplayName}
                    </span>
                    <span className={styles.roomCardSub}>
                      {r.roomType || 'Space'} · {getFloorName(r.floorNumber)}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isRSmart ? (
                    <span className={`${styles.metaPill} ${styles.typePillSmart}`}>Smart</span>
                  ) : isRLab ? (
                    <span className={`${styles.metaPill} ${styles.typePillLab}`}>Lab</span>
                  ) : isROffice ? (
                    <span className={`${styles.metaPill} ${styles.typePillOffice}`}>Office</span>
                  ) : isRWashroom ? (
                    <span className={`${styles.metaPill} ${styles.typePillWashroom}`}>Amenity</span>
                  ) : null}

                  <button type="button" className={styles.inspectBtn}>
                    Inspect &rarr;
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className={styles.noDataText} style={{ gridColumn: '1 / -1' }}>
            No rooms catalogued for this floor level.
          </div>
        )}
      </div>
    </div>
  );
}

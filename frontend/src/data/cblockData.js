/**
 * C Block Data — Single source of truth for the 3D digital twin prototype.
 *
 * buildingId: BLD001
 * Database name: Academic Building 1
 * Label: C BLOCK
 *
 * Later this will be replaced with API calls to Express → MongoDB.
 */

/* ================================================================
   BUILDING INFO
   ================================================================ */
export const BUILDING_INFO = {
  id: 'BLD001',
  name: 'Academic Building 1',
  label: 'C BLOCK',
  floors: 3,
  totalRooms: 25,
};

/* ================================================================
   TIME SLOTS  (historical prototype readings)
   ================================================================ */
export const TIME_SLOTS = ['09:00', '10:00', '11:00'];

/* ================================================================
   ROOM DEFINITIONS
   Spatial layout: rooms arranged along a corridor (left/right).
   x, z  → position offset on the floor (corridor-relative).
   w, d  → width and depth of the room box.
   side  → 'left' | 'right' of the corridor.
   ================================================================ */

const C = 'Classroom';
const SR = 'Staff Room';
const LAB = 'Lab';
const SM = 'Smart Room';
const HOP = 'HOP Room';
const GW = 'Girls Washroom';
const BW = 'Boys Washroom';

export const ROOMS = [
  // ── Floor 1 (9 rooms) ─────────────────────────────────────────
  { id: 'C101', floor: 1, type: C,   label: 'C101',              capacity: 70,  col: 0, side: 'left',  w: 1.8, d: 1.4 },
  { id: 'C102', floor: 1, type: C,   label: 'C102',              capacity: 70,  col: 1, side: 'left',  w: 1.8, d: 1.4 },
  { id: 'C103', floor: 1, type: C,   label: 'C103',              capacity: 70,  col: 2, side: 'left',  w: 1.8, d: 1.4 },
  { id: 'C104', floor: 1, type: SM,  label: 'C104 — Smart Room', capacity: 40,  col: 3, side: 'left',  w: 1.4, d: 1.4 },
  { id: 'C105', floor: 1, type: HOP, label: 'C105 — HOP Room',  capacity: 30,  col: 4, side: 'left',  w: 1.2, d: 1.4 },
  { id: 'C106', floor: 1, type: SR,  label: 'C106 — Staff Room', capacity: 10,  col: 0, side: 'right', w: 1.4, d: 1.4 },
  { id: 'C107', floor: 1, type: LAB, label: 'C107 — CV Raman Lab', capacity: 30, col: 1, side: 'right', w: 2.4, d: 1.4 },
  { id: 'C108', floor: 1, type: GW,  label: 'C108',              capacity: null, col: 3, side: 'right', w: 1.0, d: 1.4 },
  { id: 'C109', floor: 1, type: BW,  label: 'C109',              capacity: null, col: 4, side: 'right', w: 1.0, d: 1.4 },

  // ── Floor 2 (7 rooms) ─────────────────────────────────────────
  { id: 'C201', floor: 2, type: C,   label: 'C201',              capacity: 70,  col: 0, side: 'left',  w: 1.8, d: 1.4 },
  { id: 'C202', floor: 2, type: C,   label: 'C202',              capacity: 70,  col: 1, side: 'left',  w: 1.8, d: 1.4 },
  { id: 'C203', floor: 2, type: C,   label: 'C203',              capacity: 70,  col: 2, side: 'left',  w: 1.8, d: 1.4 },
  { id: 'C204', floor: 2, type: C,   label: 'C204',              capacity: 70,  col: 3, side: 'left',  w: 1.8, d: 1.4 },
  { id: 'C205', floor: 2, type: SR,  label: 'C205 — Staff Room', capacity: 10,  col: 0, side: 'right', w: 1.4, d: 1.4 },
  { id: 'C206', floor: 2, type: GW,  label: 'C206',              capacity: null, col: 3, side: 'right', w: 1.0, d: 1.4 },
  { id: 'C207', floor: 2, type: BW,  label: 'C207',              capacity: null, col: 4, side: 'right', w: 1.0, d: 1.4 },

  // ── Floor 3 (9 rooms) ─────────────────────────────────────────
  { id: 'C301', floor: 3, type: C,   label: 'C301',              capacity: 70,  col: 0, side: 'left',  w: 1.8, d: 1.4 },
  { id: 'C302', floor: 3, type: C,   label: 'C302',              capacity: 70,  col: 1, side: 'left',  w: 1.8, d: 1.4 },
  { id: 'C303', floor: 3, type: C,   label: 'C303',              capacity: 70,  col: 2, side: 'left',  w: 1.8, d: 1.4 },
  { id: 'C304', floor: 3, type: C,   label: 'C304',              capacity: 70,  col: 3, side: 'left',  w: 1.8, d: 1.4 },
  { id: 'C305', floor: 3, type: LAB, label: 'C305 — CAED Lab',   capacity: 30,  col: 0, side: 'right', w: 2.0, d: 1.4 },
  { id: 'C306', floor: 3, type: SR,  label: 'C306 — Staff Room', capacity: 10,  col: 2, side: 'right', w: 1.4, d: 1.4 },
  { id: 'C307', floor: 3, type: LAB, label: 'C307 — Additional Lab', capacity: 30, col: 3, side: 'right', w: 2.0, d: 1.4 },
  { id: 'C308', floor: 3, type: GW,  label: 'C308',              capacity: null, col: 4, side: 'right', w: 1.0, d: 1.4 },
  { id: 'C309', floor: 3, type: BW,  label: 'C309',              capacity: null, col: 5, side: 'right', w: 1.0, d: 1.4 },
];

/* ================================================================
   OCCUPANCY DATA
   Keyed by roomId → timeSlot → { current, capacity }
   Only rooms with real prototype data are included.
   ================================================================ */
export const OCCUPANCY_DATA = {
  C101: {
    '09:00': { current: 48, capacity: 70 },
    '10:00': { current: 62, capacity: 70 },
    '11:00': { current: 55, capacity: 70 },
  },
  C102: {
    '09:00': { current: 50, capacity: 70 },
    '10:00': { current: 65, capacity: 70 },
    '11:00': { current: 59, capacity: 70 },
  },
  C103: {
    '09:00': { current: 46, capacity: 70 },
    '10:00': { current: 61, capacity: 70 },
    '11:00': { current: 67, capacity: 70 },
  },
  C104: {
    '09:00': { current: 20, capacity: 40 },
    '10:00': { current: 32, capacity: 40 },
    '11:00': { current: 35, capacity: 40 },
  },
  C107: {
    '09:00': { current: 18, capacity: 30 },
    '10:00': { current: 27, capacity: 30 },
    '11:00': { current: 24, capacity: 30 },
  },
  C201: {
    '09:00': { current: 58, capacity: 70 },
    '10:00': { current: 66, capacity: 70 },
    '11:00': { current: 70, capacity: 70 },
  },
  C202: {
    '09:00': { current: 55, capacity: 70 },
    '10:00': { current: 64, capacity: 70 },
    '11:00': { current: 60, capacity: 70 },
  },
  C203: {
    '09:00': { current: 60, capacity: 70 },
    '10:00': { current: 68, capacity: 70 },
    '11:00': { current: 56, capacity: 70 },
  },
  C204: {
    '09:00': { current: 45, capacity: 70 },
    '10:00': { current: 58, capacity: 70 },
    '11:00': { current: 67, capacity: 70 },
  },
  C301: {
    '09:00': { current: 52, capacity: 70 },
    '10:00': { current: 63, capacity: 70 },
    '11:00': { current: 58, capacity: 70 },
  },
  C302: {
    '09:00': { current: 50, capacity: 70 },
    '10:00': { current: 62, capacity: 70 },
    '11:00': { current: 57, capacity: 70 },
  },
  C303: {
    '09:00': { current: 54, capacity: 70 },
    '10:00': { current: 65, capacity: 70 },
    '11:00': { current: 60, capacity: 70 },
  },
  C304: {
    '09:00': { current: 48, capacity: 70 },
    '10:00': { current: 59, capacity: 70 },
    '11:00': { current: 64, capacity: 70 },
  },
  C305: {
    '09:00': { current: 20, capacity: 30 },
    '10:00': { current: 28, capacity: 30 },
    '11:00': { current: 25, capacity: 30 },
  },
  C306: {
    '09:00': { current: 3, capacity: 10 },
    '10:00': { current: 6, capacity: 10 },
    '11:00': { current: 5, capacity: 10 },
  },
  C307: {
    '09:00': { current: 18, capacity: 30 },
    '10:00': { current: 27, capacity: 30 },
    '11:00': { current: 24, capacity: 30 },
  },
};

/* ================================================================
   HELPERS
   ================================================================ */

/**
 * Returns 'low' | 'moderate' | 'high' based on utilization %.
 * < 60%  → low
 * 60–80% → moderate
 * > 80%  → high
 */
export function getOccupancyLevel(utilization) {
  if (utilization > 80) return 'high';
  if (utilization >= 60) return 'moderate';
  return 'low';
}

/**
 * Get occupancy for a room at a given time. Returns null if no data.
 */
export function getRoomOccupancy(roomId, time) {
  const roomData = OCCUPANCY_DATA[roomId];
  if (!roomData) return null;
  const slot = roomData[time];
  if (!slot) return null;
  const utilization = (slot.current / slot.capacity) * 100;
  return {
    current: slot.current,
    capacity: slot.capacity,
    utilization: Math.round(utilization * 10) / 10,
    level: getOccupancyLevel(utilization),
  };
}

/**
 * Compute overall building occupancy summary for a given time slot.
 * Only counts rooms that have occupancy data.
 */
export function getBuildingSummary(time) {
  let totalCurrent = 0;
  let totalCapacity = 0;
  let roomsWithData = 0;

  for (const roomId of Object.keys(OCCUPANCY_DATA)) {
    const slot = OCCUPANCY_DATA[roomId][time];
    if (slot) {
      totalCurrent += slot.current;
      totalCapacity += slot.capacity;
      roomsWithData++;
    }
  }

  const utilization = totalCapacity > 0
    ? Math.round((totalCurrent / totalCapacity) * 1000) / 10
    : 0;

  return {
    totalCurrent,
    totalCapacity,
    utilization,
    level: getOccupancyLevel(utilization),
    roomsWithData,
  };
}

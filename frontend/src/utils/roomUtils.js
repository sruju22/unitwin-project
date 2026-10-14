/**
 * roomUtils.js — Centralized display and resolution utilities for campus rooms and laboratories.
 * Single source of truth for extracting updated lab and room names across all views.
 */

// Generic room types that are functional categories rather than specific lab/room names
const GENERIC_ROOM_TYPES = new Set([
  'classroom',
  'smart classroom',
  'lecture hall',
  'lecture hall 1',
  'lecture hall 2',
  'storage room',
  'store room',
  'washroom',
  'gents washroom',
  'ladies washroom',
  'ladies staff washroom',
  'boys washroom',
  'girls washroom',
  "men's washroom",
  'boys common room',
  'girls common room',
  'hostel room',
  'staff room',
  'staffroom',
  'office',
  'department office',
  'locked room',
  'unspecified',
  'lab',
  'laboratory',
]);

/**
 * Returns true if roomType is a specific/named facility (like 'Sir CV Raman Lab')
 * rather than a generic functional category (like 'Classroom' or 'Laboratory').
 */
export function isSpecializedRoomType(roomType) {
  if (!roomType || typeof roomType !== 'string') return false;
  const normalized = roomType.trim().toLowerCase();
  return !GENERIC_ROOM_TYPES.has(normalized);
}

/**
 * Checks if a room qualifies as a laboratory or research facility.
 */
export function isLaboratory(room) {
  if (!room) return false;
  const type = String(room.roomType || room.type || '').toLowerCase();
  const name = String(room.roomName || room.name || room.label || '').toLowerCase();
  return (
    type.includes('lab') ||
    type.includes('laboratory') ||
    type.includes('simulation') ||
    type.includes('instrument') ||
    type.includes('vlsi') ||
    type.includes('caed') ||
    type.includes('cad') ||
    name.includes('lab') ||
    name.includes('laboratory')
  );
}

/**
 * Returns the canonical room number / ID string (e.g. 'C-123' or 'C123').
 */
export function getRoomNumber(room) {
  if (!room) return '';
  if (typeof room === 'string') return room;
  return room.roomNumber || room.id || room.roomId || room.room || '';
}

/**
 * Resolves the primary human-facing display name of a room or lab.
 * Precedence:
 * 1. room.roomName (explicit name from backend, e.g. "Capgemini Lab", "Siddartha Lab")
 * 2. room.name (if distinct from room number)
 * 3. room.roomType if it is a specific named lab/space (e.g. "Sir CV Raman Lab", "LIC Lab", "CAED Lab")
 * 4. Extracted name from room.label if it contains a delimiter (e.g. "C107 — CV Raman Lab" -> "CV Raman Lab")
 * 5. Generic room type (e.g. "Classroom") or fallback to Room Number.
 */
export function getRoomDisplayName(room) {
  if (!room) return '';
  if (typeof room === 'string') return room;

  const roomNum = getRoomNumber(room).trim();

  // 1. Explicit roomName (e.g., 'Capgemini Lab')
  if (room.roomName && typeof room.roomName === 'string') {
    const trimmed = room.roomName.trim();
    if (trimmed && trimmed.toLowerCase() !== roomNum.toLowerCase()) {
      return trimmed;
    }
  }

  // 2. Explicit name field
  if (room.name && typeof room.name === 'string') {
    const trimmed = room.name.trim();
    if (trimmed && trimmed.toLowerCase() !== roomNum.toLowerCase()) {
      return trimmed;
    }
  }

  // 3. Specialized roomType (e.g., 'Sir CV Raman Lab', 'Dr. S Chandrashekar Computer Lab', 'VLSI Lab')
  if (room.roomType && typeof room.roomType === 'string') {
    const trimmed = room.roomType.trim();
    if (isSpecializedRoomType(trimmed)) {
      return trimmed;
    }
  }

  // 4. Check if label has a descriptive suffix (e.g. 'C107 — CV Raman Lab')
  if (room.label && typeof room.label === 'string') {
    const parts = room.label.split(/[—–-]/);
    if (parts.length > 1) {
      const candidate = parts[parts.length - 1].trim();
      if (candidate && candidate.toLowerCase() !== roomNum.toLowerCase()) {
        return candidate;
      }
    }
  }

  // 5. Fallback: roomType if available, or Room Number
  if (room.roomType && typeof room.roomType === 'string' && room.roomType.trim()) {
    return room.roomType.trim();
  }

  return roomNum ? `Room ${roomNum}` : 'Room';
}

/**
 * Checks whether the room has a distinct designated name beyond just its room number or 'Classroom'.
 */
export function hasDesignatedLabName(room) {
  if (!room) return false;
  const roomNum = getRoomNumber(room).toLowerCase();
  const displayName = getRoomDisplayName(room).toLowerCase();
  if (!displayName || displayName === roomNum || displayName === `room ${roomNum}`) {
    return false;
  }
  return !['classroom', 'room', 'space', 'storage room', 'washroom'].includes(displayName);
}

/**
 * Formats the primary title for room headers and drawers.
 * E.g. "Capgemini Lab" or "Room C-101"
 */
export function formatRoomTitle(room) {
  if (!room) return '';
  const roomNum = getRoomNumber(room);
  if (hasDesignatedLabName(room)) {
    return getRoomDisplayName(room);
  }
  return roomNum ? `Room ${roomNum}` : 'Room Details';
}

/**
 * Formats the secondary subtitle for room headers and cards.
 * E.g. "Room C-123 • Laboratory" or "Academic Classroom"
 */
export function formatRoomSubtitle(room) {
  if (!room) return '';
  const roomNum = getRoomNumber(room);
  const displayName = getRoomDisplayName(room);
  const type = room.roomType || room.type || '';

  if (hasDesignatedLabName(room)) {
    if (type && type.toLowerCase() !== displayName.toLowerCase()) {
      return roomNum ? `Room ${roomNum} • ${type}` : type;
    }
    return roomNum ? `Room ${roomNum}` : 'Academic Facility';
  }

  return type || 'Academic Space';
}

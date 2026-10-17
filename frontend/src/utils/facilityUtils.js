/**
 * facilityUtils.js — Reusable facility-type classification and rendering strategy
 * for AIT Campus Intelligence digital twin.
 *
 * Provides domain-specific section titles, icons, count formatters,
 * space categorization, room badges, and honest empty states tailored to each building type.
 */

// Safe helper for matching text
function textMatches(str, keywords) {
  if (!str || typeof str !== 'string') return false;
  const s = str.toLowerCase();
  return keywords.some((kw) => s.includes(kw.toLowerCase()));
}

/**
 * Genuine laboratory detector.
 * Only returns true if the space is genuinely an academic, scientific, or research lab.
 * Explicitly rejects non-lab spaces like warden rooms, dining halls, washrooms, and dorms.
 */
export function isGenuineLaboratory(room) {
  if (!room) return false;
  const type = String(room.roomType || room.type || '').toLowerCase();
  const name = String(room.roomName || room.name || room.label || '').toLowerCase();
  const combined = `${type} ${name}`;

  // Non-lab negative indicators
  const nonLabKeywords = [
    'washroom',
    'toilet',
    'warden',
    'hostel',
    'mess',
    'dining',
    'canteen',
    'cafeteria',
    'store',
    'storage',
    'pantry',
    'kitchen',
    'parking',
    'security',
    'bedroom',
    'dormitory',
    'quarters',
  ];
  if (nonLabKeywords.some((kw) => combined.includes(kw))) {
    return false;
  }

  // True lab indicators
  const labKeywords = [
    'lab',
    'laboratory',
    'simulation',
    'instrumentation',
    'vlsi',
    'caed',
    'cad lab',
    'research lab',
    'computing lab',
    'embedded',
    'microcontroller',
  ];
  return labKeywords.some((kw) => combined.includes(kw));
}

/**
 * Checks if a room is a classroom or lecture hall
 */
export function isClassroomSpace(room) {
  if (!room) return false;
  const type = String(room.roomType || room.type || '').toLowerCase();
  const name = String(room.roomName || room.name || room.label || '').toLowerCase();
  const combined = `${type} ${name}`;
  return combined.includes('class') || combined.includes('lecture') || combined.includes('seminar');
}

/**
 * Checks if a room is an office or staff chamber
 */
export function isOfficeOrStaffSpace(room) {
  if (!room) return false;
  const type = String(room.roomType || room.type || '').toLowerCase();
  const name = String(room.roomName || room.name || room.label || '').toLowerCase();
  const combined = `${type} ${name}`;
  return combined.includes('office') || combined.includes('staff') || combined.includes('chamber') || combined.includes('hod') || combined.includes('dean');
}

/**
 * Checks if a room is a student living space in a hostel
 */
export function isHostelLivingSpace(room) {
  if (!room) return false;
  const type = String(room.roomType || room.type || '').toLowerCase();
  const name = String(room.roomName || room.name || room.label || '').toLowerCase();
  const combined = `${type} ${name}`;
  return combined.includes('hostel room') || combined.includes('quarters') || combined.includes('dorm') || combined.includes('student room') || /BLD00[689]-\d+/.test(room.roomNumber || '');
}

/**
 * Checks if a space is for dining, food service, or mess
 */
export function isDiningOrFoodSpace(room) {
  if (!room) return false;
  const type = String(room.roomType || room.type || '').toLowerCase();
  const name = String(room.roomName || room.name || room.label || '').toLowerCase();
  const combined = `${type} ${name}`;
  return combined.includes('dining') || combined.includes('kitchen') || combined.includes('mess') || combined.includes('pantry') || combined.includes('cafeteria') || combined.includes('canteen');
}

/**
 * Checks if a room is a library reading hall or study space
 */
export function isLibraryStudySpace(room) {
  if (!room) return false;
  const type = String(room.roomType || room.type || '').toLowerCase();
  const name = String(room.roomName || room.name || room.label || '').toLowerCase();
  const combined = `${type} ${name}`;
  return combined.includes('reading') || combined.includes('study') || combined.includes('reference') || combined.includes('periodical') || combined.includes('stack');
}

/**
 * Canonical configuration by facility type
 */
export const FACILITY_TYPE_CONFIG = {
  academic: {
    categoryKey: 'academic',
    label: 'Academic Block',
    unitName: 'Academic Spaces',
    sectionTitle: 'Classrooms & Laboratories',
    sectionIcon: '🏫',
    facilitiesSubTitle: 'Registered Facilities & Specialized Labs',
    roomCountLabel: (rooms, labs) => {
      if (rooms === 0) return '0 Classrooms';
      if (labs > 0) return `${rooms} Spaces (${labs} Labs)`;
      return `${rooms} Spaces`;
    },
    filterCategories: [
      { id: 'all', label: 'All Spaces' },
      { id: 'labs', label: 'Laboratories', match: isGenuineLaboratory },
      { id: 'classrooms', label: 'Classrooms', match: isClassroomSpace },
      { id: 'offices', label: 'Faculty & Offices', match: isOfficeOrStaffSpace },
    ],
    roomTypeBadge: (room) => {
      if (isGenuineLaboratory(room)) return { label: 'Lab', variant: 'lab' };
      const type = String(room.roomType || '').toLowerCase();
      if (type.includes('smart')) return { label: 'Smart Room', variant: 'smart' };
      if (type.includes('seminar')) return { label: 'Seminar Hall', variant: 'seminar' };
      if (isClassroomSpace(room)) return { label: 'Classroom', variant: 'classroom' };
      if (isOfficeOrStaffSpace(room)) return { label: 'Office', variant: 'office' };
      return null;
    },
    emptyStateMessage: 'No room-level records cataloged for this academic block in the campus twin database.',
    emptyStateIcon: '📚',
  },

  hostel: {
    categoryKey: 'hostel',
    label: 'Residential Hostel',
    unitName: 'Residential Spaces',
    sectionTitle: 'Residential Spaces & Facilities',
    sectionIcon: '🛏️',
    facilitiesSubTitle: 'Hostel Amenities & Living Services',
    roomCountLabel: (rooms) => {
      if (rooms === 0) return '0 Residential Spaces';
      return `${rooms} Residential Spaces`;
    },
    filterCategories: [
      { id: 'all', label: 'All Spaces' },
      { id: 'rooms', label: 'Student Rooms', match: (r) => isHostelLivingSpace(r) && !isDiningOrFoodSpace(r) && !isOfficeOrStaffSpace(r) },
      { id: 'dining', label: 'Mess & Dining', match: isDiningOrFoodSpace },
      { id: 'admin', label: 'Warden & Staff', match: (r) => isOfficeOrStaffSpace(r) || textMatches(r.roomName || r.roomType || '', ['warden']) },
    ],
    roomTypeBadge: (room) => {
      if (isDiningOrFoodSpace(room)) return { label: 'Mess & Dining', variant: 'dining' };
      if (textMatches(room.roomName || room.roomType || '', ['warden'])) return { label: 'Warden Office', variant: 'admin' };
      if (isOfficeOrStaffSpace(room)) return { label: 'Staff Quarters', variant: 'admin' };
      if (isHostelLivingSpace(room)) return { label: 'Student Room', variant: 'hostel' };
      return null;
    },
    emptyStateMessage: 'Individual student residential rooms have not been cataloged in the digital twin database for this hostel. Operational monitoring is maintained at the building level.',
    emptyStateIcon: '🏢',
  },

  library: {
    categoryKey: 'library',
    label: 'Library Facility',
    unitName: 'Library Spaces',
    sectionTitle: 'Library Spaces & Facilities',
    sectionIcon: '📖',
    facilitiesSubTitle: 'Library Collections & Study Services',
    roomCountLabel: (rooms, digitalLabs) => {
      if (rooms === 0) return '0 Library Spaces';
      if (digitalLabs > 0) return `${rooms} Spaces (${digitalLabs} Digital/Labs)`;
      return `${rooms} Library Spaces`;
    },
    filterCategories: [
      { id: 'all', label: 'All Spaces' },
      { id: 'reading', label: 'Reading & Study', match: isLibraryStudySpace },
      { id: 'digital', label: 'Digital Commons', match: (r) => textMatches(r.roomType || r.roomName || '', ['digital', 'computer', 'lab']) },
    ],
    roomTypeBadge: (room) => {
      if (textMatches(room.roomType || room.roomName || '', ['digital', 'computer'])) return { label: 'Digital Commons', variant: 'smart' };
      if (textMatches(room.roomType || room.roomName || '', ['reference'])) return { label: 'Reference', variant: 'reading' };
      if (isLibraryStudySpace(room)) return { label: 'Reading Room', variant: 'reading' };
      if (isOfficeOrStaffSpace(room)) return { label: 'Circulation & Admin', variant: 'office' };
      return null;
    },
    emptyStateMessage: 'Individual library carrels, book stack wings, or reading hall subdivisions have not been individually mapped at the room twin level. Facility is monitored as an integrated campus resource.',
    emptyStateIcon: '📚',
  },

  canteen: {
    categoryKey: 'canteen',
    label: 'Dining & Cafeteria',
    unitName: 'Dining Spaces',
    sectionTitle: 'Dining Spaces & Amenities',
    sectionIcon: '🍽️',
    facilitiesSubTitle: 'Cafeteria Services & Dining Kiosks',
    roomCountLabel: (rooms) => {
      if (rooms === 0) return '0 Dining Spaces';
      return `${rooms} Dining Spaces`;
    },
    filterCategories: [
      { id: 'all', label: 'All Spaces' },
      { id: 'dining', label: 'Dining Halls', match: (r) => textMatches(r.roomType || r.roomName || '', ['dining', 'hall', 'seating']) },
      { id: 'pantry', label: 'Kitchen & Counters', match: (r) => textMatches(r.roomType || r.roomName || '', ['kitchen', 'pantry', 'counter']) },
    ],
    roomTypeBadge: (room) => {
      if (textMatches(room.roomType || room.roomName || '', ['kitchen', 'pantry', 'counter'])) return { label: 'Service Counter', variant: 'service' };
      if (textMatches(room.roomType || room.roomName || '', ['seating', 'surroundings', 'outdoor'])) return { label: 'Seating Area', variant: 'dining' };
      if (textMatches(room.roomType || room.roomName || '', ['dining', 'hall', 'cafeteria'])) return { label: 'Dining Hall', variant: 'dining' };
      return null;
    },
    emptyStateMessage: 'Individual dining sections or stall counters have not been cataloged as separate room records. The facility operates as an open unified food court.',
    emptyStateIcon: '☕',
  },

  sports: {
    categoryKey: 'sports',
    label: 'Sports Facility',
    unitName: 'Athletic Courts & Arenas',
    sectionTitle: 'Athletic & Sports Facilities',
    sectionIcon: '🏸',
    facilitiesSubTitle: 'Registered Courts & Athletic Arenas',
    roomCountLabel: (rooms) => {
      if (rooms === 0) return '0 Athletic Facilities';
      return `${rooms} Athletic Facilities`;
    },
    filterCategories: [{ id: 'all', label: 'All Arenas' }],
    roomTypeBadge: (room) => {
      if (textMatches(room.roomType || room.roomName || '', ['gym', 'fitness'])) return { label: 'Gymnasium', variant: 'sports' };
      if (textMatches(room.roomType || room.roomName || '', ['court', 'hall', 'arena'])) return { label: 'Sports Arena', variant: 'sports' };
      return null;
    },
    emptyStateMessage: 'Individual courts and athletic sectors are tracked at the facility zone level rather than individual room numbers.',
    emptyStateIcon: '⚽',
  },

  auditorium: {
    categoryKey: 'auditorium',
    label: 'Auditorium',
    unitName: 'Auditorium Spaces',
    sectionTitle: 'Auditorium Spaces & Stage Facilities',
    sectionIcon: '🎭',
    facilitiesSubTitle: 'Convention & Stage Amenities',
    roomCountLabel: (rooms) => {
      if (rooms === 0) return '0 Auditorium Spaces';
      return `${rooms} Auditorium Spaces`;
    },
    filterCategories: [{ id: 'all', label: 'All Spaces' }],
    roomTypeBadge: (room) => {
      if (textMatches(room.roomType || room.roomName || '', ['stage', 'podium'])) return { label: 'Stage / Dias', variant: 'auditorium' };
      if (textMatches(room.roomType || room.roomName || '', ['green', 'dressing'])) return { label: 'Green Room', variant: 'auditorium' };
      if (textMatches(room.roomType || room.roomName || '', ['control', 'av', 'booth'])) return { label: 'AV Control', variant: 'smart' };
      return null;
    },
    emptyStateMessage: 'Auditorium seating tiers, green rooms, and AV control cabins are monitored under centralized convention management.',
    emptyStateIcon: '🎙️',
  },

  administration: {
    categoryKey: 'administration',
    label: 'Administration',
    unitName: 'Administrative Offices',
    sectionTitle: 'Administrative Offices & Chambers',
    sectionIcon: '🏛️',
    facilitiesSubTitle: 'Secretariat Chambers & Department Offices',
    roomCountLabel: (rooms) => {
      if (rooms === 0) return '0 Administrative Offices';
      return `${rooms} Administrative Offices`;
    },
    filterCategories: [
      { id: 'all', label: 'All Offices' },
      { id: 'secretariat', label: 'Secretariat & Council', match: (r) => textMatches(r.roomType || r.roomName || '', ['chancellor', 'director', 'council', 'secretariat', 'principal']) },
      { id: 'records', label: 'Records & Accounts', match: (r) => textMatches(r.roomType || r.roomName || '', ['records', 'registrar', 'accounts', 'exam']) },
    ],
    roomTypeBadge: (room) => {
      if (textMatches(room.roomType || room.roomName || '', ['council', 'board', 'meeting'])) return { label: 'Conference', variant: 'office' };
      if (textMatches(room.roomType || room.roomName || '', ['secretariat', 'director', 'principal'])) return { label: 'Executive', variant: 'office' };
      return { label: 'Office', variant: 'office' };
    },
    emptyStateMessage: 'Directorate offices, secretariat cabins, and council halls are maintained under administrative management.',
    emptyStateIcon: '🗄️',
  },

  gate: {
    categoryKey: 'gate',
    label: 'Campus Gate & Access',
    unitName: 'Security Checkpoints',
    sectionTitle: 'Gate & Security Checkpoints',
    sectionIcon: '🛡️',
    facilitiesSubTitle: 'Access Control & Perimeter Security',
    roomCountLabel: (rooms) => {
      if (rooms === 0) return '0 Checkpoints';
      return `${rooms} Checkpoints`;
    },
    filterCategories: [{ id: 'all', label: 'All Checkpoints' }],
    roomTypeBadge: () => ({ label: 'Checkpoint', variant: 'admin' }),
    emptyStateMessage: 'Checkpoints and access barriers operate under perimeter security monitoring; internal room twins are not applicable.',
    emptyStateIcon: '🚧',
  },

  parking: {
    categoryKey: 'parking',
    label: 'Parking Facility',
    unitName: 'Parking Bays',
    sectionTitle: 'Parking Bays & Transit Zones',
    sectionIcon: '🚗',
    facilitiesSubTitle: 'Parking Amenities & Transit Infrastructure',
    roomCountLabel: (rooms) => {
      if (rooms === 0) return '0 Parking Bays';
      return `${rooms} Parking Bays`;
    },
    filterCategories: [{ id: 'all', label: 'All Bays' }],
    roomTypeBadge: () => ({ label: 'Parking Bay', variant: 'office' }),
    emptyStateMessage: 'Parking bays, EV charging stations, and vehicle clearance zones are monitored via perimeter traffic surveillance.',
    emptyStateIcon: '🅿️',
  },

  default: {
    categoryKey: 'general',
    label: 'Campus Facility',
    unitName: 'Facility Spaces',
    sectionTitle: 'Facility Spaces & Rooms',
    sectionIcon: '🏢',
    facilitiesSubTitle: 'Registered Facility Amenities',
    roomCountLabel: (rooms) => {
      if (rooms === 0) return '0 Spaces';
      return `${rooms} Spaces`;
    },
    filterCategories: [{ id: 'all', label: 'All Spaces' }],
    roomTypeBadge: () => null,
    emptyStateMessage: 'No room-level records cataloged for this campus facility in the digital twin database.',
    emptyStateIcon: '📍',
  },
};

/**
 * Resolves the appropriate facility configuration based on building metadata.
 */
export function resolveFacilityConfig(building) {
  if (!building) return FACILITY_TYPE_CONFIG.default;

  const rawType = String(building.type || building.category || '').toLowerCase().trim();
  const rawName = String(building.name || '').toLowerCase().trim();

  if (rawType.includes('hostel') || rawName.includes('hostel')) {
    return FACILITY_TYPE_CONFIG.hostel;
  }
  if (rawType.includes('library') || rawName.includes('library')) {
    return FACILITY_TYPE_CONFIG.library;
  }
  if (rawType.includes('canteen') || rawName.includes('canteen') || rawType.includes('cafeteria')) {
    return FACILITY_TYPE_CONFIG.canteen;
  }
  if (rawType.includes('sports') || rawName.includes('sports') || rawName.includes('feild') || rawName.includes('field')) {
    return FACILITY_TYPE_CONFIG.sports;
  }
  if (rawType.includes('auditorium') || rawName.includes('auditorium')) {
    return FACILITY_TYPE_CONFIG.auditorium;
  }
  if (rawType.includes('admin') || rawName.includes('admin')) {
    return FACILITY_TYPE_CONFIG.administration;
  }
  if (rawType.includes('gate') || rawName.includes('gate')) {
    return FACILITY_TYPE_CONFIG.gate;
  }
  if (rawType.includes('parking') || rawName.includes('parking')) {
    return FACILITY_TYPE_CONFIG.parking;
  }
  if (
    rawType.includes('academic') ||
    rawName.includes('block') ||
    rawType.includes('workshop') ||
    rawName.includes('workshop')
  ) {
    return FACILITY_TYPE_CONFIG.academic;
  }

  return FACILITY_TYPE_CONFIG.default;
}

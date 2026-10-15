import cocoData from './annotations/instances_default.json';
import { BUILDING_INFO, getBuildingSummary } from './cblockData';

const LOCAL_STORAGE_KEY = 'unitwin_campus_register_v3';

// Calculate polygon centroid from flat coordinate array [x1, y1, x2, y2, ...]
function calculateCentroid(points) {
  if (!points || points.length < 2) return { x: 0, y: 0 };
  let sumX = 0;
  let sumY = 0;
  const numPoints = points.length / 2;
  for (let i = 0; i < points.length; i += 2) {
    sumX += points[i];
    sumY += points[i + 1];
  }
  return {
    x: Math.round((sumX / numPoints) * 10) / 10,
    y: Math.round((sumY / numPoints) * 10) / 10,
  };
}

// Convert flat COCO array [x1, y1, x2, y2, ...] to SVG polygon points string "x1,y1 x2,y2 ..."
function toSvgPoints(points) {
  if (!points) return '';
  const pairs = [];
  for (let i = 0; i < points.length; i += 2) {
    pairs.push(`${points[i].toFixed(1)},${points[i + 1].toFixed(1)}`);
  }
  return pairs.join(' ');
}

export function formatBuildingCode(id) {
  if (typeof id === 'string' && id.startsWith('B')) return id;
  const num = parseInt(id, 10);
  if (isNaN(num)) return `B${id}`;
  return num < 10 ? `B0${num}` : `B${num}`;
}

export const STATUS_META = {
  operational: { label: 'Operational', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)' },
  maintenance: { label: 'Maintenance', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.35)' },
  warning:     { label: 'Warning',     color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)' },
  critical:    { label: 'Critical',    color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)' },
  unknown:     { label: 'Status unavailable', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.3)' },
};

/**
 * OFFICIAL AIT CAMPUS BUILDING REGISTER
 * Mapped to the CVAT polygon annotations from zz.zip
 */
const DEFAULT_LOGICAL_BUILDINGS = [
  {
    id: 'B01',
    name: 'Administrative Block',
    type: 'Administration',
    status: 'unknown',
    polygonIds: [1],
    location: 'Central Administrative Quad',
    description: "Executive offices, chancellor's secretariat, administrative directorate, and registrar.",
    facilities: ['Administration Offices', 'Meeting Chambers', 'Records Section'],
  },
  {
    id: 'B02',
    name: 'C-BLOCK',
    shortName: 'C-BLOCK',
    type: 'Academic Block',
    status: 'unknown',
    polygonIds: [2],
    location: 'Academic Sector',
    buildingId: 'BLD001',
    block: 'C',
    description: 'Academic block housing computer science lecture rooms, smart classrooms, CV Raman, Capgemini & CAED labs.',
    facilities: ['Capgemini Lab', 'Sir CV Raman Lab', 'CAED Lab', 'VLSI Lab', 'LIC Lab', 'Virtual Instrument Lab', 'Classrooms (25)', 'Smart Rooms'],
    floors: 4,
    totalRooms: 86,
    hasTelemetry: true,
    sensorTypes: ['Occupancy (PIR)', 'Energy (Smart Meter)', 'HVAC Ambient Sensors'],
    verificationStatus: 'verified',
  },
  {
    id: 'B03',
    name: 'AUDITORIUM',
    type: 'Auditorium',
    status: 'unknown',
    polygonIds: [3],
    location: 'Central Campus Quad',
    description: 'Main campus convention auditorium for seminars, conferences, and cultural symposiums.',
    facilities: ['Grand Auditorium', 'Acoustic Stage', 'Control Room', 'Green Rooms'],
  },
  {
    id: 'B04',
    name: 'B-BLOCK',
    type: 'Academic Block',
    status: 'unknown',
    polygonIds: [4],
    location: 'Academic Sector',
    buildingId: 'BLD001',
    block: 'B',
    floors: 4,
    totalRooms: 12,
    hasTelemetry: true,
    sensorTypes: ['Occupancy (PIR)', 'Energy (Smart Meter)'],
    description: 'Academic lecture halls, Siddartha Lab, and engineering department classrooms.',
    facilities: ['Siddartha Lab', 'Computer Lab', 'Team Neptunex', 'Computer Lab Back Entrance', 'Lecture Halls'],
  },
  {
    id: 'B05',
    name: 'A-BLOCK',
    type: 'Academic Block',
    status: 'unknown',
    polygonIds: [5],
    location: 'Academic Sector',
    buildingId: 'BLD001',
    block: 'A',
    floors: 4,
    totalRooms: 69,
    hasTelemetry: true,
    sensorTypes: ['Occupancy (PIR)', 'Energy (Smart Meter)', 'Environmental Sensors'],
    description: 'Primary academic complex housing science and foundational engineering laboratories.',
    facilities: [
      'Physics Laboratory',
      'Physics Laboratory - II',
      'Chemistry Lab',
      'CAD Lab',
      'Mathematics Lab',
      'Career Development Multi Skilling Lab',
      'Computer Lab',
      'PG Lab',
      'Lecture Theatres',
    ],
  },
  {
    id: 'B06',
    name: 'LIBRARY',
    type: 'Library',
    status: 'unknown',
    polygonIds: [6],
    location: 'Central Campus Sector',
    description: 'Central library, reference stack section, digital commons, and reading halls.',
    facilities: ['Reference Section', 'Digital Commons', 'Periodical Archive', 'Silent Study'],
  },
  {
    id: 'B07',
    name: 'GIRLS HOSTEL',
    type: 'Hostel',
    status: 'unknown',
    polygonIds: [7],
    location: 'Residential Sector',
    description: "On-campus women's residential hall with security access and dining facilities.",
    facilities: ['Dormitory Suites', 'Mess & Dining Hall', 'Common Room', 'First Aid Station'],
  },
  {
    id: 'B08',
    name: 'INDOOR SPORTS COMPLEX',
    type: 'Sports Facility',
    status: 'unknown',
    polygonIds: [8],
    location: 'Sports & Athletics Zone',
    description: 'Indoor sports arena featuring badminton courts, table tennis, and fitness gymnasium.',
    facilities: ['Badminton Courts', 'Table Tennis Arena', 'Gymnasium', 'Locker Rooms'],
  },
  {
    id: 'B09',
    name: 'OUTDOOR SPORTS FEILD',
    type: 'Sports Facility',
    status: 'unknown',
    polygonIds: [9],
    location: 'Sports & Athletics Zone',
    description: 'Expansive outdoor athletic grounds, synthetic track, and football arena.',
    facilities: ['Football Pitch', 'Athletic Track', 'Cricket Pavilion', 'Spectator Seating'],
  },
  {
    id: 'B10',
    name: 'S-BLOCK',
    type: 'Academic Block',
    status: 'unknown',
    polygonIds: [10],
    location: 'Academic Sector',
    description: 'Specialized academic block for advanced science and post-graduate studies.',
    facilities: ['PG Classrooms', 'Research Cubicles', 'Seminar Hall'],
  },
  {
    id: 'B11',
    name: 'WORKSHOP',
    type: 'Academic Block',
    status: 'unknown',
    polygonIds: [11],
    location: 'Engineering Workshops Complex',
    description: 'Mechanical and engineering practice workshop 1.',
    facilities: ['Machine Shop', 'Fitting & Welding Section', 'Tool Crib'],
  },
  {
    id: 'B12',
    name: 'WORKSHOP',
    type: 'Academic Block',
    status: 'unknown',
    polygonIds: [12],
    location: 'Engineering Workshops Complex',
    description: 'Engineering practice and fabrication workshop 2.',
    facilities: ['Carpentry & Foundry', 'CNC Machining Lab', 'Safety Station'],
  },
  {
    id: 'B13',
    name: 'WORKSHOP',
    type: 'Academic Block',
    status: 'unknown',
    polygonIds: [13],
    location: 'Engineering Workshops Complex',
    description: 'Electrical and electronics instrumentation workshop 3.',
    facilities: ['Electrical Machines Lab', 'Wiring Simulation Bench', 'Power Testing'],
  },
  {
    id: 'B14',
    name: 'WORKSHOP',
    type: 'Academic Block',
    status: 'unknown',
    polygonIds: [14],
    location: 'Engineering Workshops Complex',
    description: 'Automobile and thermodynamics engineering workshop 4.',
    facilities: ['Engine Test Beds', 'Hydraulics Section', 'Materials Lab'],
  },
  {
    id: 'B15',
    name: 'CAR PARKING',
    type: 'Parking',
    status: 'unknown',
    polygonIds: [15],
    location: 'North Entry Zone',
    description: 'Designated parking facility for faculty, visitors, and campus transit vehicles.',
    facilities: ['Covered Bays', 'EV Charging Points', 'Security Gate'],
  },
  {
    id: 'B16',
    name: 'ROCK GARDEN',
    type: 'Other',
    status: 'unknown',
    polygonIds: [16],
    location: 'North-West Grounds',
    description: 'Landscaped recreational rock garden and outdoor seating space.',
    facilities: ['Walking Trails', 'Eco Pavilion', 'Botanical Greenery'],
  },
  {
    id: 'B17',
    name: 'DR AMBEDKAR COLLEGE CANTEEN',
    type: 'Canteen',
    status: 'unknown',
    polygonIds: [17],
    location: 'Student Amenities Area',
    description: 'Campus cafeteria serving meals, refreshments, and dining seating for students and staff.',
    facilities: ['Food Court', 'Kitchen & Pantry', 'Indoor Seating', 'Beverage Kiosks'],
  },
  {
    id: 'B18',
    name: 'BOYS HOSTEL -1',
    type: 'Hostel',
    status: 'unknown',
    polygonIds: [18],
    location: 'Boys Residential Sector',
    description: "Men's residential accommodation block 1.",
    facilities: ['Hostel Rooms', 'Study Hall', 'Recreation Room', 'Laundry'],
  },
  {
    id: 'B19',
    name: 'BOYS HOSTEL 2',
    type: 'Hostel',
    status: 'unknown',
    polygonIds: [19],
    location: 'Boys Residential Sector',
    description: "Men's residential accommodation block 2.",
    facilities: ['Hostel Rooms', 'Common Hall', 'Dining Hall Access'],
  },
  {
    id: 'B20',
    name: 'BOYS HOSTEL-3',
    type: 'Hostel',
    status: 'unknown',
    polygonIds: [20],
    location: 'Boys Residential Sector',
    description: "Men's residential accommodation block 3.",
    facilities: ['Hostel Rooms', 'Indoor Games Room', 'WiFi Network'],
  },
  {
    id: 'B21',
    name: 'DATA CENTRE',
    type: 'Other',
    status: 'unknown',
    polygonIds: [21],
    location: 'Central Utility Quad',
    description: 'Campus central server farm, high-speed fiber terminal, and IT infrastructure core.',
    facilities: ['Server Racks', 'Precision Air Conditioning', 'UPS Backup Power', 'Fire Suppression'],
  },
];

// Retrieve persisted admin overrides from localStorage
function getStoredOverrides() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn('Could not read building overrides from localStorage:', err);
    return {};
  }
}

// Save admin overrides to localStorage
function saveStoredOverrides(overrides) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(overrides));
  } catch (err) {
    console.warn('Could not save building overrides to localStorage:', err);
  }
}

/**
 * Build polygon lookup map from the raw CVAT annotations
 */
function getPolygonLookup() {
  const annotations = cocoData.annotations || [];
  const map = {};

  annotations.forEach((ann) => {
    const seg = ann.segmentation && ann.segmentation[0] ? ann.segmentation[0] : [];
    const centroid = calculateCentroid(seg);
    const pointsString = toSvgPoints(seg);
    const bbox = ann.bbox || [0, 0, 0, 0];
    const area = ann.area || Math.round(bbox[2] * bbox[3]);

    map[ann.id] = {
      annotationId: ann.id,
      pointsString,
      rawCoordinates: seg,
      centroid,
      bbox: {
        x: bbox[0],
        y: bbox[1],
        width: bbox[2],
        height: bbox[3],
      },
      area: Math.round(area),
    };
  });

  return map;
}

/**
 * Retrieve all logical buildings with linked polygon geometries and persisted overrides.
 */
export function getLogicalBuildings() {
  const overrides = getStoredOverrides();
  const polygonLookup = getPolygonLookup();

  return DEFAULT_LOGICAL_BUILDINGS.map((base) => {
    const override = overrides[base.id] || {};

    const id = base.id;
    const name = override.name !== undefined ? override.name : base.name;
    const type = override.type || base.type || 'Academic Block';
    const status = override.status || base.status || 'unknown';
    const location = override.location || base.location || 'Campus Grounds';
    const description = override.description || base.description || '';
    const facilities = override.facilities || base.facilities || [];
    const verificationStatus = override.verificationStatus || base.verificationStatus || 'unverified';
    const polygonIds = override.polygonIds || base.polygonIds || [];

    // Collect all associated polygon geometries
    const geometries = polygonIds
      .map((pid) => polygonLookup[pid])
      .filter(Boolean);

    // Compute overall centroid
    let overallCentroid = { x: 0, y: 0 };
    let totalArea = 0;
    if (geometries.length > 0) {
      const sumX = geometries.reduce((acc, g) => acc + g.centroid.x, 0);
      const sumY = geometries.reduce((acc, g) => acc + g.centroid.y, 0);
      overallCentroid = {
        x: Math.round((sumX / geometries.length) * 10) / 10,
        y: Math.round((sumY / geometries.length) * 10) / 10,
      };
      totalArea = geometries.reduce((acc, g) => acc + g.area, 0);
    }

    // Telemetry binding for B02 (C-BLOCK)
    let liveTelemetry = null;
    const hasTelemetry = base.hasTelemetry || false;
    if (id === 'B02' && hasTelemetry) {
      try {
        const occSummary = getBuildingSummary('10:00');
        liveTelemetry = {
          occupancy: occSummary,
          activeFloorCount: 3,
          monitoredRooms: occSummary.roomsWithData,
          utilizationRate: occSummary.utilization,
        };
      } catch {
        liveTelemetry = null;
      }
    }

    return {
      id,
      code: id,
      name,
      displayName: name,
      type,
      category: type,
      status,
      operationalStatus: status,
      location,
      description,
      facilities,
      verificationStatus,
      polygonIds,
      geometries,
      geometryCount: geometries.length,
      centroid: overallCentroid,
      totalArea,
      hasTelemetry,
      sensorTypes: base.sensorTypes || [],
      liveTelemetry,
      buildingId: base.buildingId || (['B02', 'B04', 'B05'].includes(id) ? 'BLD001' : id),
      block: base.block || (id === 'B05' ? 'A' : id === 'B04' ? 'B' : id === 'B02' ? 'C' : undefined),
      lastUpdated: override.lastUpdated || 'Survey Ingest',
    };
  });
}

/**
 * Get a logical building by its ID (e.g. 'B01')
 */
export function getLogicalBuildingById(id) {
  const code = formatBuildingCode(id);
  const all = getLogicalBuildings();
  return all.find((b) => b.id === code) || null;
}

/**
 * Find the logical building that owns a specific CVAT annotation ID
 */
export function getBuildingByAnnotationId(annotationId) {
  const all = getLogicalBuildings();
  return all.find((b) => b.polygonIds.includes(Number(annotationId))) || null;
}

/**
 * Update administrative metadata for a logical building and persist changes
 */
export function updateLogicalBuilding(id, updates) {
  const code = formatBuildingCode(id);
  const overrides = getStoredOverrides();

  overrides[code] = {
    ...(overrides[code] || {}),
    ...updates,
    lastUpdated: new Date().toISOString(),
  };

  saveStoredOverrides(overrides);
  return getLogicalBuildingById(code);
}

/**
 * Reset a building to default survey state
 */
export function resetLogicalBuilding(id) {
  const code = formatBuildingCode(id);
  const overrides = getStoredOverrides();
  delete overrides[code];
  saveStoredOverrides(overrides);
  return getLogicalBuildingById(code);
}

/**
 * Summary analytics for logical campus buildings
 */
export function getCampusLogicalAnalytics() {
  const buildings = getLogicalBuildings();
  const total = buildings.length;

  const operational = buildings.filter((b) => b.status === 'operational').length;
  const maintenance = buildings.filter((b) => b.status === 'maintenance').length;
  const warning = buildings.filter((b) => b.status === 'warning').length;
  const critical = buildings.filter((b) => b.status === 'critical').length;
  const unknown = buildings.filter((b) => b.status === 'unknown').length;

  // Type distribution
  const typeCounts = {};
  buildings.forEach((b) => {
    typeCounts[b.type] = (typeCounts[b.type] || 0) + 1;
  });

  return {
    totalBuildings: total,
    totalPolygons: cocoData.annotations ? cocoData.annotations.length : 21,
    statusCounts: {
      operational,
      maintenance,
      warning,
      critical,
      unknown,
    },
    typeCounts,
  };
}

// Backward-compatibility aliases
export const getBuildingRegistry = getLogicalBuildings;
export const getBuildingById = getLogicalBuildingById;
export const updateBuildingMetadata = updateLogicalBuilding;
export const resetBuildingMetadata = resetLogicalBuilding;
export const getCampusInventoryStats = getCampusLogicalAnalytics;

export default getLogicalBuildings;

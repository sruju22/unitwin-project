const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getDefaultBuildings } = require('../data/defaultBuildings');
const { getDefaultRooms } = require('../data/defaultRooms');
const { getSimulationConfig } = require('../services/solarSimulationService');
const { resolveDateContext } = require('../utils/dateContext');

// Permitted searchable entity types
const ALLOWED_TYPES = new Set([
  'buildings',
  'rooms',
  'alerts',
  'maintenance',
  'occupancy',
  'energy',
  'areas',
]);

// Mapping of BLD IDs to official spatial survey codes (B01-B21)
const BLD_TO_CODE = {
  BLD001: 'B02', // Main Building -> C-Block
  BLD002: 'B10', // Silver Jubilee Building -> S-Block
  BLD003: 'B06', // Library Building -> Library
  BLD004: 'B04', // PVP Building -> Academic
  BLD005: 'B17', // Canteen Building -> Canteen
  BLD006: 'B18', // Boys Hostel Building -> Hostel 1
  BLD007: 'B07', // Girls Hostel Building -> Girls Hostel
  BLD008: 'B19', // Boys Hostel Building 2 -> Hostel 2
  BLD009: 'B20', // Boys Hostel Building 3 -> Hostel 3
  BLD010: 'B08', // Indoor Sports Complex -> Sports
};

// Safe string escaping for regex construction
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/search
 * Unified campus-aware search across buildings, rooms, alerts, maintenance,
 * occupancy, energy, and outdoor campus areas.
 *
 * Query parameters:
 *  - q / query: search term (max 80 chars)
 *  - types: comma-separated list of types to search (default: all)
 *  - limit: max results per category (default: 5, max: 10)
 *  - asOfDate: optional temporal cutoff (ISO string)
 */
router.get('/', async (req, res, next) => {
  try {
    const rawQuery = (req.query.q || req.query.query || '').trim();

    // 1. Validate and normalize query length
    if (!rawQuery || rawQuery.length < 2) {
      return res.json({
        success: true,
        query: rawQuery,
        count: 0,
        results: {},
        categories: [],
      });
    }

    const q = rawQuery.length > 80 ? rawQuery.substring(0, 80) : rawQuery;
    const safeQ = escapeRegex(q);
    const regex = new RegExp(safeQ, 'i');

    // Derived normalized alphanumeric token for codes like C101 <-> C-101, B01 <-> B-01
    const cleanQ = q.replace(/[^a-zA-Z0-9]/g, '');
    const safeCleanQ = escapeRegex(cleanQ);

    // 2. Validate requested entity types
    let requestedTypes = Array.from(ALLOWED_TYPES);
    if (req.query.types) {
      const split = String(req.query.types)
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => ALLOWED_TYPES.has(t));
      if (split.length > 0) {
        requestedTypes = split;
      }
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 10);

    // 3. Resolve temporal boundaries (Requirement 6)
    const dateContext = resolveDateContext(req.query.asOfDate ? { asOfDate: req.query.asOfDate } : {});
    const cutoffDate = dateContext?.targetCutoff ? new Date(dateContext.targetCutoff) : null;

    const isDbConnected = mongoose.connection.readyState === 1;
    const db = isDbConnected ? mongoose.connection.db : null;

    const results = {};
    let totalCount = 0;

    /* ====================================================================
       A. BUILDINGS AND CAMPUS LOCATIONS
       ==================================================================== */
    if (requestedTypes.includes('buildings')) {
      const buildingItems = [];
      const seenBuildingIds = new Set();

      if (isDbConnected) {
        const buildingFilter = {
          $or: [
            { buildingName: regex },
            { buildingId: regex },
            { buildingType: regex },
            { description: regex },
          ],
        };

        if (cleanQ.length >= 2) {
          buildingFilter.$or.push({ buildingId: new RegExp(`^${safeCleanQ}$`, 'i') });
        }

        // C-Block alias support
        if (/c[\s-]?block/i.test(q)) {
          buildingFilter.$or.push({ buildingId: 'BLD001' }, { buildingName: /c-block/i });
        }

        const bDocs = await db.collection('buildings').find(buildingFilter).limit(limit).toArray();

        bDocs.forEach((b) => {
          seenBuildingIds.add(b.buildingId);
          const spatialCode = BLD_TO_CODE[b.buildingId] || b.buildingId;
          buildingItems.push({
            id: `building-${b.buildingId}`,
            type: 'building',
            category: 'Campus Buildings',
            title: `${b.buildingName} (${b.buildingId})`,
            subtitle: `${b.buildingType || 'Academic Block'} • ${spatialCode}`,
            description: b.description || 'Campus facility & academic infrastructure',
            actionTag: 'Locate',
            metadata: {
              buildingId: b.buildingId,
              spatialCode,
              buildingType: b.buildingType,
              floors: b.floors,
              status: b.status || 'Active',
            },
            destination: {
              page: 'campus',
              params: { buildingId: spatialCode },
            },
          });
        });
      }

      // Merge with official surveyed buildings from defaultBuildings for full 21-building registry coverage
      const defaultB = getDefaultBuildings();
      defaultB.forEach((b) => {
        if (
          !seenBuildingIds.has(b.buildingId) &&
          (regex.test(b.buildingName) ||
            regex.test(b.buildingCode) ||
            regex.test(b.buildingId) ||
            regex.test(b.buildingType) ||
            regex.test(b.description || ''))
        ) {
          if (buildingItems.length < limit) {
            seenBuildingIds.add(b.buildingId);
            buildingItems.push({
              id: `building-${b.buildingCode}`,
              type: 'building',
              category: 'Campus Buildings',
              title: `${b.buildingName} (${b.buildingCode})`,
              subtitle: `${b.buildingType || 'Campus Facility'} • ${b.buildingCode}`,
              description: b.description || 'Campus facility in active register',
              actionTag: 'Locate',
              metadata: {
                buildingId: b.buildingId,
                spatialCode: b.buildingCode,
                status: b.status || 'Active',
              },
              destination: {
                page: 'campus',
                params: { buildingId: b.buildingCode },
              },
            });
          }
        }
      });

      if (buildingItems.length > 0) {
        results.buildings = buildingItems;
        totalCount += buildingItems.length;
      }
    }

    /* ====================================================================
       B. ROOMS AND FACILITIES
       ==================================================================== */
    if (requestedTypes.includes('rooms')) {
      const roomItems = [];

      if (isDbConnected) {
        const roomFilter = {
          $or: [
            { roomNumber: regex },
            { roomName: regex },
            { name: regex },
            { roomType: regex },
            { block: regex },
          ],
        };

        // Alphanumeric variations (e.g. C101 matches C-101)
        if (cleanQ.length >= 2) {
          const hypPattern = safeCleanQ.replace(/([a-zA-Z]+)(\d+)/, '$1-?$2');
          roomFilter.$or.push({ roomNumber: new RegExp(hypPattern, 'i') });
        }

        // Specific lab aliases
        if (/cv\s*raman/i.test(q) || /raman\s*lab/i.test(q)) {
          roomFilter.$or.push({ roomType: /raman/i }, { roomName: /raman/i }, { roomNumber: /C-?108/i });
        }
        if (/caed/i.test(q)) {
          roomFilter.$or.push({ roomType: /caed/i }, { roomName: /caed/i }, { roomNumber: /C-?311/i });
        }
        if (/classroom/i.test(q)) {
          roomFilter.$or.push({ roomType: /classroom/i });
        }

        const rDocs = await db.collection('rooms').find(roomFilter).limit(limit).toArray();

        rDocs.forEach((r) => {
          const displayBuilding = BLD_TO_CODE[r.buildingId] || r.buildingId;
          const labName = r.roomName || r.name || r.roomType;
          const displayTitle = r.roomName
            ? `${r.roomNumber} — ${r.roomName}`
            : `${r.roomNumber} — ${r.roomType || 'Room'}`;
          roomItems.push({
            id: `room-${r.roomNumber}`,
            type: 'room',
            category: 'Rooms & Labs',
            title: displayTitle,
            subtitle: `Floor ${r.floorNumber ?? '1'} • Block ${r.block || 'C'} (${displayBuilding})`,
            description: `${r.roomName ? `${r.roomName} (${r.roomType || 'Lab'})` : (r.roomType || 'Academic room')} in ${r.buildingId || 'Main Building'}. Status: ${r.status || 'Active'}`,
            actionTag: 'Inspect',
            metadata: {
              roomNumber: r.roomNumber,
              roomName: r.roomName || null,
              roomType: r.roomType,
              floor: r.floorNumber,
              block: r.block,
              buildingId: r.buildingId,
              status: r.status,
            },
            destination: {
              page: 'occupancy',
              params: { search: r.roomNumber },
            },
          });
        });

        // Supplement with prototype C-Block rooms if needed
        const seenRoomNumbers = new Set(rDocs.map((r) => r.roomNumber.toUpperCase().replace(/[^a-zA-Z0-9]/g, '')));
        const defaultRooms = getDefaultRooms();
        defaultRooms.forEach((dr) => {
          const cleanDR = dr.roomNumber.toUpperCase().replace(/[^a-zA-Z0-9]/g, '');
          if (!seenRoomNumbers.has(cleanDR) && roomItems.length < limit) {
            if (
              regex.test(dr.roomNumber) ||
              regex.test(dr.roomType) ||
              regex.test(dr.label || '') ||
              (cleanQ.length >= 2 && cleanDR.includes(cleanQ.toUpperCase()))
            ) {
              seenRoomNumbers.add(cleanDR);
              roomItems.push({
                id: `room-${dr.roomNumber}`,
                type: 'room',
                category: 'Rooms & Labs',
                title: `${dr.roomNumber} — ${dr.roomType}`,
                subtitle: `Floor ${dr.floorNumber} • Academic C-Block (BLD001 / B02)`,
                description: `C-Block room with seating capacity of ${dr.capacity || 70} students.`,
                actionTag: 'Inspect',
                metadata: {
                  roomNumber: dr.roomNumber,
                  roomType: dr.roomType,
                  floor: dr.floorNumber,
                  block: dr.block,
                  buildingId: dr.buildingId,
                  capacity: dr.capacity,
                },
                destination: {
                  page: 'occupancy',
                  params: { search: dr.roomNumber },
                },
              });
            }
          }
        });
      }

      if (roomItems.length > 0) {
        results.rooms = roomItems;
        totalCount += roomItems.length;
      }
    }

    /* ====================================================================
       C. ALERTS AND INCIDENTS
       ==================================================================== */
    if (requestedTypes.includes('alerts')) {
      const alertItems = [];

      if (isDbConnected) {
        const alertFilter = {
          $or: [
            { title: regex },
            { message: regex },
            { description: regex },
            { alertType: regex },
            { buildingId: regex },
          ],
        };

        if (/critical/i.test(q)) {
          alertFilter.$or.push({ severity: { $in: [/^critical$/i, /^high$/i] } });
        } else if (/high/i.test(q)) {
          alertFilter.$or.push({ severity: /^high$/i });
        } else if (/warning/i.test(q) || /medium/i.test(q)) {
          alertFilter.$or.push({ severity: { $in: [/^warning$/i, /^medium$/i] } });
        }

        if (/c[\s-]?block/i.test(q)) {
          alertFilter.$or.push({ buildingId: { $in: ['B02', 'BLD001'] } });
        }

        if (cutoffDate) {
          alertFilter.timestamp = { $lte: cutoffDate };
        }

        const aDocs = await db
          .collection('alerts')
          .find(alertFilter)
          .sort({ timestamp: -1 })
          .limit(limit)
          .toArray();

        aDocs.forEach((a) => {
          const title = a.title || a.message || `${a.alertType || 'System'} Incident Alert`;
          const severity = (a.severity || 'Medium').toUpperCase();
          const displayBld = BLD_TO_CODE[a.buildingId] || a.buildingId || 'Campus';
          const alertDate = a.timestamp ? new Date(a.timestamp).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' }) : '';

          alertItems.push({
            id: `alert-${a._id}`,
            type: 'alert',
            category: 'Operational Alerts',
            title: title.length > 60 ? `${title.substring(0, 57)}...` : title,
            subtitle: `${severity} • ${a.alertType || 'Operational'} • ${displayBld}${alertDate ? ` • ${alertDate}` : ''}`,
            description: a.message || a.description || 'Operational threshold alert',
            actionTag: 'View',
            metadata: {
              severity: a.severity,
              alertType: a.alertType,
              buildingId: a.buildingId,
              timestamp: a.timestamp,
              status: a.status || 'Active',
            },
            destination: {
              page: 'alerts',
              params: { type: a.alertType },
            },
          });
        });
      }

      if (alertItems.length > 0) {
        results.alerts = alertItems;
        totalCount += alertItems.length;
      }
    }

    /* ====================================================================
       D. MAINTENANCE RECORDS
       ==================================================================== */
    if (requestedTypes.includes('maintenance')) {
      const maintItems = [];

      if (isDbConnected) {
        const maintFilter = {
          $or: [
            { issue: regex },
            { title: regex },
            { description: regex },
            { assetType: regex },
            { buildingId: regex },
            { roomNumber: regex },
            { status: regex },
            { priority: regex },
          ],
        };

        if (/pending/i.test(q) || /open/i.test(q)) {
          maintFilter.$or.push({ status: { $in: ['Open', 'In Progress', 'Scheduled'] } });
        }
        if (/electrical/i.test(q)) {
          maintFilter.$or.push({ assetType: /electrical/i }, { issue: /electrical/i });
        }
        if (/repair/i.test(q)) {
          maintFilter.$or.push({ issue: /repair/i }, { issue: /leakage|broken|inspect/i });
        }
        if (/c[\s-]?block/i.test(q)) {
          maintFilter.$or.push({ buildingId: { $in: ['B02', 'BLD001'] } });
        }

        if (cutoffDate) {
          maintFilter.reportedDate = { $lte: cutoffDate };
        }

        // Query authoritative maintainence collection
        const mDocs = await db
          .collection('maintainence')
          .find(maintFilter)
          .sort({ priority: 1, reportedDate: -1 })
          .limit(limit)
          .toArray();

        mDocs.forEach((m) => {
          const title = m.issue || m.title || `${m.assetType} Maintenance Order`;
          const displayBld = BLD_TO_CODE[m.buildingId] || m.buildingId || 'Campus';
          maintItems.push({
            id: `maint-${m._id}`,
            type: 'maintenance',
            category: 'Maintenance Records',
            title: title.length > 60 ? `${title.substring(0, 57)}...` : title,
            subtitle: `${m.assetType || 'Facility'} • Priority: ${m.priority || 'Medium'} • Status: ${m.status || 'Open'}`,
            description: `${displayBld}${m.roomNumber ? ` (Room ${m.roomNumber})` : ''} • ${title}`,
            actionTag: 'View',
            metadata: {
              assetType: m.assetType,
              priority: m.priority,
              status: m.status,
              buildingId: m.buildingId,
              roomNumber: m.roomNumber,
              reportedDate: m.reportedDate,
            },
            destination: {
              page: 'maintenance',
              params: { search: m.assetType || m.roomNumber || 'Open' },
            },
          });
        });
      }

      if (maintItems.length > 0) {
        results.maintenance = maintItems;
        totalCount += maintItems.length;
      }
    }

    /* ====================================================================
       E. OCCUPANCY AND SPACE UTILIZATION
       ==================================================================== */
    if (requestedTypes.includes('occupancy')) {
      const occItems = [];

      if (isDbConnected) {
        const isOccupancyIntent = /occupan(cy|t)|density|utilization|headcount|crowd/i.test(q);
        const isHighIntent = /high\s*occupan|overcrowd|busy/i.test(q);

        const occFilter = {};
        if (cutoffDate) {
          occFilter.timestamp = { $lte: cutoffDate };
        }

        if (isHighIntent) {
          occFilter.utilization = { $gte: 70 };
        } else if (!isOccupancyIntent) {
          // If query specifies room code or building
          occFilter.$or = [
            { roomNumber: regex },
            { buildingId: regex },
          ];
          if (cleanQ.length >= 2) {
            const hypPattern = safeCleanQ.replace(/([a-zA-Z]+)(\d+)/, '$1-?$2');
            occFilter.$or.push({ roomNumber: new RegExp(hypPattern, 'i') });
          }
        }

        // Query latest occupancy records
        const oDocs = await db
          .collection('occupancy')
          .find(occFilter)
          .sort({ timestamp: -1, utilization: -1 })
          .limit(limit)
          .toArray();

        oDocs.forEach((o) => {
          const displayBld = BLD_TO_CODE[o.buildingId] || o.buildingId;
          const occDate = o.timestamp ? new Date(o.timestamp).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' }) : '';
          occItems.push({
            id: `occ-${o.roomNumber}-${o.timestamp}`,
            type: 'occupancy',
            category: 'Space Occupancy',
            title: `Room ${o.roomNumber}: ${o.occupancy} / ${o.capacity} Present (${o.utilization}% Utilization)`,
            subtitle: `Pilot Telemetry • ${o.scheduled ? 'Scheduled Session' : 'Unscheduled'} • ${displayBld}${occDate ? ` (${occDate})` : ''}`,
            description: `${o.utilization >= 70 ? '⚠️ High Density Space' : 'Normal Density'}: ${o.occupancy} present of ${o.capacity} seating capacity.`,
            actionTag: 'Inspect',
            metadata: {
              roomNumber: o.roomNumber,
              occupancy: o.occupancy,
              capacity: o.capacity,
              utilization: o.utilization,
              scheduled: o.scheduled,
              timestamp: o.timestamp,
              snapshotLabel: o.snapshotLabel,
              isPilotData: true,
            },
            destination: {
              page: 'occupancy',
              params: { search: o.roomNumber },
            },
          });
        });
      }

      if (occItems.length > 0) {
        results.occupancy = occItems;
        totalCount += occItems.length;
      }
    }

    /* ====================================================================
       F. ENERGY AND SOLAR PERFORMANCE
       ==================================================================== */
    if (requestedTypes.includes('energy')) {
      const energyItems = [];
      const isSolarIntent = /solar|pv|photovoltaic|inverter|panel/i.test(q);
      const isEnergyIntent = /energy|power|demand|grid|kwh|kw|electric|consumption/i.test(q);

      if (isSolarIntent || isEnergyIntent || /c[\s-]?block/i.test(q)) {
        const simConfig = getSimulationConfig();

        if (isSolarIntent || isEnergyIntent) {
          energyItems.push({
            id: 'energy-solar-pv',
            type: 'energy',
            category: 'Energy & Solar Telemetry',
            title: 'Rooftop Solar PV Generation (SIMULATED Telemetry)',
            subtitle: `Peak Rating: ${simConfig.assumedInstalledCapacityKW.toFixed(1)} kWp (${simConfig.assumedPanelCount} Panels) • C-Block Rooftop`,
            description: 'Physical diurnal solar model based on solar irradiance and configured 400W monocrystalline modules.',
            actionTag: 'Jump',
            metadata: {
              isSimulated: true,
              assumedInstalledCapacityKW: simConfig.assumedInstalledCapacityKW,
              panelCount: simConfig.assumedPanelCount,
              location: simConfig.arrayLocation,
            },
            destination: {
              page: 'energy',
            },
          });
        }

        if (isEnergyIntent) {
          energyItems.push({
            id: 'energy-active-demand',
            type: 'energy',
            category: 'Energy & Solar Telemetry',
            title: 'Active Power Demand & Net Grid Import Profiles',
            subtitle: 'Measured Substation Baseline Telemetry (kW & kWh)',
            description: 'Instantaneous campus power demand (kW) correlated with rooftop solar offset and net grid balance.',
            actionTag: 'Jump',
            metadata: {
              unit: 'kW',
              isSimulated: false,
            },
            destination: {
              page: 'energy',
            },
          });
        }
      }

      if (energyItems.length > 0) {
        results.energy = energyItems;
        totalCount += energyItems.length;
      }
    }

    /* ====================================================================
       G. CAMPUS OUTDOOR AREAS
       ==================================================================== */
    if (requestedTypes.includes('areas') && isDbConnected) {
      const areaItems = [];
      const areaFilter = {
        $or: [
          { areaName: regex },
          { areaId: regex },
          { areaType: regex },
          { description: regex },
        ],
      };

      const aDocs = await db.collection('campusAreas').find(areaFilter).limit(limit).toArray();

      aDocs.forEach((a) => {
        areaItems.push({
          id: `area-${a.areaId}`,
          type: 'area',
          category: 'Campus Grounds & Areas',
          title: a.areaName,
          subtitle: `${a.areaType || 'Outdoor Zone'} • ${a.areaId}`,
          description: a.description || 'Open campus zone & pedestrian pathway',
          actionTag: 'Locate',
          metadata: {
            areaId: a.areaId,
            areaType: a.areaType,
            capacity: a.capacity,
          },
          destination: {
            page: 'campus',
            params: { areaId: a.areaId },
          },
        });
      });

      if (areaItems.length > 0) {
        results.areas = areaItems;
        totalCount += areaItems.length;
      }
    }

    // Return structured, validated search response
    return res.json({
      success: true,
      query: q,
      count: totalCount,
      categories: Object.keys(results),
      results,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

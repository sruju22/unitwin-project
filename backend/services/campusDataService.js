const mongoose = require('mongoose');
const { formatDisplayDate, formatDisplayTime } = require('../utils/dateContext');
const {
  getSimulationConfig,
  calculatePowerFromIntervalEnergy,
  calculateNetGridBalance,
} = require('./solarSimulationService');

/**
 * Safe, read-only, controlled data retrieval functions for AIT Campus Intelligence digital twin.
 * All functions strictly observe temporal boundaries:
 * - Current metrics never include records timestamped after the reporting cutoff.
 * - Historical and future requests are bounded to their respective windows.
 * - Timestamps and cutoff boundaries are returned with every result.
 */

function getDb() {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is not active');
  }
  return mongoose.connection.db;
}

/**
 * Helper to extract effective cutoff date from dateContext or query
 */
function getEffectiveCutoff(query = {}, dateContext = null) {
  if (dateContext && dateContext.targetCutoff) {
    return new Date(dateContext.targetCutoff);
  }
  if (query && query.asOfDate) {
    const parsed = new Date(query.asOfDate);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  const pilotLatest = new Date('2026-10-17T23:59:59.999+05:30');
  return Date.now() > pilotLatest.getTime() ? new Date() : pilotLatest;
}

/**
 * 1. Buildings and Rooms Inventory (Master Spatial Registry)
 */
async function getBuildingsAndRooms(query = {}, dateContext = null) {
  const db = getDb();
  const [buildings, roomCount, roomTypes, roomBlocks, specificRoom] = await Promise.all([
    db.collection('buildings').find({}).toArray(),
    db.collection('rooms').countDocuments({}),
    db.collection('rooms').aggregate([
      { $group: { _id: '$roomType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]).toArray(),
    db.collection('rooms').aggregate([
      { $group: { _id: '$block', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]).toArray(),
    query.roomNumber
      ? db.collection('rooms').findOne({ roomNumber: new RegExp(`^${query.roomNumber}$`, 'i') })
      : null,
  ]);

  return {
    domain: 'Spatial Inventory',
    sourceCollection: 'buildings & rooms',
    provenance: 'Master Campus Directory',
    reportingPeriod: 'Permanent Campus Inventory',
    hasRecords: true,
    totalBuildings: buildings.length,
    totalRooms: roomCount,
    buildingsList: buildings.map((b) => ({
      buildingId: b.buildingId,
      name: b.buildingName,
      type: b.buildingType,
      floors: b.floors,
      status: b.status,
    })),
    roomTypesDistribution: roomTypes.map((rt) => ({ type: rt._id || 'General', count: rt.count })),
    blocksDistribution: roomBlocks.map((rb) => ({ block: rb._id || 'Main', count: rb.count })),
    specificRoomMatch: specificRoom
      ? {
          roomNumber: specificRoom.roomNumber,
          buildingId: specificRoom.buildingId,
          block: specificRoom.block,
          floorNumber: specificRoom.floorNumber,
          roomType: specificRoom.roomType,
          status: specificRoom.status,
        }
      : null,
  };
}

/**
 * 2. Academic Sections and Timetables
 */
async function getAcademicTimetable(query = {}, dateContext = null) {
  const db = getDb();
  const filter = {};

  // If specific day requested or derived from reporting date
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const effectiveDay = query.day || (dateContext?.reportingDate ? dayNames[new Date(dateContext.reportingDate).getDay()] : null);

  if (effectiveDay) {
    filter.day = new RegExp(`^${effectiveDay}$`, 'i');
  }
  if (query.sectionId) filter.sectionId = new RegExp(`^${query.sectionId}$`, 'i');
  if (query.roomNumber) filter.room = new RegExp(`^${query.roomNumber}$`, 'i');

  const [sectionCount, branchesAgg, timetableCount, dayAgg, sampleSlots] = await Promise.all([
    db.collection('sections').countDocuments({}),
    db.collection('sections').aggregate([
      { $group: { _id: '$branch', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
    db.collection('timetables').countDocuments(filter),
    db.collection('timetables').aggregate([
      { $group: { _id: '$day', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
    db.collection('timetables').find(filter).limit(6).toArray(),
  ]);

  return {
    domain: 'Academic Operations',
    sourceCollection: 'sections & timetables',
    provenance: 'Academic Semester Schedule',
    scheduledDayFilter: effectiveDay || 'All Scheduled Weekdays',
    reportingPeriod: effectiveDay ? `Weekly Schedule (${effectiveDay})` : 'Semester Master Schedule',
    hasRecords: timetableCount > 0,
    totalAcademicSections: sectionCount,
    branches: branchesAgg.map((b) => ({ branch: b._id, sectionCount: b.count })),
    totalScheduledSlots: timetableCount,
    slotsByDay: dayAgg.map((d) => ({ day: d._id, slots: d.count })),
    sampleSchedule: sampleSlots.map((s) => ({
      section: s.sectionId,
      day: s.day,
      slot: `Slot ${s.slotStart}${s.slotEnd !== s.slotStart ? `–${s.slotEnd}` : ''}`,
      subject: s.subject,
      room: s.room,
      type: s.type,
    })),
  };
}

/**
 * 3. Occupancy and Space Utilization
 * Strictly bounded: timestamp <= cutoff
 */
async function getOccupancy(query = {}, dateContext = null) {
  const db = getDb();
  const cutoff = getEffectiveCutoff(query, dateContext);

  // Find latest comprehensive snapshot on or before cutoff:
  // Weekday daytime snapshots monitor >= 50 rooms; Saturday timetable sessions monitor 14 rooms (>= 10).
  let latestSnapAgg = await db.collection('occupancy').aggregate([
    { $match: { timestamp: { $lte: cutoff } } },
    { $group: { _id: { timestamp: '$timestamp', label: '$snapshotLabel' }, count: { $sum: 1 } } },
    { $match: { count: { $gte: 10 } } },
    { $sort: { '_id.timestamp': -1 } },
    { $limit: 1 },
  ]).toArray();

  // If no snapshot with >= 10 rooms exists on or before cutoff, take the latest available snapshot
  if (latestSnapAgg.length === 0) {
    latestSnapAgg = await db.collection('occupancy').aggregate([
      { $match: { timestamp: { $lte: cutoff } } },
      { $group: { _id: { timestamp: '$timestamp', label: '$snapshotLabel' }, count: { $sum: 1 } } },
      { $sort: { '_id.timestamp': -1 } },
      { $limit: 1 },
    ]).toArray();
  }

  if (latestSnapAgg.length === 0) {
    return {
      domain: 'Campus Occupancy & Utilization',
      sourceCollection: 'occupancy',
      hasRecords: false,
      actualCutoffApplied: cutoff.toISOString(),
      reportingPeriod: formatDisplayDate(cutoff),
      message: `No occupancy telemetry records exist on or before ${formatDisplayDate(cutoff)}. The pilot monitoring baseline began on Monday, October 12, 2026.`,
      notice: dateContext?.notice || null,
    };
  }

  const latestTime = latestSnapAgg[0]._id.timestamp;
  const latestLabel = latestSnapAgg[0]._id.label;
  const snapshotDate = new Date(latestTime);
  const snapshotDisplay = `${formatDisplayDate(snapshotDate)} (${latestLabel})`;

  const [latestSlice, highUtilRooms] = await Promise.all([
    db.collection('occupancy').find({ timestamp: latestTime }).toArray(),
    db
      .collection('occupancy')
      .find({ timestamp: latestTime, utilization: { $gte: 70 } })
      .sort({ utilization: -1 })
      .limit(6)
      .toArray(),
  ]);

  const totalHeadcount = latestSlice.reduce((sum, r) => sum + (r.occupancy || 0), 0);
  const totalCapacity = latestSlice.reduce((sum, r) => sum + (r.capacity || 0), 0);
  const averageUtilization = totalCapacity > 0 ? Number(((totalHeadcount / totalCapacity) * 100).toFixed(1)) : 0;
  const inSessionCount = latestSlice.filter((r) => r.scheduled).length;

  let specificRoomMatch = null;
  if (query.roomNumber) {
    specificRoomMatch = await db
      .collection('occupancy')
      .find({
        roomNumber: new RegExp(`^${query.roomNumber}$`, 'i'),
        timestamp: { $lte: cutoff },
      })
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();
  }

  return {
    domain: 'Campus Occupancy & Utilization',
    sourceCollection: 'occupancy',
    provenance: `Pilot Telemetry Snapshot (${snapshotDisplay})`,
    hasRecords: true,
    actualCutoffApplied: cutoff.toISOString(),
    reportingPeriod: snapshotDisplay,
    snapshotLabel: latestLabel,
    snapshotTimestamp: latestTime,
    monitoredRoomsCount: latestSlice.length,
    totalPresentHeadcount: totalHeadcount,
    totalSeatingCapacity: totalCapacity,
    averageUtilizationPct: averageUtilization,
    roomsInActiveSession: inSessionCount,
    notice: dateContext?.notice || null,
    highCapacityAlertRooms: highUtilRooms.map((r) => ({
      room: r.roomNumber,
      building: r.buildingId,
      occupancy: r.occupancy,
      capacity: r.capacity,
      utilizationPct: r.utilization,
    })),
    specificRoom: specificRoomMatch && specificRoomMatch[0] ? specificRoomMatch[0] : null,
  };
}

/**
 * 4. Energy Consumption and Solar PV Generation
 * Strictly bounded: timestamp <= cutoff
 */
async function getEnergyAndSolar(query = {}, dateContext = null) {
  const db = getDb();
  const cutoff = getEffectiveCutoff(query, dateContext);
  const isMultiDay = dateContext?.temporalScope === 'multi_day_baseline';

  // 1. Find latest energy record on or before cutoff
  const latestEnergy = await db
    .collection('energyUsage')
    .find({ timestamp: { $lte: cutoff } })
    .sort({ timestamp: -1 })
    .limit(1)
    .toArray();

  if (latestEnergy.length === 0) {
    return {
      domain: 'Energy & Solar Telemetry',
      sourceCollection: 'energyUsage & solarGeneration',
      hasRecords: false,
      actualCutoffApplied: cutoff.toISOString(),
      reportingPeriod: formatDisplayDate(cutoff),
      message: `No energy or solar telemetry records exist on or before ${formatDisplayDate(cutoff)}. The pilot monitoring baseline began on Monday, October 12, 2026.`,
      notice: dateContext?.notice || null,
    };
  }

  const latestTime = latestEnergy[0].timestamp;
  const latestLabel = latestEnergy[0].snapshotLabel || 'Snapshot';
  const snapshotDate = new Date(latestTime);

  // Day window for the latest snapshot in Asia/Kolkata (00:00:00 IST to cutoff)
  const campusDayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(snapshotDate);
  const targetDayStart = new Date(`${campusDayKey}T00:00:00+05:30`);

  // 2. Compute Active Power Demand (kW) dynamically for the latest snapshot
  const activeDemandAgg = await db.collection('energyUsage').aggregate([
    { $match: { timestamp: latestTime } },
    {
      $group: {
        _id: null,
        totalWatts: {
          $sum: { $multiply: ['$powerRatingWatts', { $ifNull: ['$activeQuantity', 0] }] },
        },
      },
    },
  ]).toArray();
  const activeDemandKw = Number(((activeDemandAgg[0]?.totalWatts || 0) / 1000).toFixed(1));

  // 3. Day energy consumed vs cumulative energy consumed up to cutoff
  const [dayEnergyAgg, totalEnergyAgg] = await Promise.all([
    db.collection('energyUsage').aggregate([
      { $match: { timestamp: { $gte: targetDayStart, $lte: cutoff } } },
      { $group: { _id: null, totalKWh: { $sum: '$energyKWh' } } },
    ]).toArray(),
    db.collection('energyUsage').aggregate([
      { $match: { timestamp: { $lte: cutoff } } },
      { $group: { _id: null, totalKWh: { $sum: '$energyKWh' } } },
    ]).toArray(),
  ]);

  const dayEnergyKWh = Number((dayEnergyAgg[0]?.totalKWh || 0).toFixed(1));
  const cumulativeEnergyKWh = Number((totalEnergyAgg[0]?.totalKWh || 0).toFixed(1));

  // 4. Appliance category breakdown for that day up to cutoff
  const applianceAgg = await db.collection('energyUsage').aggregate([
    { $match: { timestamp: { $gte: targetDayStart, $lte: cutoff } } },
    {
      $group: {
        _id: '$applianceType',
        totalWatts: { $sum: { $multiply: ['$powerRatingWatts', { $ifNull: ['$activeQuantity', 0] }] } },
        totalKWh: { $sum: '$energyKWh' },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalKWh: -1 } },
  ]).toArray();

  // 5. Solar telemetry bounded by cutoff
  const [solarLatestDocs, solarDayAgg, solarCumAgg] = await Promise.all([
    db.collection('solarGeneration')
      .find({ timestamp: { $lte: cutoff } })
      .sort({ timestamp: -1, panelNumber: 1 })
      .limit(50)
      .toArray(),
    db.collection('solarGeneration').aggregate([
      { $match: { timestamp: { $gte: targetDayStart, $lte: cutoff } } },
      { $group: { _id: null, totalKWh: { $sum: '$energyGeneratedKWh' } } },
    ]).toArray(),
    db.collection('solarGeneration').aggregate([
      { $match: { timestamp: { $lte: cutoff } } },
      { $group: { _id: null, totalKWh: { $sum: '$energyGeneratedKWh' }, systemCapacityKW: { $max: '$systemCapacityKW' } } },
    ]).toArray(),
  ]);

  const simConfig = getSimulationConfig();
  const dbCapacity = solarCumAgg[0]?.systemCapacityKW || simConfig.assumedInstalledCapacityKW;
  const capacityScale = (dbCapacity > simConfig.assumedInstalledCapacityKW && dbCapacity > 0)
    ? (simConfig.assumedInstalledCapacityKW / dbCapacity)
    : 1.0;

  const latestSolarTotalKWh = solarLatestDocs.reduce((acc, p) => acc + (p.energyGeneratedKWh || 0), 0) * capacityScale;
  const latestSolarKW = calculatePowerFromIntervalEnergy(latestSolarTotalKWh, 1.6667, simConfig);
  const daySolarKWh = Number(((solarDayAgg[0]?.totalKWh || 0) * capacityScale).toFixed(2));
  const cumulativeSolarKWh = Number(((solarCumAgg[0]?.totalKWh || 0) * capacityScale).toFixed(2));

  const { netImportKW, solarOffsetPct } = calculateNetGridBalance(activeDemandKw, latestSolarKW);

  const snapshotDisplay = `${formatDisplayDate(snapshotDate)} (${latestLabel})`;

  return {
    domain: 'Energy & Solar Telemetry',
    sourceCollection: 'energyUsage & solarGeneration',
    provenance: `Pilot Telemetry Snapshot (${snapshotDisplay})`,
    hasRecords: true,
    actualCutoffApplied: cutoff.toISOString(),
    reportingPeriod: snapshotDisplay,
    snapshotTime: latestTime,
    snapshotLabel: latestLabel,
    activePowerDemandKw: activeDemandKw,
    solarActivePowerKw: latestSolarKW,
    netGridImportKw: netImportKW,
    solarOffsetPercentage: solarOffsetPct,
    dayEnergyConsumedKWh: dayEnergyKWh,
    daySolarYieldKWh: daySolarKWh,
    cumulativeEnergyConsumedKWh: isMultiDay ? cumulativeEnergyKWh : dayEnergyKWh,
    totalSolarYieldKWh: isMultiDay ? cumulativeSolarKWh : daySolarKWh,
    isMultiDayView: isMultiDay,
    solarCapacityKW: simConfig.assumedInstalledCapacityKW,
    solarArrayLocation: simConfig.arrayLocation,
    solarPanelsCount: simConfig.assumedPanelCount,
    solarAssumedPanelRatingWatts: simConfig.assumedPanelRatingWatts,
    isSimulated: true,
    simulationStatus: simConfig.simulationStatus,
    simulationDisclaimer: simConfig.disclaimer,
    applianceBreakdown: applianceAgg.map((a) => ({
      appliance: a._id,
      activeLoadKw: Number((a.totalWatts / 1000).toFixed(1)),
      totalEnergyKWh: Number(a.totalKWh.toFixed(1)),
    })),
    notice: dateContext?.notice || null,
  };
}

/**
 * 5. Water Usage Telemetry
 * Strictly bounded: timestamp <= cutoff
 */
async function getWaterUsage(query = {}, dateContext = null) {
  const db = getDb();
  const cutoff = getEffectiveCutoff(query, dateContext);

  const [totalWaterDocs, waterAgg, anomalies] = await Promise.all([
    db.collection('Waterusage').countDocuments({ timestamp: { $lte: cutoff } }),
    db.collection('Waterusage').aggregate([
      { $match: { timestamp: { $lte: cutoff } } },
      {
        $group: {
          _id: '$facilityType',
          totalUsageLiters: { $sum: '$usageLiters' },
          totalBaselineLiters: { $sum: '$baselineLiters' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalUsageLiters: -1 } },
    ]).toArray(),
    db.collection('Waterusage').find({ timestamp: { $lte: cutoff }, anomalyDetected: true }).limit(5).toArray(),
  ]);

  if (totalWaterDocs === 0) {
    return {
      domain: 'Water Utilities Monitoring',
      sourceCollection: 'Waterusage',
      hasRecords: false,
      actualCutoffApplied: cutoff.toISOString(),
      reportingPeriod: formatDisplayDate(cutoff),
      message: `No water telemetry sub-meter readings exist on or before ${formatDisplayDate(cutoff)}.`,
      notice: dateContext?.notice || null,
    };
  }

  return {
    domain: 'Water Utilities Monitoring',
    sourceCollection: 'Waterusage',
    provenance: `Pilot Telemetry Sub-Meters (As of ${formatDisplayDate(cutoff)})`,
    hasRecords: true,
    actualCutoffApplied: cutoff.toISOString(),
    reportingPeriod: `As of ${formatDisplayDate(cutoff)}`,
    totalTelemetryRecords: totalWaterDocs,
    facilitiesSummary: waterAgg.map((w) => ({
      facilityType: w._id || 'Restroom/Lab',
      consumedLiters: w.totalUsageLiters,
      baselineLiters: w.totalBaselineLiters,
      meterRecords: w.count,
    })),
    activeAnomaliesCount: anomalies.length,
    anomaliesSample: anomalies.map((a) => ({
      facility: a.facilityName,
      roomNumber: a.roomNumber,
      usageLiters: a.usageLiters,
      baselineLiters: a.baselineLiters,
      actionRecommended: a.actionRecommended,
    })),
    notice: dateContext?.notice || null,
  };
}

/**
 * 6. Campus Congestion and Pedestrian Flow
 * Strictly bounded: timestamp <= cutoff
 */
async function getCongestion(query = {}, dateContext = null) {
  const db = getDb();
  const cutoff = getEffectiveCutoff(query, dateContext);

  const [totalRecords, levelAgg, topBottlenecks] = await Promise.all([
    db.collection('congestion').countDocuments({ timestamp: { $lte: cutoff } }),
    db.collection('congestion').aggregate([
      { $match: { timestamp: { $lte: cutoff } } },
      { $group: { _id: '$congestionLevel', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
    db
      .collection('congestion')
      .find({ timestamp: { $lte: cutoff }, congestionLevel: 'High' })
      .sort({ congestionPercentage: -1 })
      .limit(5)
      .toArray(),
  ]);

  if (totalRecords === 0) {
    return {
      domain: 'Pedestrian Flow & Crowd Density',
      sourceCollection: 'congestion',
      hasRecords: false,
      actualCutoffApplied: cutoff.toISOString(),
      reportingPeriod: formatDisplayDate(cutoff),
      message: `No pedestrian flow observations exist on or before ${formatDisplayDate(cutoff)}.`,
      notice: dateContext?.notice || null,
    };
  }

  return {
    domain: 'Pedestrian Flow & Crowd Density',
    sourceCollection: 'congestion',
    provenance: `Pilot Traffic Observations (${totalRecords} observations as of ${formatDisplayDate(cutoff)})`,
    hasRecords: true,
    actualCutoffApplied: cutoff.toISOString(),
    reportingPeriod: `As of ${formatDisplayDate(cutoff)}`,
    totalObservations: totalRecords,
    congestionLevels: levelAgg.map((l) => ({ level: l._id, observations: l.count })),
    criticalBottlenecks: topBottlenecks.map((b) => ({
      zone: b.areaName,
      building: b.buildingId,
      peoplePresent: `${b.peopleCount} / ${b.capacity}`,
      densityPct: b.congestionPercentage,
      queueLength: b.queueLength,
      waitTimeMinutes: b.estimatedWaitTimeMinutes,
      guidance: b.actionRecommended,
    })),
    notice: dateContext?.notice || null,
  };
}

/**
 * 7. Maintenance Work Orders
 * Strictly bounded: reportedDate <= cutoff
 */
async function getMaintenance(query = {}, dateContext = null) {
  const db = getDb();
  const cutoff = getEffectiveCutoff(query, dateContext);

  const [totalTickets, statusAgg, priorityAgg, openHighPriority] = await Promise.all([
    db.collection('maintainence').countDocuments({ reportedDate: { $lte: cutoff } }),
    db.collection('maintainence').aggregate([
      { $match: { reportedDate: { $lte: cutoff } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
    db.collection('maintainence').aggregate([
      { $match: { reportedDate: { $lte: cutoff } } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
    db
      .collection('maintainence')
      .find({ reportedDate: { $lte: cutoff }, status: { $in: ['Open', 'In Progress'] }, priority: 'High' })
      .limit(5)
      .toArray(),
  ]);

  return {
    domain: 'Facility Maintenance & Work Orders',
    sourceCollection: 'maintainence',
    provenance: `Work Order Management System (As of ${formatDisplayDate(cutoff)})`,
    hasRecords: totalTickets > 0,
    actualCutoffApplied: cutoff.toISOString(),
    reportingPeriod: `As of ${formatDisplayDate(cutoff)}`,
    totalWorkOrders: totalTickets,
    statusBreakdown: statusAgg.map((s) => ({ status: s._id, count: s.count })),
    priorityBreakdown: priorityAgg.map((p) => ({ priority: p._id, count: p.count })),
    urgentOpenTickets: openHighPriority.map((t) => ({
      id: t._id,
      building: t.buildingId,
      room: t.roomNumber,
      asset: t.assetType,
      issue: t.issue,
      status: t.status,
      priority: t.priority,
    })),
    notice: dateContext?.notice || null,
  };
}

/**
 * 8. Campus Alerts and Incident Tripwires
 * Strictly bounded: timestamp <= cutoff
 */
async function getAlerts(query = {}, dateContext = null) {
  const db = getDb();
  const cutoff = getEffectiveCutoff(query, dateContext);

  const [totalAlerts, severityAgg, typeAgg, highPriorityAlerts, recentAlerts] = await Promise.all([
    db.collection('alerts').countDocuments({ timestamp: { $lte: cutoff } }),
    db.collection('alerts').aggregate([
      { $match: { timestamp: { $lte: cutoff } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
    db.collection('alerts').aggregate([
      { $match: { timestamp: { $lte: cutoff } } },
      { $group: { _id: '$alertType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
    db
      .collection('alerts')
      .find({ timestamp: { $lte: cutoff }, severity: { $in: ['High', 'Critical'] } })
      .sort({ timestamp: -1 })
      .limit(6)
      .toArray(),
    db
      .collection('alerts')
      .find({ timestamp: { $lte: cutoff } })
      .sort({ timestamp: -1 })
      .limit(6)
      .toArray(),
  ]);

  return {
    domain: 'Operational Incidents & Alarms',
    sourceCollection: 'alerts',
    provenance: `System Tripwires (${totalAlerts} Incidents as of ${formatDisplayDate(cutoff)})`,
    hasRecords: totalAlerts > 0,
    actualCutoffApplied: cutoff.toISOString(),
    reportingPeriod: `As of ${formatDisplayDate(cutoff)}`,
    totalActiveIncidents: totalAlerts,
    severityBreakdown: severityAgg.map((s) => ({ severity: s._id, count: s.count })),
    typeBreakdown: typeAgg.map((t) => ({ type: t._id, count: t.count })),
    activeHighSeverityAlarms: highPriorityAlerts.map((a) => ({
      alertId: a.alertId,
      type: a.alertType,
      severity: a.severity,
      building: a.buildingId,
      room: a.roomNumber,
      message: a.message,
      action: a.actionRecommended,
      timestamp: a.timestamp,
    })),
    recentAlerts: recentAlerts.map((a) => ({
      alertId: a.alertId,
      type: a.alertType,
      severity: a.severity,
      building: a.buildingId,
      room: a.roomNumber,
      message: a.message,
      action: a.actionRecommended,
      timestamp: a.timestamp,
    })),
    notice: dateContext?.notice || null,
  };
}

/**
 * 9. Comprehensive Executive Overview
 * Synchronously passes dateContext to all getters
 */
async function getExecutiveOverview(query = {}, dateContext = null) {
  const [buildingsRes, occupancyRes, energyRes, alertsRes, maintenanceRes] = await Promise.all([
    getBuildingsAndRooms(query, dateContext),
    getOccupancy(query, dateContext),
    getEnergyAndSolar(query, dateContext),
    getAlerts(query, dateContext),
    getMaintenance(query, dateContext),
  ]);

  const cutoff = getEffectiveCutoff(query, dateContext);

  return {
    domain: 'Executive Campus Overview',
    sourceCollection: 'Multi-Collection Synthesis',
    provenance: `AIT Campus Intelligence State (${formatDisplayDate(cutoff)})`,
    actualCutoffApplied: cutoff.toISOString(),
    reportingPeriod: formatDisplayDate(cutoff),
    hasRecords: energyRes.hasRecords || occupancyRes.hasRecords,
    buildingsOnline: `${buildingsRes.totalBuildings} / ${buildingsRes.totalBuildings}`,
    campusHeadcount: occupancyRes.totalPresentHeadcount || 0,
    averageUtilization: `${occupancyRes.averageUtilizationPct || 0}%`,
    activeEnergyDemandKw: energyRes.activePowerDemandKw || 0,
    solarYieldKw: energyRes.solarActivePowerKw || 0,
    netGridImportKw: energyRes.netGridImportKw || 0,
    solarOffsetPct: `${energyRes.solarOffsetPercentage || 0}%`,
    criticalAlertsCount: alertsRes.activeHighSeverityAlarms?.length || 0,
    openMaintenanceTickets:
      maintenanceRes.statusBreakdown?.find((s) => s.status === 'Open')?.count || 0,
    notice: dateContext?.notice || null,
  };
}

module.exports = {
  getBuildingsAndRooms,
  getAcademicTimetable,
  getOccupancy,
  getEnergyAndSolar,
  getWaterUsage,
  getCongestion,
  getMaintenance,
  getAlerts,
  getExecutiveOverview,
};

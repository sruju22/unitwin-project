const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const {
  getSimulationConfig,
  calculatePowerFromIntervalEnergy,
  calculateSimulatedSolarPower,
  getPanelBreakdown,
} = require('../services/solarSimulationService');

/**
 * GET /api/solar-generation
 * List and aggregate rooftop solar PV generation records from MongoDB Atlas
 */
router.get('/', async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const simConfig = getSimulationConfig();
    const filter = {};

    if (req.query.buildingId) {
      filter.buildingId = req.query.buildingId;
    }
    if (req.query.systemId) {
      filter.systemId = req.query.systemId;
    }
    if (req.query.panelId) {
      filter.panelId = req.query.panelId;
    }
    if (req.query.timelineLabel) {
      filter.timelineLabel = new RegExp(req.query.timelineLabel, 'i');
    }
    if (req.query.date) {
      // Filter by YYYY-MM-DD
      const start = new Date(`${req.query.date}T00:00:00.000Z`);
      const end = new Date(`${req.query.date}T23:59:59.999Z`);
      filter.timestamp = { $gte: start, $lte: end };
    }

    const limit = parseInt(req.query.limit, 10) || 300;

    const [records, totalAgg, dailyAgg, intervalAgg, panelAgg, latestDocs] = await Promise.all([
      db.collection('solarGeneration').find(filter).sort({ timestamp: -1, panelNumber: 1 }).limit(limit).toArray(),
      
      // Total statistics across filtered records
      db.collection('solarGeneration').aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalKWh: { $sum: '$energyGeneratedKWh' },
            count: { $sum: 1 },
            systemCapacityKW: { $max: '$systemCapacityKW' },
            panelCount: { $addToSet: '$panelId' },
          },
        },
      ]).toArray(),

      // Daily totals
      db.collection('solarGeneration').aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            totalKWh: { $sum: '$energyGeneratedKWh' },
            readingsCount: { $sum: 1 },
            maxReadingKWh: { $max: '$energyGeneratedKWh' },
          },
        },
        { $sort: { _id: 1 } },
      ]).toArray(),

      // Interval snapshot timeline
      db.collection('solarGeneration').aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$timestamp',
            timelineLabel: { $first: '$timelineLabel' },
            totalKWh: { $sum: '$energyGeneratedKWh' },
            readingCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]).toArray(),

      // Individual panel performance
      db.collection('solarGeneration').aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$panelId',
            panelNumber: { $first: '$panelNumber' },
            panelCapacityKW: { $first: '$panelCapacityKW' },
            location: { $first: '$installationLocation' },
            totalKWh: { $sum: '$energyGeneratedKWh' },
            readingCount: { $sum: 1 },
          },
        },
        { $sort: { panelNumber: 1 } },
      ]).toArray(),

      // Latest 10 panel readings for active snapshot
      db.collection('solarGeneration').find(filter).sort({ timestamp: -1, panelNumber: 1 }).limit(10).toArray(),
    ]);

    const totalStats = totalAgg[0] || { totalKWh: 0, count: 0, systemCapacityKW: simConfig.assumedInstalledCapacityKW, panelCount: [] };
    const latestTimestamp = latestDocs[0]?.timestamp || null;
    const latestSnapshotTotalKWh = latestDocs.reduce((acc, p) => acc + (p.energyGeneratedKWh || 0), 0);
    
    // Estimate instantaneous power (kW) using configurable assumed capacity & elapsed hours
    const estimatedActiveKW = calculatePowerFromIntervalEnergy(latestSnapshotTotalKWh, 2.5, simConfig);

    const dailyTimeline = dailyAgg.map((d) => ({
      date: d._id,
      totalKWh: Number(d.totalKWh.toFixed(2)),
      readingsCount: d.readingsCount,
    }));

    const intervalTimeline = intervalAgg.map((t) => ({
      timestamp: t._id,
      timelineLabel: t.timelineLabel || 'Snapshot',
      totalKWh: Number(t.totalKWh.toFixed(2)),
      avgPanelKWh: Number((t.totalKWh / (t.readingCount || simConfig.assumedPanelCount)).toFixed(3)),
      estimatedKW: calculatePowerFromIntervalEnergy(t.totalKWh, 2.5, simConfig),
    }));

    const panels = panelAgg.map((p) => ({
      panelId: p._id,
      panelNumber: p.panelNumber,
      capacityKW: simConfig.assumedPanelCapacityKW,
      location: p.location || simConfig.arrayLocation,
      totalGeneratedKWh: Number(p.totalKWh.toFixed(2)),
      averagePerReadingKWh: Number((p.totalKWh / (p.readingCount || 1)).toFixed(3)),
    }));

    const summary = {
      systemId: simConfig.systemId,
      systemName: 'Main Building Rooftop Solar PV Array',
      buildingId: 'BLD001',
      buildingName: 'Main Building',
      installationLocation: simConfig.arrayLocation,
      systemCapacityKW: simConfig.assumedInstalledCapacityKW,
      panelCount: panels.length || simConfig.assumedPanelCount,
      panelCapacityKW: simConfig.assumedPanelCapacityKW,
      panelRatingWatts: simConfig.assumedPanelRatingWatts,
      totalGeneratedKWh: Number(totalStats.totalKWh.toFixed(2)),
      dailyAverageKWh: Number((totalStats.totalKWh / Math.max(1, dailyTimeline.length)).toFixed(2)),
      peakIntervalKWh: 8.34,
      peakEstimatedKW: calculatePowerFromIntervalEnergy(8.34, 2.5, simConfig),
      latestSnapshot: {
        timestamp: latestTimestamp,
        timelineLabel: latestDocs[0]?.timelineLabel || 'Active Snapshot',
        intervalEnergyKWh: Number(latestSnapshotTotalKWh.toFixed(2)),
        estimatedActivePowerKW: estimatedActiveKW,
        readingType: latestDocs[0]?.readingType || 'interval_energy_estimate',
      },
      monitoringDaysCount: dailyTimeline.length,
      isPrototype: records.some((r) => r.prototype === true),
      simulationAssumptions: {
        isSimulation: true,
        simulationStatus: simConfig.simulationStatus,
        assumedPanelCount: simConfig.assumedPanelCount,
        assumedPanelRatingWatts: simConfig.assumedPanelRatingWatts,
        assumedInstalledCapacityKW: simConfig.assumedInstalledCapacityKW,
        assumedSystemLossFactor: simConfig.assumedSystemLossFactor,
        effectiveTimezone: simConfig.effectiveTimezone,
        disclaimer: simConfig.disclaimer,
      },
      dailyTimeline,
      intervalTimeline,
      panels,
    };

    res.json({
      success: true,
      count: records.length,
      summary,
      data: records,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/solar-generation/summary
 * Direct summary metric endpoint
 */
router.get('/summary', async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const simConfig = getSimulationConfig();
    const [totalAgg, latestDocs, dailyAgg] = await Promise.all([
      db.collection('solarGeneration').aggregate([
        {
          $group: {
            _id: null,
            totalKWh: { $sum: '$energyGeneratedKWh' },
            count: { $sum: 1 },
          },
        },
      ]).toArray(),
      db.collection('solarGeneration').find().sort({ timestamp: -1, panelNumber: 1 }).limit(10).toArray(),
      db.collection('solarGeneration').aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            totalKWh: { $sum: '$energyGeneratedKWh' },
          },
        },
        { $sort: { _id: 1 } },
      ]).toArray(),
    ]);

    const totalKWh = totalAgg[0]?.totalKWh || 0;
    const latestSnapshotTotalKWh = latestDocs.reduce((acc, p) => acc + (p.energyGeneratedKWh || 0), 0);
    const estimatedActiveKW = calculatePowerFromIntervalEnergy(latestSnapshotTotalKWh, 2.5, simConfig);

    res.json({
      success: true,
      data: {
        systemId: simConfig.systemId,
        buildingId: 'BLD001',
        systemCapacityKW: simConfig.assumedInstalledCapacityKW,
        panelCount: simConfig.assumedPanelCount,
        panelCapacityKW: simConfig.assumedPanelCapacityKW,
        panelRatingWatts: simConfig.assumedPanelRatingWatts,
        totalGeneratedKWh: Number(totalKWh.toFixed(2)),
        dailyAverageKWh: Number((totalKWh / Math.max(1, dailyAgg.length)).toFixed(2)),
        latestSnapshot: {
          timestamp: latestDocs[0]?.timestamp || null,
          timelineLabel: latestDocs[0]?.timelineLabel || 'Active Snapshot',
          intervalEnergyKWh: Number(latestSnapshotTotalKWh.toFixed(2)),
          estimatedActivePowerKW: estimatedActiveKW,
        },
        simulationAssumptions: {
          isSimulation: true,
          status: simConfig.simulationStatus,
          assumedPanelCount: simConfig.assumedPanelCount,
          assumedPanelRatingWatts: simConfig.assumedPanelRatingWatts,
          assumedInstalledCapacityKW: simConfig.assumedInstalledCapacityKW,
          disclaimer: simConfig.disclaimer,
        },
        dailyTimeline: dailyAgg.map((d) => ({
          date: d._id,
          totalKWh: Number(d.totalKWh.toFixed(2)),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/solar-generation/simulate
 * Explicit diurnal solar physics simulation endpoint for any date/time.
 * Computes instantaneous power, panel breakdown, and 24h curve.
 */
router.get('/simulate', (req, res, next) => {
  try {
    const simConfig = getSimulationConfig();
    const queryDate = req.query.timestamp ? new Date(req.query.timestamp) : new Date();
    const targetDate = isNaN(queryDate.getTime()) ? new Date() : queryDate;

    // Instantaneous output for the target timestamp
    const instantaneous = calculateSimulatedSolarPower(targetDate, simConfig);
    const panelBreakdown = getPanelBreakdown(instantaneous.solarPowerKW, simConfig);

    // 24-hour diurnal profile for the same calendar date
    const dateStr = instantaneous.dateStr;
    const diurnal24h = [];
    for (let h = 0; h < 24; h++) {
      // Create date representing that hour in IST (UTC+5:30)
      // IST is UTC + 5h30m -> UTC hour = h - 5.5
      const hourDate = new Date(`${dateStr}T${String(h).padStart(2, '0')}:00:00+05:30`);
      const point = calculateSimulatedSolarPower(hourDate, simConfig);
      diurnal24h.push({
        hour: h,
        timeLabel: `${String(h).padStart(2, '0')}:00`,
        solarPowerKW: point.solarPowerKW,
        capacityUtilizationPct: point.capacityUtilizationPct,
        isDaylight: point.isDaylight,
      });
    }

    res.json({
      success: true,
      simulationModel: 'Physical Solar Diurnal Clear-Sky Arc with Atmospheric Modulation',
      assumptions: {
        assumedPanelCount: simConfig.assumedPanelCount,
        assumedPanelRatingWatts: simConfig.assumedPanelRatingWatts,
        assumedInstalledCapacityKW: simConfig.assumedInstalledCapacityKW,
        assumedSystemLossFactor: simConfig.assumedSystemLossFactor,
        effectiveTimezone: simConfig.effectiveTimezone,
        disclaimer: simConfig.disclaimer,
      },
      instantaneous: {
        ...instantaneous,
        panels: panelBreakdown,
      },
      diurnal24h,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

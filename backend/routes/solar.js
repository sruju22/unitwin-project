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
    if (req.query.snapshotTimestamp) {
      const snapDate = new Date(req.query.snapshotTimestamp);
      if (!isNaN(snapDate.getTime())) {
        filter.timestamp = snapDate;
      }
    } else if (req.query.date) {
      // Filter by YYYY-MM-DD in Asia/Kolkata
      const start = new Date(`${req.query.date}T00:00:00+05:30`);
      const end = new Date(`${req.query.date}T23:59:59.999+05:30`);
      filter.timestamp = { $gte: start, $lte: end };
    } else if (req.query.asOfDate) {
      const parsedDate = new Date(req.query.asOfDate);
      if (!isNaN(parsedDate.getTime())) {
        filter.timestamp = { ...(filter.timestamp || {}), $lte: parsedDate };
      }
    }

    const limit = parseInt(req.query.limit, 10) || 2500;

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
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Kolkata' } },
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

      // Latest panel readings for active snapshot
      db.collection('solarGeneration').find(filter).sort({ timestamp: -1, panelNumber: 1 }).limit(simConfig.assumedPanelCount).toArray(),
    ]);

    const totalStats = totalAgg[0] || { totalKWh: 0, count: 0, systemCapacityKW: simConfig.assumedInstalledCapacityKW, panelCount: [] };
    const latestTimestamp = latestDocs[0]?.timestamp || null;

    // Normalize historical energy if DB documents carry legacy capacity assumptions (e.g. 100 kWp vs 20 kWp)
    const dbCapacity = totalStats.systemCapacityKW || simConfig.assumedInstalledCapacityKW;
    const capacityScale = (dbCapacity > simConfig.assumedInstalledCapacityKW && dbCapacity > 0)
      ? (simConfig.assumedInstalledCapacityKW / dbCapacity)
      : 1.0;

    const latestSnapshotTotalKWh = latestDocs.reduce((acc, p) => acc + (p.energyGeneratedKWh || 0), 0) * capacityScale;
    
    // Estimate instantaneous power (kW) using configurable assumed capacity & elapsed hours
    const estimatedActiveKW = calculatePowerFromIntervalEnergy(latestSnapshotTotalKWh, 1.6667, simConfig);

    const dailyTimeline = dailyAgg.map((d) => ({
      date: d._id,
      totalKWh: Number((d.totalKWh * capacityScale).toFixed(2)),
      readingsCount: d.readingsCount,
    }));

    const intervalTimeline = intervalAgg.map((t) => ({
      timestamp: t._id,
      timelineLabel: t.timelineLabel || 'Snapshot',
      totalKWh: Number((t.totalKWh * capacityScale).toFixed(2)),
      avgPanelKWh: Number(((t.totalKWh * capacityScale) / (t.readingCount || simConfig.assumedPanelCount)).toFixed(3)),
      estimatedKW: calculatePowerFromIntervalEnergy(t.totalKWh * capacityScale, 1.6667, simConfig),
    }));

    const latestPanelMap = {};
    latestDocs.forEach((doc) => {
      latestPanelMap[doc.panelId] = doc;
    });

    const panels = panelAgg.map((p) => {
      const latestDoc = latestPanelMap[p._id];
      const latestPanelEnergy = (latestDoc ? latestDoc.energyGeneratedKWh : (p.totalKWh / Math.max(1, p.readingCount || 25))) * capacityScale;
      const panelPowerKW = calculatePowerFromIntervalEnergy(
        latestPanelEnergy,
        1.6667,
        { assumedInstalledCapacityKW: simConfig.assumedPanelCapacityKW }
      );
      return {
        panelId: p._id,
        panelNumber: p.panelNumber,
        capacityKW: simConfig.assumedPanelCapacityKW,
        currentPowerKW: panelPowerKW,
        location: p.location || simConfig.arrayLocation,
        totalGeneratedKWh: Number((p.totalKWh * capacityScale).toFixed(2)),
        averagePerReadingKWh: Number(((p.totalKWh * capacityScale) / (p.readingCount || 1)).toFixed(3)),
        status: panelPowerKW > 0 ? 'Generating (Online)' : 'Standby',
      };
    });

    const maxIntervalTotalKWh = intervalTimeline.reduce((max, t) => Math.max(max, t.totalKWh), 0) || 25.0;

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
      currentSolarPowerKW: estimatedActiveKW,
      totalGeneratedKWh: Number((totalStats.totalKWh * capacityScale).toFixed(2)),
      reportingPeriod: (() => {
        const dailyDates = dailyTimeline.map((d) => d.date).sort();
        if (dailyDates.length === 1) {
          const d = new Date(`${dailyDates[0]}T12:00:00+05:30`);
          return `${new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }).format(d)} (Single-day view)`;
        } else if (dailyDates.length > 1) {
          const firstD = new Date(`${dailyDates[0]}T12:00:00+05:30`);
          const lastD = new Date(`${dailyDates[dailyDates.length - 1]}T12:00:00+05:30`);
          const firstFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' }).format(firstD);
          const lastFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }).format(lastD);
          return `${firstFmt}–${lastFmt} (${dailyDates.length}-day monitoring baseline)`;
        }
        return 'Pilot Solar Baseline';
      })(),
      dailyAverageKWh: Number(((totalStats.totalKWh * capacityScale) / Math.max(1, dailyTimeline.length)).toFixed(2)),
      peakIntervalKWh: Number(maxIntervalTotalKWh.toFixed(2)),
      peakEstimatedKW: calculatePowerFromIntervalEnergy(maxIntervalTotalKWh, 1.6667, simConfig),
      latestReadingTimestamp: latestTimestamp,
      totalRecordsCount: totalStats.count || records.length,
      latestSnapshot: {
        timestamp: latestTimestamp,
        timelineLabel: latestDocs[0]?.timelineLabel || 'Active Snapshot',
        currentSolarPowerKW: estimatedActiveKW,
        estimatedActivePowerKW: estimatedActiveKW,
        intervalEnergyKWh: Number(latestSnapshotTotalKWh.toFixed(2)),
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
            systemCapacityKW: { $max: '$systemCapacityKW' },
          },
        },
      ]).toArray(),
      db.collection('solarGeneration').find().sort({ timestamp: -1, panelNumber: 1 }).limit(simConfig.assumedPanelCount).toArray(),
      db.collection('solarGeneration').aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Kolkata' } },
            totalKWh: { $sum: '$energyGeneratedKWh' },
          },
        },
        { $sort: { _id: 1 } },
      ]).toArray(),
    ]);

    const dbCapacity = totalAgg[0]?.systemCapacityKW || simConfig.assumedInstalledCapacityKW;
    const capacityScale = (dbCapacity > simConfig.assumedInstalledCapacityKW && dbCapacity > 0)
      ? (simConfig.assumedInstalledCapacityKW / dbCapacity)
      : 1.0;

    const totalKWh = (totalAgg[0]?.totalKWh || 0) * capacityScale;
    const latestSnapshotTotalKWh = latestDocs.reduce((acc, p) => acc + (p.energyGeneratedKWh || 0), 0) * capacityScale;
    const estimatedActiveKW = calculatePowerFromIntervalEnergy(latestSnapshotTotalKWh, 1.6667, simConfig);

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
        reportingPeriod: (() => {
          const dailyDates = dailyAgg.map((d) => d._id).sort();
          if (dailyDates.length === 1) {
            const d = new Date(`${dailyDates[0]}T12:00:00+05:30`);
            return `${new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }).format(d)} (Single-day view)`;
          } else if (dailyDates.length > 1) {
            const firstD = new Date(`${dailyDates[0]}T12:00:00+05:30`);
            const lastD = new Date(`${dailyDates[dailyDates.length - 1]}T12:00:00+05:30`);
            const firstFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' }).format(firstD);
            const lastFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }).format(lastD);
            return `${firstFmt}–${lastFmt} (${dailyDates.length}-day monitoring baseline)`;
          }
          return 'Pilot Solar Baseline';
        })(),
        currentSolarPowerKW: estimatedActiveKW,
        dailyAverageKWh: Number((totalKWh / Math.max(1, dailyAgg.length)).toFixed(2)),
        latestReadingTimestamp: latestDocs[0]?.timestamp || null,
        latestSnapshot: {
          timestamp: latestDocs[0]?.timestamp || null,
          timelineLabel: latestDocs[0]?.timelineLabel || 'Active Snapshot',
          currentSolarPowerKW: estimatedActiveKW,
          estimatedActivePowerKW: estimatedActiveKW,
          intervalEnergyKWh: Number(latestSnapshotTotalKWh.toFixed(2)),
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
          totalKWh: Number((d.totalKWh * capacityScale).toFixed(2)),
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

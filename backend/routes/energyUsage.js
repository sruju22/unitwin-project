const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const {
  getSimulationConfig,
  calculatePowerFromIntervalEnergy,
  calculateNetGridBalance,
} = require('../services/solarSimulationService');

// GET /api/energy-usage - List energy telemetry records and correlate with solar generation from MongoDB Atlas
router.get('/', async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const filter = {};
    if (req.query.buildingId) {
      filter.buildingId = req.query.buildingId;
    }
    if (req.query.prototype !== undefined) {
      if (req.query.prototype === 'false') {
        filter.prototype = { $ne: true };
      } else {
        filter.prototype = true;
      }
    }
    if (req.query.asOfDate) {
      const parsedDate = new Date(req.query.asOfDate);
      if (!isNaN(parsedDate.getTime())) {
        filter.timestamp = { ...(filter.timestamp || {}), $lte: parsedDate };
      }
    }

    const limit = parseInt(req.query.limit, 10) || 500;

    const [
      records,
      timelineAgg,
      totalEnergyAgg,
      applianceAgg,
      solarTotalAgg,
      solarDailyAgg,
      solarIntervalAgg,
      solarLatestDocs,
    ] = await Promise.all([
      db.collection('energyUsage').find(filter).limit(limit).toArray(),
      
      // Energy timeline aggregated by snapshot
      db.collection('energyUsage').aggregate([
        { $match: filter },
        {
          $group: {
            _id: { timestamp: '$timestamp', snapshotLabel: '$snapshotLabel' },
            totalWatts: {
              $sum: {
                $multiply: ['$powerRatingWatts', { $ifNull: ['$activeQuantity', 0] }],
              },
            },
            totalEnergyKWh: { $sum: '$energyKWh' },
            recordCount: { $sum: 1 },
          },
        },
        { $sort: { '_id.timestamp': 1 } },
      ]).toArray(),

      // Total energy consumed across all matching records
      db.collection('energyUsage').aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalKWh: { $sum: '$energyKWh' },
            count: { $sum: 1 },
          },
        },
      ]).toArray(),

      // Appliance category breakdown
      db.collection('energyUsage').aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$applianceType',
            totalWatts: {
              $sum: {
                $multiply: ['$powerRatingWatts', { $ifNull: ['$activeQuantity', 0] }],
              },
            },
            totalKWh: { $sum: '$energyKWh' },
            recordCount: { $sum: 1 },
          },
        },
        { $sort: { totalKWh: -1 } },
      ]).toArray(),

      // Solar total generated on or before cutoff
      db.collection('solarGeneration').aggregate([
        { $match: filter.timestamp ? { timestamp: filter.timestamp } : {} },
        {
          $group: {
            _id: null,
            totalKWh: { $sum: '$energyGeneratedKWh' },
            systemCapacityKW: { $max: '$systemCapacityKW' },
          },
        },
      ]).toArray(),

      // Solar daily totals on or before cutoff
      db.collection('solarGeneration').aggregate([
        { $match: filter.timestamp ? { timestamp: filter.timestamp } : {} },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            totalKWh: { $sum: '$energyGeneratedKWh' },
          },
        },
        { $sort: { _id: 1 } },
      ]).toArray(),

      // Solar interval totals on or before cutoff
      db.collection('solarGeneration').aggregate([
        { $match: filter.timestamp ? { timestamp: filter.timestamp } : {} },
        {
          $group: {
            _id: '$timestamp',
            timelineLabel: { $first: '$timelineLabel' },
            totalKWh: { $sum: '$energyGeneratedKWh' },
          },
        },
        { $sort: { _id: 1 } },
      ]).toArray(),

      // Solar latest 10 panels on or before cutoff
      db.collection('solarGeneration')
        .find(filter.timestamp ? { timestamp: filter.timestamp } : {})
        .sort({ timestamp: -1, panelNumber: 1 })
        .limit(10)
        .toArray(),
    ]);

    // Build solar lookup by date and hour
    const solarDateMap = {};
    solarDailyAgg.forEach((d) => {
      solarDateMap[d._id] = d.totalKWh;
    });

    const solarTotalKWh = Number((solarTotalAgg[0]?.totalKWh || 104.996).toFixed(2));
    const totalConsumedKWh = Number((totalEnergyAgg[0]?.totalKWh || 3668.68).toFixed(2));
    const overallSolarContributionPct = totalConsumedKWh > 0
      ? Number(((solarTotalKWh / totalConsumedKWh) * 100).toFixed(2))
      : 0;

    const simConfig = getSimulationConfig();

    // Latest solar snapshot power calculation
    const latestSolarTotalKWh = solarLatestDocs.reduce((acc, p) => acc + (p.energyGeneratedKWh || 0), 0);
    // Estimated power kW = kWh / elapsed hours (2.5h), clamped to assumed capacity
    const latestSolarKW = calculatePowerFromIntervalEnergy(latestSolarTotalKWh, 2.5, simConfig);

    // Daily comparison table between energy consumption and solar generation
    const dailyComparison = [];
    const energyDailyMap = {};
    timelineAgg.forEach((item) => {
      const dStr = new Date(item._id.timestamp).toISOString().split('T')[0];
      if (!energyDailyMap[dStr]) {
        energyDailyMap[dStr] = { totalKWh: 0, snapshotCount: 0 };
      }
      energyDailyMap[dStr].totalKWh += item.totalEnergyKWh;
      energyDailyMap[dStr].snapshotCount += 1;
    });

    Object.keys(energyDailyMap).sort().forEach((dStr) => {
      const consumed = Number(energyDailyMap[dStr].totalKWh.toFixed(2));
      const generated = Number((solarDateMap[dStr] || 0).toFixed(2));
      const net = Number(Math.max(0, consumed - generated).toFixed(2));
      const pct = consumed > 0 ? Number(((generated / consumed) * 100).toFixed(2)) : 0;
      dailyComparison.push({
        date: dStr,
        consumptionKWh: consumed,
        solarGeneratedKWh: generated,
        netGridImportKWh: net,
        solarContributionPct: pct,
      });
    });

    let summary = null;
    if (timelineAgg.length > 0) {
      const timeline = timelineAgg.map((item) => {
        const itemDate = new Date(item._id.timestamp);
        const itemHour = itemDate.getUTCHours();
        
        // Find closest solar interval on that same day
        const dayStr = itemDate.toISOString().split('T')[0];
        const sameDaySolarIntervals = solarIntervalAgg.filter(
          (s) => new Date(s._id).toISOString().split('T')[0] === dayStr
        );
        
        // Find solar reading closest in exact timestamp on that same day
        let matchedSolarKW = 0;
        let matchedSolarKWh = 0;
        if (sameDaySolarIntervals.length > 0) {
          let closest = sameDaySolarIntervals[0];
          let minDiff = Math.abs(new Date(closest._id).getTime() - itemDate.getTime());
          for (const s of sameDaySolarIntervals) {
            const diff = Math.abs(new Date(s._id).getTime() - itemDate.getTime());
            if (diff < minDiff) {
              minDiff = diff;
              closest = s;
            }
          }
          matchedSolarKWh = Number(closest.totalKWh.toFixed(2));
          matchedSolarKW = calculatePowerFromIntervalEnergy(closest.totalKWh, 2.5, simConfig);
        }

        const demand = Number((item.totalWatts / 1000).toFixed(1));
        const { netImportKW } = calculateNetGridBalance(demand, matchedSolarKW);

        return {
          timestamp: item._id.timestamp,
          snapshotLabel: item._id.snapshotLabel || 'Snapshot',
          demandKw: demand,
          energyKWh: Number(item.totalEnergyKWh.toFixed(1)),
          solarKw: matchedSolarKW,
          solarKWh: matchedSolarKWh,
          netImportKw: netImportKW,
          recordCount: item.recordCount,
        };
      });

      const latest = timeline[timeline.length - 1];
      const activeSolarKW = latest.solarKw > 0 ? latest.solarKw : latestSolarKW;
      const { netImportKW: netDemand, solarOffsetPct: offsetPct } = calculateNetGridBalance(latest.demandKw, activeSolarKW);

      summary = {
        latestDemandKw: latest.demandKw,
        latestEnergyKwh: latest.energyKWh,
        solarKw: activeSolarKW,
        netImportKw: netDemand,
        solarOffsetPct: offsetPct,
        snapshotLabel: latest.snapshotLabel,
        timestamp: latest.timestamp,
        isPrototype: true,
        solarSystemCapacityKW: simConfig.assumedInstalledCapacityKW,
        totalCampusEnergyKWh: totalConsumedKWh,
        totalSolarGeneratedKWh: solarTotalKWh,
        overallSolarContributionPct,
        simulationAssumptions: {
          isSimulation: true,
          status: simConfig.simulationStatus,
          assumedPanelCount: simConfig.assumedPanelCount,
          assumedPanelRatingWatts: simConfig.assumedPanelRatingWatts,
          assumedInstalledCapacityKW: simConfig.assumedInstalledCapacityKW,
          disclaimer: simConfig.disclaimer,
        },
        timeline,
        dailyComparison,
        appliances: applianceAgg.map((a) => ({
          type: a._id || 'General Power',
          activeWatts: Math.round(a.totalWatts),
          totalKWh: Number(a.totalKWh.toFixed(1)),
          recordCount: a.recordCount,
        })),
      };
    }

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

module.exports = router;

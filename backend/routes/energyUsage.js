const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const {
  getSimulationConfig,
  calculatePowerFromIntervalEnergy,
  calculateNetGridBalance,
  calculateSimulatedSolarPower,
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
    const now = new Date();
    const todayKolkataStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    if (req.query.snapshotTimestamp) {
      const snapDate = new Date(req.query.snapshotTimestamp);
      if (!isNaN(snapDate.getTime())) {
        filter.timestamp = snapDate;
      }
    } else if (req.query.date) {
      // Filter by YYYY-MM-DD in Asia/Kolkata
      const start = new Date(`${req.query.date}T00:00:00+05:30`);
      const endOfDay = new Date(`${req.query.date}T23:59:59.999+05:30`);
      let effectiveCutoff = endOfDay;

      if (req.query.asOfDate) {
        const clientAsOf = new Date(req.query.asOfDate);
        if (!isNaN(clientAsOf.getTime())) {
          effectiveCutoff = clientAsOf < endOfDay ? clientAsOf : endOfDay;
        }
      } else if (req.query.date === todayKolkataStr) {
        // When viewing the current day without explicit asOfDate, bound by now (no future leak)
        effectiveCutoff = now < endOfDay ? now : endOfDay;
      }

      filter.timestamp = { $gte: start, $lte: effectiveCutoff };
    } else if (req.query.asOfDate) {
      const parsedDate = new Date(req.query.asOfDate);
      if (!isNaN(parsedDate.getTime())) {
        filter.timestamp = { ...(filter.timestamp || {}), $lte: parsedDate };
      }
    }

    const limit = parseInt(req.query.limit, 10) || 500;
    const solarFilter = filter.timestamp ? { timestamp: filter.timestamp } : {};

    const [
      records,
      timelineAgg,
      totalEnergyAgg,
      applianceAgg,
      solarTotalAgg,
      solarDailyAgg,
      solarIntervalAgg,
      solarLatestDocs,
      totalEnergyDocCount,
      totalSolarDocCount,
      allDaysEnergyDailyAgg,
      allDaysSolarDailyAgg,
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
        { $match: solarFilter },
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
        { $match: solarFilter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Kolkata' } },
            totalKWh: { $sum: '$energyGeneratedKWh' },
          },
        },
        { $sort: { _id: 1 } },
      ]).toArray(),

      // Solar interval totals across monitoring days for correlation with energy snapshots
      db.collection('solarGeneration').aggregate([
        { $match: solarFilter },
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

      // Solar latest panel readings on or before cutoff
      db.collection('solarGeneration')
        .find(solarFilter)
        .sort({ timestamp: -1, panelNumber: 1 })
        .limit(50)
        .toArray(),

      db.collection('energyUsage').countDocuments(filter),
      db.collection('solarGeneration').countDocuments(solarFilter),

      // Multi-day daily energy aggregation across all monitoring days
      db.collection('energyUsage').aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Kolkata' } },
            totalKWh: { $sum: '$energyKWh' },
            snapshotCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]).toArray(),

      // Multi-day daily solar aggregation across all monitoring days
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

    const simConfig = getSimulationConfig();
    const dbCapacity = solarTotalAgg[0]?.systemCapacityKW || simConfig.assumedInstalledCapacityKW;
    const capacityScale = (dbCapacity > simConfig.assumedInstalledCapacityKW && dbCapacity > 0)
      ? (simConfig.assumedInstalledCapacityKW / dbCapacity)
      : 1.0;

    // Build solar lookup across all monitoring days
    const solarDateMap = {};
    allDaysSolarDailyAgg.forEach((d) => {
      solarDateMap[d._id] = d.totalKWh * capacityScale;
    });

    const energyDailyMap = {};
    allDaysEnergyDailyAgg.forEach((item) => {
      energyDailyMap[item._id] = { totalKWh: item.totalKWh, snapshotCount: item.snapshotCount };
    });

    const rawSolarTotal = solarTotalAgg[0]?.totalKWh;
    const solarTotalKWh = Number(((rawSolarTotal ? rawSolarTotal * capacityScale : 0)).toFixed(2));
    const totalConsumedKWh = Number((totalEnergyAgg[0]?.totalKWh || 0).toFixed(2));
    const overallSolarContributionPct = totalConsumedKWh > 0
      ? Number(((solarTotalKWh / totalConsumedKWh) * 100).toFixed(2))
      : 0;

    // Latest solar snapshot power calculation
    const latestSolarTotalKWh = solarLatestDocs.reduce((acc, p) => acc + (p.energyGeneratedKWh || 0), 0) * capacityScale;
    // Estimated power kW = kWh / elapsed hours (1.6667h), clamped to assumed capacity
    const latestSolarKW = calculatePowerFromIntervalEnergy(latestSolarTotalKWh, 1.6667, simConfig);

    // Daily comparison table between energy consumption and solar generation
    const dailyComparison = [];
    const targetDayKey = req.query.date || null;
    const allDates = Array.from(new Set([...Object.keys(energyDailyMap), ...Object.keys(solarDateMap)])).sort();
    allDates.forEach((dStr) => {
      const consumed = Number((energyDailyMap[dStr]?.totalKWh || 0).toFixed(2));
      const generated = Number((solarDateMap[dStr] || 0).toFixed(2));
      const net = Number(Math.max(0, consumed - generated).toFixed(2));
      const gridExport = Number(Math.max(0, generated - consumed).toFixed(2));
      const pct = consumed > 0 ? Number(((generated / consumed) * 100).toFixed(2)) : (generated > 0 ? 100 : 0);
      dailyComparison.push({
        date: dStr,
        consumptionKWh: consumed,
        solarGeneratedKWh: generated,
        netGridImportKWh: net,
        gridExportKWh: gridExport,
        solarContributionPct: pct,
        isReportingDate: targetDayKey ? dStr === targetDayKey : false,
      });
    });

    const selectedDayRow = targetDayKey ? dailyComparison.find((d) => d.date === targetDayKey) : null;
    const dayEnergyConsumedKWh = selectedDayRow ? selectedDayRow.consumptionKWh : (targetDayKey ? 0 : totalConsumedKWh);
    const daySolarYieldKWh = selectedDayRow ? selectedDayRow.solarGeneratedKWh : (targetDayKey ? 0 : solarTotalKWh);
    const cumulativeCampusEnergyKWh = Number(allDaysEnergyDailyAgg.reduce((s, d) => s + (d.totalKWh || 0), 0).toFixed(2));
    const cumulativeSolarGeneratedKWh = Number(allDaysSolarDailyAgg.reduce((s, d) => s + (d.totalKWh * capacityScale || 0), 0).toFixed(2));

    let summary = null;
    const hasTimelineData = timelineAgg.length > 0 || solarIntervalAgg.length > 0;
    if (hasTimelineData) {
      // Unify all distinct observation timestamps from both series chronologically
      const timestampSet = new Set();
      timelineAgg.forEach((item) => timestampSet.add(new Date(item._id.timestamp).getTime()));
      solarIntervalAgg.forEach((item) => timestampSet.add(new Date(item._id).getTime()));
      const sortedTimes = Array.from(timestampSet).sort((a, b) => a - b);

      const MAX_PAIRING_TOLERANCE_MS = 30 * 60 * 1000; // 30 minutes tolerance

      const timeline = sortedTimes.map((tMs) => {
        const epochDate = new Date(tMs);
        const isoStr = epochDate.toISOString();

        // 1. Locate energy demand record within tolerance
        let matchedEnergy = null;
        let minEnergyDiff = Infinity;
        for (const item of timelineAgg) {
          const diff = Math.abs(new Date(item._id.timestamp).getTime() - tMs);
          if (diff < minEnergyDiff) {
            minEnergyDiff = diff;
            matchedEnergy = item;
          }
        }
        if (minEnergyDiff > MAX_PAIRING_TOLERANCE_MS) {
          matchedEnergy = null;
        }

        // 2. Locate solar generation record within tolerance
        let matchedSolar = null;
        let minSolarDiff = Infinity;
        for (const item of solarIntervalAgg) {
          const diff = Math.abs(new Date(item._id).getTime() - tMs);
          if (diff < minSolarDiff) {
            minSolarDiff = diff;
            matchedSolar = item;
          }
        }
        if (minSolarDiff > MAX_PAIRING_TOLERANCE_MS) {
          matchedSolar = null;
        }

        const demandKw = matchedEnergy ? Number((matchedEnergy.totalWatts / 1000).toFixed(1)) : null;
        const energyKWh = matchedEnergy ? Number(matchedEnergy.totalEnergyKWh.toFixed(1)) : null;

        let solarKw = null;
        let solarKWh = null;
        if (matchedSolar) {
          const scaledIntervalKWh = matchedSolar.totalKWh * capacityScale;
          solarKWh = Number(scaledIntervalKWh.toFixed(2));
          solarKw = calculatePowerFromIntervalEnergy(scaledIntervalKWh, 1.6667, simConfig);
        } else {
          // Verify if genuinely night in Asia/Kolkata (before 06:00 or after 18:30 IST)
          const localHour = parseInt(
            new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(epochDate),
            10
          );
          if (localHour < 6 || localHour >= 19) {
            solarKw = 0.0;
            solarKWh = 0.0;
          }
        }

        let netImportKw = null;
        let gridExportKw = null;
        let solarOffsetPct = null;

        if (demandKw !== null && solarKw !== null) {
          const balance = calculateNetGridBalance(demandKw, solarKw);
          netImportKw = balance.netImportKW;
          gridExportKw = balance.gridExportKW;
          solarOffsetPct = balance.solarOffsetPct;
        } else if (demandKw !== null) {
          netImportKw = demandKw;
          gridExportKw = 0;
          solarOffsetPct = 0;
        } else if (solarKw !== null) {
          netImportKw = 0;
          gridExportKw = solarKw;
          solarOffsetPct = null;
        }

        const snapshotLabel = matchedEnergy?._id?.snapshotLabel || matchedSolar?.timelineLabel || 'Snapshot';

        return {
          timestamp: isoStr,
          snapshotLabel,
          demandKw,
          energyKWh,
          solarKw,
          solarKWh,
          netImportKw,
          gridExportKw,
          solarOffsetPct,
          hasDemand: demandKw !== null,
          hasSolar: solarKw !== null,
          recordCount: matchedEnergy?.recordCount || 0,
        };
      });

      const latest = timeline[timeline.length - 1];
      const activeSolarKW = latest.solarKw !== null && latest.solarKw !== undefined ? latest.solarKw : latestSolarKW;
      const activeDemandKW = latest.demandKw !== null && latest.demandKw !== undefined ? latest.demandKw : 0;
      const { netImportKW: netDemand, gridExportKW: gridExport, solarOffsetPct: offsetPct } = calculateNetGridBalance(activeDemandKW, activeSolarKW);

      // Peak demand observation within the eligible observation window
      let peakObs = timeline[0];
      for (const pt of timeline) {
        if ((pt.demandKw || 0) > (peakObs.demandKw || 0)) {
          peakObs = pt;
        }
      }
      const peakDemandKw = peakObs?.demandKw ?? activeDemandKW;
      const peakEnergyKwh = peakObs?.energyKWh ?? (latest.energyKWh || 0);
      const peakSnapshotLabel = peakObs?.snapshotLabel ?? latest.snapshotLabel;
      const peakTimestamp = peakObs?.timestamp ?? latest.timestamp;

      const isHistorical = targetDayKey ? targetDayKey < todayKolkataStr : false;
      const isToday = targetDayKey ? targetDayKey === todayKolkataStr : true;
      const isFuture = targetDayKey ? targetDayKey > todayKolkataStr : false;

      let reportingPeriod = 'Pilot Telemetry Baseline';
      if (targetDayKey) {
        const d = new Date(`${targetDayKey}T12:00:00+05:30`);
        const dayLabel = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }).format(d);
        reportingPeriod = `${dayLabel} (Single-day view)`;
      } else if (allDates.length > 1) {
        const firstD = new Date(`${allDates[0]}T12:00:00+05:30`);
        const lastD = new Date(`${allDates[allDates.length - 1]}T12:00:00+05:30`);
        const firstFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' }).format(firstD);
        const lastFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }).format(lastD);
        reportingPeriod = `${firstFmt}–${lastFmt} (${allDates.length}-day monitoring baseline)`;
      }

      summary = {
        latestDemandKw: activeDemandKW,
        latestEnergyKwh: latest.energyKWh || 0,
        solarKw: activeSolarKW,
        netImportKw: netDemand,
        gridExportKw: gridExport,
        solarOffsetPct: offsetPct,
        snapshotLabel: latest.snapshotLabel,
        timestamp: latest.timestamp,
        peakDemandKw,
        peakEnergyKwh,
        peakSnapshotLabel,
        peakTimestamp,
        observationCount: timeline.length,
        isHistorical,
        isToday,
        isFuture,
        isPrototype: true,
        solarSystemCapacityKW: simConfig.assumedInstalledCapacityKW,
        totalCampusEnergyKWh: totalConsumedKWh,
        totalSolarGeneratedKWh: solarTotalKWh,
        dayEnergyConsumedKWh,
        daySolarYieldKWh,
        cumulativeCampusEnergyKWh,
        cumulativeSolarGeneratedKWh,
        overallSolarContributionPct,
        reportingPeriod,
        reportingDate: targetDayKey,
        totalRecordsCount: totalEnergyDocCount,
        totalSolarRecordsCount: totalSolarDocCount,
        monitoringDaysCount: allDates.length,
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

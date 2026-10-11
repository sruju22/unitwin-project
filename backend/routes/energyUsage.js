const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// GET /api/energy-usage - List energy telemetry records from MongoDB Atlas
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

    const limit = parseInt(req.query.limit, 10) || 500;
    const [records, timelineAgg] = await Promise.all([
      db.collection('energyUsage').find(filter).limit(limit).toArray(),
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
    ]);

    let summary = null;
    if (timelineAgg.length > 0) {
      const timeline = timelineAgg.map((item) => ({
        timestamp: item._id.timestamp,
        snapshotLabel: item._id.snapshotLabel || 'Snapshot',
        demandKw: Number((item.totalWatts / 1000).toFixed(1)),
        energyKWh: Number(item.totalEnergyKWh.toFixed(1)),
        recordCount: item.recordCount,
      }));

      const latest = timeline[timeline.length - 1];

      summary = {
        latestDemandKw: latest.demandKw,
        latestEnergyKwh: latest.energyKWh,
        solarKw: 0,
        netImportKw: latest.demandKw,
        solarOffsetPct: 0,
        snapshotLabel: latest.snapshotLabel,
        timestamp: latest.timestamp,
        isPrototype: true,
        timeline,
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

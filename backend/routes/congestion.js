const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// GET /api/congestion - List and filter congestion records from MongoDB Atlas
router.get('/', async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const filter = {};

    if (req.query.buildingId) {
      filter.buildingId = req.query.buildingId;
    }
    if (req.query.congestionLevel) {
      filter.congestionLevel = new RegExp(`^${req.query.congestionLevel}$`, 'i');
    }
    if (req.query.locationType) {
      filter.locationType = new RegExp(`^${req.query.locationType}$`, 'i');
    }
    if (req.query.areaId) {
      filter.areaId = req.query.areaId;
    }
    if (req.query.snapshotLabel) {
      filter.snapshotLabel = req.query.snapshotLabel;
    }

    const limit = parseInt(req.query.limit, 10) || 400;

    const [records, latestDoc, timelineAgg] = await Promise.all([
      db
        .collection('congestion')
        .find(filter)
        .sort({ timestamp: -1, congestionPercentage: -1 })
        .limit(limit)
        .toArray(),
      db.collection('congestion').find(filter).sort({ timestamp: -1 }).limit(1).toArray(),
      db.collection('congestion').aggregate([
        { $match: filter },
        {
          $group: {
            _id: { timestamp: '$timestamp', snapshotLabel: '$snapshotLabel' },
            avgCongestion: { $avg: '$congestionPercentage' },
            totalPeople: { $sum: '$peopleCount' },
            highCount: {
              $sum: {
                $cond: [{ $eq: ['$congestionLevel', 'High'] }, 1, 0],
              },
            },
          },
        },
        { $sort: { '_id.timestamp': 1 } },
      ]).toArray(),
    ]);

    const highCount = records.filter(
      (r) => (r.congestionLevel || '').toLowerCase() === 'high'
    ).length;
    const mediumCount = records.filter(
      (r) => (r.congestionLevel || '').toLowerCase() === 'medium'
    ).length;
    const lowCount = records.filter(
      (r) => (r.congestionLevel || '').toLowerCase() === 'low'
    ).length;
    const uniqueAreas = Array.from(new Set(records.map((r) => r.areaName).filter(Boolean)));

    const summary = {
      totalRecords: records.length,
      highCount,
      mediumCount,
      lowCount,
      uniqueAreaCount: uniqueAreas.length,
      latestSnapshot: latestDoc[0]?.snapshotLabel || null,
      latestTimestamp: latestDoc[0]?.timestamp || null,
      isPrototype: records.some((r) => r.prototype === true),
      timeline: timelineAgg.map((t) => ({
        timestamp: t._id.timestamp,
        snapshotLabel: t._id.snapshotLabel || 'Snapshot',
        avgCongestion: Math.round(t.avgCongestion * 10) / 10,
        totalPeople: t.totalPeople,
        highCount: t.highCount,
      })),
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

module.exports = router;

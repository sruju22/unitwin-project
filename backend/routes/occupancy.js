const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// GET /api/occupancy - List occupancy records from MongoDB Atlas
router.get('/', async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const filter = {};
    if (req.query.buildingId) {
      filter.buildingId = req.query.buildingId;
    }
    if (req.query.roomId) {
      filter.roomId = req.query.roomId;
    }
    if (req.query.prototype !== undefined) {
      if (req.query.prototype === 'false') {
        filter.prototype = { $ne: true };
      } else {
        filter.prototype = true;
      }
    }
    if (req.query.snapshotTimestamp) {
      const snapDate = new Date(req.query.snapshotTimestamp);
      if (!isNaN(snapDate.getTime())) {
        filter.timestamp = snapDate;
      }
    } else if (req.query.date) {
      // Date in Asia/Kolkata (YYYY-MM-DD)
      const start = new Date(`${req.query.date}T00:00:00+05:30`);
      const end = new Date(`${req.query.date}T23:59:59.999+05:30`);
      filter.timestamp = { ...(filter.timestamp || {}), $gte: start, $lte: end };
    } else if (req.query.asOfDate) {
      const parsedDate = new Date(req.query.asOfDate);
      if (!isNaN(parsedDate.getTime())) {
        filter.timestamp = { ...(filter.timestamp || {}), $lte: parsedDate };
      }
    }

    const limit = parseInt(req.query.limit, 10) || 500;
    const [records, latestDoc, timelineAgg] = await Promise.all([
      db.collection('occupancy').find(filter).limit(limit).toArray(),
      db.collection('occupancy').find(filter).sort({ timestamp: -1 }).limit(1).toArray(),
      db.collection('occupancy').aggregate([
        { $match: filter },
        {
          $group: {
            _id: { timestamp: '$timestamp', snapshotLabel: '$snapshotLabel' },
            totalOccupancy: { $sum: '$occupancy' },
            totalCapacity: { $sum: '$capacity' },
            roomCount: { $sum: 1 },
          },
        },
        { $sort: { '_id.timestamp': 1 } },
      ]).toArray(),
    ]);

    let summary = null;
    let latestSlice = null;
    if (timelineAgg.length > 0) {
      // Select the latest snapshot matching the filter boundaries (including Saturday Oct 17)
      const targetSnapshot = timelineAgg[timelineAgg.length - 1];
      const latestTime = targetSnapshot._id.timestamp;
      latestSlice = await db
        .collection('occupancy')
        .find({ ...filter, timestamp: latestTime })
        .toArray();

      const totalOccupancy = latestSlice.reduce((s, r) => s + (r.occupancy || 0), 0);
      const totalCapacity = latestSlice.reduce((s, r) => s + (r.capacity || 0), 0);
      const averageUtilization = totalCapacity > 0
        ? Number(((totalOccupancy / totalCapacity) * 100).toFixed(1))
        : 0;

      const timeline = timelineAgg.map((item) => ({
        timestamp: item._id.timestamp,
        snapshotLabel: item._id.snapshotLabel || 'Snapshot',
        totalOccupancy: item.totalOccupancy,
        totalCapacity: item.totalCapacity,
        roomCount: item.roomCount,
        utilization: item.totalCapacity > 0
          ? Number(((item.totalOccupancy / item.totalCapacity) * 100).toFixed(1))
          : 0,
      }));

      summary = {
        totalOccupancy,
        totalCapacity,
        averageUtilization,
        roomCount: latestSlice.length,
        snapshotLabel: targetSnapshot._id.snapshotLabel || latestDoc[0]?.snapshotLabel || 'Live Snapshot',
        timestamp: latestTime,
        isPrototype: latestSlice.some((r) => r.prototype === true) || latestDoc[0]?.prototype === true,
        timeline,
      };
    }

    const dataToReturn = latestSlice && latestSlice.length > 0 ? latestSlice : records;

    res.json({
      success: true,
      count: dataToReturn.length,
      summary,
      data: dataToReturn,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

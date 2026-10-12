const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// GET /api/maintenance - List and filter maintenance issues from MongoDB Atlas
router.get('/', async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const filter = {};

    if (req.query.buildingId) {
      filter.buildingId = req.query.buildingId;
    }
    if (req.query.roomNumber) {
      filter.roomNumber = new RegExp(req.query.roomNumber, 'i');
    }
    if (req.query.priority) {
      filter.priority = new RegExp(`^${req.query.priority}$`, 'i');
    }
    if (req.query.status) {
      filter.status = new RegExp(`^${req.query.status}$`, 'i');
    }
    if (req.query.assetType) {
      filter.assetType = new RegExp(`^${req.query.assetType}$`, 'i');
    }

    const limit = parseInt(req.query.limit, 10) || 100;
    // Query maintainence collection in Atlas
    const records = await db
      .collection('maintainence')
      .find(filter)
      .sort({ priority: 1, reportedDate: -1 })
      .limit(limit)
      .toArray();

    const openCount = records.filter(
      (r) => (r.status || '').toLowerCase() === 'open'
    ).length;
    const inProgressCount = records.filter(
      (r) => (r.status || '').toLowerCase() === 'in progress'
    ).length;
    const scheduledCount = records.filter(
      (r) => (r.status || '').toLowerCase() === 'scheduled'
    ).length;
    const resolvedCount = records.filter(
      (r) => (r.status || '').toLowerCase() === 'resolved'
    ).length;
    const highPriorityCount = records.filter(
      (r) => (r.priority || '').toLowerCase() === 'high'
    ).length;
    const mediumPriorityCount = records.filter(
      (r) => (r.priority || '').toLowerCase() === 'medium'
    ).length;

    const summary = {
      totalCount: records.length,
      openCount,
      inProgressCount,
      scheduledCount,
      resolvedCount,
      highPriorityCount,
      mediumPriorityCount,
      isPrototype: records.some((r) => r.prototype === true),
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

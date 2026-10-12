const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// GET /api/alerts - List active campus alerts from MongoDB Atlas
router.get('/', async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const filter = {};

    if (req.query.severity) {
      filter.severity = new RegExp(`^${req.query.severity}$`, 'i');
    }
    if (req.query.status) {
      filter.status = new RegExp(`^${req.query.status}$`, 'i');
    }
    if (req.query.buildingId) {
      filter.buildingId = req.query.buildingId;
    }
    if (req.query.alertType) {
      filter.alertType = new RegExp(`^${req.query.alertType}$`, 'i');
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

    const alerts = await db.collection('alerts').find(filter).sort({ timestamp: -1 }).toArray();

    const highSeverityCount = alerts.filter(
      (a) => (a.severity || '').toLowerCase() === 'high' || (a.severity || '').toLowerCase() === 'critical'
    ).length;
    const mediumSeverityCount = alerts.filter(
      (a) => (a.severity || '').toLowerCase() === 'medium' || (a.severity || '').toLowerCase() === 'warning'
    ).length;

    res.json({
      success: true,
      count: alerts.length,
      summary: {
        totalAlerts: alerts.length,
        highSeverityCount,
        mediumSeverityCount,
        isPrototype: alerts.some((a) => a.prototype === true),
      },
      data: alerts,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

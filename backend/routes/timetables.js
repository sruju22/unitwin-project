const express = require('express');
const router = express.Router();
const Timetable = require('../models/Timetable');

// Day sort order helper
const DAY_ORDER = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

// GET /api/timetables - List timetables with optional room, sectionId, and day filters
router.get('/', async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.room) {
      filter.room = new RegExp(`^${req.query.room}$`, 'i');
    }

    if (req.query.sectionId) {
      filter.sectionId = new RegExp(`^${req.query.sectionId}$`, 'i');
    }

    if (req.query.day) {
      filter.day = new RegExp(`^${req.query.day}$`, 'i');
    }

    if (req.query.type) {
      filter.type = new RegExp(`^${req.query.type}$`, 'i');
    }

    const items = await Timetable.find(filter)
      .sort({ day: 1, slotStart: 1 })
      .lean();

    // Sort cleanly by weekday order and slotStart
    items.sort((a, b) => {
      const dayDiff = (DAY_ORDER[a.day] || 99) - (DAY_ORDER[b.day] || 99);
      if (dayDiff !== 0) return dayDiff;
      return a.slotStart - b.slotStart;
    });

    res.json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

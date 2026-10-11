const express = require('express');
const router = express.Router();
const Room = require('../models/Room');

// GET /api/rooms - List rooms with optional filters
router.get('/', async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.buildingId) {
      filter.buildingId = req.query.buildingId.toUpperCase();
    }

    if (req.query.block) {
      // Support case-insensitive block matching (e.g., 'C' or 'c')
      filter.block = new RegExp(`^${req.query.block}$`, 'i');
    }

    if (req.query.floorNumber !== undefined) {
      const floor = parseInt(req.query.floorNumber, 10);
      if (!isNaN(floor)) {
        filter.floorNumber = floor;
      }
    }

    if (req.query.roomType) {
      filter.roomType = new RegExp(req.query.roomType, 'i');
    }

    if (req.query.prototype !== undefined) {
      filter.prototype = req.query.prototype === 'true';
    }

    const rooms = await Room.find(filter)
      .sort({ floorNumber: 1, roomNumber: 1 })
      .lean();

    res.json({
      success: true,
      count: rooms.length,
      data: rooms,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/rooms/:roomNumber - Get specific room details
router.get('/:roomNumber', async (req, res, next) => {
  try {
    const { roomNumber } = req.params;

    const room = await Room.findOne({
      roomNumber: new RegExp(`^${roomNumber}$`, 'i'),
    }).lean();

    if (!room) {
      return res.status(404).json({
        success: false,
        error: `Room "${roomNumber}" not found`,
      });
    }

    res.json({
      success: true,
      data: room,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

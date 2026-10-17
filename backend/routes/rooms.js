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
      // For BLD002 (Silver Jubilee / S-Block), allow 'S' to match 'Silver Jubilee'
      if (req.query.buildingId && req.query.buildingId.toUpperCase() === 'BLD002' && /^s$/i.test(req.query.block)) {
        filter.block = /^(S|Silver Jubilee)$/i;
      } else {
        filter.block = new RegExp(`^${req.query.block}$`, 'i');
      }
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

    let rooms = await Room.find(filter)
      .sort({ floorNumber: 1, roomNumber: 1 })
      .lean();

    // If database returned no rooms, fallback to verified default room registry
    if ((!rooms || rooms.length === 0) && (!req.query.prototype || req.query.prototype === 'false')) {
      const { getDefaultRooms } = require('../data/defaultRooms');
      const allDefaults = getDefaultRooms();
      rooms = allDefaults.filter((r) => {
        if (req.query.buildingId && (r.buildingId || '').toUpperCase() !== req.query.buildingId.toUpperCase()) return false;
        if (req.query.block && !new RegExp(`^${req.query.block}$`, 'i').test(r.block || '')) return false;
        if (req.query.floorNumber !== undefined && r.floorNumber !== parseInt(req.query.floorNumber, 10)) return false;
        if (req.query.roomType && !new RegExp(req.query.roomType, 'i').test(r.roomType || '')) return false;
        return true;
      });
    }

    res.json({
      success: true,
      count: rooms.length,
      data: rooms,
    });
  } catch (err) {
    try {
      const { getDefaultRooms } = require('../data/defaultRooms');
      const allDefaults = getDefaultRooms();
      const rooms = allDefaults.filter((r) => {
        if (req.query.buildingId && (r.buildingId || '').toUpperCase() !== req.query.buildingId.toUpperCase()) return false;
        if (req.query.block && !new RegExp(`^${req.query.block}$`, 'i').test(r.block || '')) return false;
        if (req.query.floorNumber !== undefined && r.floorNumber !== parseInt(req.query.floorNumber, 10)) return false;
        if (req.query.roomType && !new RegExp(req.query.roomType, 'i').test(r.roomType || '')) return false;
        return true;
      });
      return res.json({
        success: true,
        count: rooms.length,
        data: rooms,
      });
    } catch {
      next(err);
    }
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

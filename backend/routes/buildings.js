const express = require('express');
const router = express.Router();
const Building = require('../models/Building');

// GET /api/buildings - List all campus buildings
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.buildingType) {
      filter.buildingType = req.query.buildingType;
    }
    if (req.query.prototype !== undefined) {
      if (req.query.prototype === 'false') {
        filter.prototype = { $ne: true };
      } else {
        filter.prototype = true;
      }
    }

    const buildings = await Building.find(filter).sort({ buildingId: 1 }).lean();
    res.json({
      success: true,
      count: buildings.length,
      data: buildings,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/buildings/:buildingId - Get single building details
router.get('/:buildingId', async (req, res, next) => {
  try {
    const { buildingId } = req.params;
    
    // Search by buildingId first, fallback to _id
    let building = await Building.findOne({
      $or: [
        { buildingId: buildingId },
        { buildingId: buildingId.toUpperCase() },
      ],
    }).lean();

    if (!building && buildingId.match(/^[0-9a-fA-F]{24}$/)) {
      building = await Building.findById(buildingId).lean();
    }

    if (!building) {
      return res.status(404).json({
        success: false,
        error: `Building with ID "${buildingId}" not found`,
      });
    }

    res.json({
      success: true,
      data: building,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const CampusArea = require('../models/CampusArea');

// GET /api/campus-areas - List campus outdoor & entry areas
router.get('/', async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.areaType) {
      filter.areaType = req.query.areaType;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const areas = await CampusArea.find(filter)
      .sort({ areaId: 1 })
      .lean();

    res.json({
      success: true,
      count: areas.length,
      data: areas,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/campus-areas/:areaId - Get single campus area
router.get('/:areaId', async (req, res, next) => {
  try {
    const { areaId } = req.params;

    const area = await CampusArea.findOne({
      areaId: new RegExp(`^${areaId}$`, 'i'),
    }).lean();

    if (!area) {
      return res.status(404).json({
        success: false,
        error: `Campus area "${areaId}" not found`,
      });
    }

    res.json({
      success: true,
      data: area,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

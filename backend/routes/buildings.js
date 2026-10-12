const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Building = require('../models/Building');
const { getDefaultBuildings } = require('../data/defaultBuildings');

// In-memory runtime override cache for standalone mode
const standaloneOverrides = {};

// GET /api/buildings - List campus buildings
router.get('/', async (req, res, next) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
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
      return res.json({
        success: true,
        source: 'mongodb',
        count: buildings.length,
        data: buildings,
      });
    }

    // Standby / Standalone fallback mode
    let fallbackList = getDefaultBuildings().map((b) => ({
      ...b,
      ...(standaloneOverrides[b.buildingCode] || {}),
    }));

    if (req.query.status) {
      fallbackList = fallbackList.filter(
        (b) => (b.status || '').toLowerCase() === req.query.status.toLowerCase()
      );
    }
    if (req.query.buildingType) {
      fallbackList = fallbackList.filter(
        (b) => (b.buildingType || '').toLowerCase() === req.query.buildingType.toLowerCase()
      );
    }

    res.json({
      success: true,
      source: 'standalone_campus_registry',
      count: fallbackList.length,
      data: fallbackList,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/buildings/:buildingId - Get single building details
router.get('/:buildingId', async (req, res, next) => {
  try {
    const { buildingId } = req.params;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      let building = await Building.findOne({
        $or: [
          { buildingId: buildingId },
          { buildingId: buildingId.toUpperCase() },
          { buildingCode: buildingId.toUpperCase() },
        ],
      }).lean();

      if (!building && buildingId.match(/^[0-9a-fA-F]{24}$/)) {
        building = await Building.findById(buildingId).lean();
      }

      if (building) {
        return res.json({
          success: true,
          data: building,
        });
      }
    }

    // Fallback to campus registry
    const defaultList = getDefaultBuildings().map((b) => ({
      ...b,
      ...(standaloneOverrides[b.buildingCode] || {}),
    }));

    const found = defaultList.find(
      (b) =>
        b.buildingId.toUpperCase() === buildingId.toUpperCase() ||
        (b.buildingCode && b.buildingCode.toUpperCase() === buildingId.toUpperCase())
    );

    if (!found) {
      return res.status(404).json({
        success: false,
        error: `Building with ID "${buildingId}" not found`,
      });
    }

    res.json({
      success: true,
      data: found,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/buildings/:buildingId - Update administrative metadata
router.put('/:buildingId', async (req, res, next) => {
  try {
    const { buildingId } = req.params;
    const updates = req.body || {};
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const updated = await Building.findOneAndUpdate(
        {
          $or: [
            { buildingId: buildingId },
            { buildingId: buildingId.toUpperCase() },
            { buildingCode: buildingId.toUpperCase() },
          ],
        },
        { $set: updates },
        { new: true }
      ).lean();

      if (updated) {
        return res.json({
          success: true,
          data: updated,
        });
      }
    }

    // Standalone cache update
    const defaultList = getDefaultBuildings();
    const found = defaultList.find(
      (b) =>
        b.buildingId.toUpperCase() === buildingId.toUpperCase() ||
        (b.buildingCode && b.buildingCode.toUpperCase() === buildingId.toUpperCase())
    );

    if (!found) {
      return res.status(404).json({
        success: false,
        error: `Building with ID "${buildingId}" not found to update`,
      });
    }

    standaloneOverrides[found.buildingCode] = {
      ...(standaloneOverrides[found.buildingCode] || {}),
      ...updates,
      lastUpdated: new Date().toISOString(),
    };

    res.json({
      success: true,
      source: 'standalone_campus_registry',
      data: {
        ...found,
        ...standaloneOverrides[found.buildingCode],
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

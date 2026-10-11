const express = require('express');
const router = express.Router();
const Section = require('../models/Section');

// GET /api/sections - List sections with optional branch, semester, and status filters
router.get('/', async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.branch) {
      filter.branch = req.query.branch.toUpperCase();
    }

    if (req.query.semester !== undefined) {
      const sem = parseInt(req.query.semester, 10);
      if (!isNaN(sem)) {
        filter.semester = sem;
      }
    }

    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const sections = await Section.find(filter)
      .sort({ branch: 1, semester: 1, sectionName: 1 })
      .lean();

    res.json({
      success: true,
      count: sections.length,
      data: sections,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sections/:sectionId - Get single section
router.get('/:sectionId', async (req, res, next) => {
  try {
    const { sectionId } = req.params;

    const section = await Section.findOne({
      sectionId: new RegExp(`^${sectionId}$`, 'i'),
    }).lean();

    if (!section) {
      return res.status(404).json({
        success: false,
        error: `Section "${sectionId}" not found`,
      });
    }

    res.json({
      success: true,
      data: section,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

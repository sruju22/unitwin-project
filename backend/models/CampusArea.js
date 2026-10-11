const mongoose = require('mongoose');

const campusAreaSchema = new mongoose.Schema(
  {
    areaId: { type: String, required: true, unique: true },
    areaName: { type: String, required: true },
    areaType: { type: String },
    description: { type: String },
    capacity: { type: Number, default: null },
    currentOccupancy: { type: Number, default: 0 },
    status: { type: String, default: 'active' },
  },
  {
    collection: 'campusAreas',
    timestamps: false,
    versionKey: false,
  }
);

module.exports = mongoose.model('CampusArea', campusAreaSchema);

const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema(
  {
    buildingId: { type: String, required: true, unique: true },
    buildingName: { type: String, required: true },
    buildingType: { type: String },
    description: { type: String },
    floors: { type: Number },
    status: { type: String, default: 'Active' },
    prototype: { type: Boolean, default: false },
  },
  {
    collection: 'buildings',
    timestamps: false,
    versionKey: false,
  }
);

module.exports = mongoose.model('Building', buildingSchema);

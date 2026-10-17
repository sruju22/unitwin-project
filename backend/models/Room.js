const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomNumber: { type: String, required: true },
    buildingId: { type: String, required: true, ref: 'Building' },
    block: { type: String, required: true },
    floorNumber: { type: Number, required: true },
    roomType: { type: String, required: true },
    roomName: { type: String },
    name: { type: String },
    status: { type: String, default: 'Active' },
    prototype: { type: Boolean, default: false },
  },
  {
    collection: 'rooms',
    timestamps: false,
    versionKey: false,
  }
);

module.exports = mongoose.model('Room', roomSchema);

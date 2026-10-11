const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema(
  {
    sectionId: { type: String, required: true },
    day: { type: String, required: true },
    slotStart: { type: Number, required: true },
    slotEnd: { type: Number, required: true },
    subject: { type: String, required: true },
    type: { type: String },
    room: { type: String, required: true },
    prototype: { type: Boolean, default: false },
  },
  {
    collection: 'timetables',
    timestamps: false,
    versionKey: false,
  }
);

module.exports = mongoose.model('Timetable', timetableSchema);

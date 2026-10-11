const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema(
  {
    sectionId: { type: String, required: true, unique: true },
    branch: { type: String },
    semester: { type: Number },
    sectionName: { type: String },
    isActive: { type: Boolean, default: true },
  },
  {
    collection: 'sections',
    timestamps: false,
    versionKey: false,
  }
);

module.exports = mongoose.model('Section', sectionSchema);

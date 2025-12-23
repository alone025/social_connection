const mongoose = require('mongoose');

const { Schema } = mongoose;

const accessCodeSchema = new Schema(
  {
    conference: { type: Schema.Types.ObjectId, ref: 'Conference', required: true },
    code: { type: String, required: true, unique: true },
    maxUses: { type: Number },
    usedCount: { type: Number, default: 0 },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

const AccessCode = mongoose.model('AccessCode', accessCodeSchema);

module.exports = {
  AccessCode,
};



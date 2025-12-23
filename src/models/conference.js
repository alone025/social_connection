const mongoose = require('mongoose');

const { Schema } = mongoose;

const conferenceSchema = new Schema(
  {
    title: { type: String, required: true },
    conferenceCode: { type: String, required: true, unique: true }, // for QR / UX
    startsAt: { type: Date },
    endsAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// The _id field itself will be used as conference ObjectId reference

const Conference = mongoose.model('Conference', conferenceSchema);

module.exports = {
  Conference,
};



const mongoose = require('mongoose');

const { Schema } = mongoose;

const conferenceSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    conferenceCode: { type: String, required: true, unique: true }, // for QR / UX only
    access: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
    startsAt: { type: Date },
    endsAt: { type: Date },
    isActive: { type: Boolean, default: true }, // used as "not ended / active"
    isEnded: { type: Boolean, default: false },
    admins: [{ type: Schema.Types.ObjectId, ref: 'UserProfile' }],
    currentSlideUrl: { type: String },
    currentSlideTitle: { type: String },
  },
  { timestamps: true }
);

// Performance indexes for 500-2000 users
// conferenceCode already has unique index
conferenceSchema.index({ isEnded: 1, isActive: 1 }); // For filtering active conferences
conferenceSchema.index({ startsAt: 1 }); // For sorting by start date
conferenceSchema.index({ admins: 1 }); // For finding conferences by admin

// The _id field itself will be used as conference ObjectId reference

const Conference = mongoose.model('Conference', conferenceSchema);

module.exports = {
  Conference,
};



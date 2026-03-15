const mongoose = require('mongoose');

/**
 * A Participant is a User's profile within a specific Conference.
 * This separates global identity from conference-specific presence.
 */
const participantSchema = new mongoose.Schema({
  user: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  conference: { type: mongoose.Types.ObjectId, ref: 'Conference', required: true, index: true },
  // Conference-specific info (can override global profile)
  displayName: { type: String },
  role: { type: String }, // "Speaker", "Investor", "Developer", etc.
  company: { type: String },
  bio: { type: String },
  interests: [{ type: String }],
  avatarUrl: { type: String },
  isVisible: { type: Boolean, default: true },
  joinedAt: { type: Date, default: Date.now },
}, { timestamps: true });

participantSchema.index({ user: 1, conference: 1 }, { unique: true });

module.exports = mongoose.model('Participant', participantSchema);

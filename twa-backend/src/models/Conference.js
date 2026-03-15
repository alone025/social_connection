const mongoose = require('mongoose');

const conferenceSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  organizer: { type: mongoose.Types.ObjectId, ref: 'User' },
  startsAt: { type: Date },
  endsAt: { type: Date },
  location: { type: String },
  isActive: { type: Boolean, default: true },
  // Grace period hours after conference ends (default 48h)
  gracePeriodHours: { type: Number, default: 48 },
}, { timestamps: true });

/**
 * Returns access phase for a given user.
 * Phases: 'free' | 'grace' | 'payment_required'
 */
conferenceSchema.methods.getAccessPhase = function(user) {
  const now = new Date();
  // Conference still running → free
  if (!this.endsAt || this.endsAt > now) return 'free';

  // Within grace period
  const graceEnd = new Date(this.endsAt.getTime() + this.gracePeriodHours * 3600 * 1000);
  if (now <= graceEnd) return 'grace';

  // After grace: check paid access
  if (user?.hasPaidAccess && user?.paidAccessUntil > now) return 'free';

  return 'payment_required';
};

module.exports = mongoose.model('Conference', conferenceSchema);

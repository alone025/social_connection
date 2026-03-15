const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true, index: true },
  firstName: { type: String },
  lastName: { type: String },
  username: { type: String },
  // Global profile fields
  bio: { type: String, maxlength: 500 },
  about: { type: String, maxlength: 1000 },
  lookingFor: { type: String, maxlength: 500 },
  company: { type: String },
  position: { type: String },
  country: { type: String },
  region: { type: String },
  city: { type: String },
  email: { type: String },
  phone: { type: String },
  telegram: { type: String },
  whatsapp: { type: String },
  interests: [{ type: String }],
  avatarUrl: { type: String },
  onboardingCompleted: { type: Boolean, default: false },
  // Payment/subscription
  hasPaidAccess: { type: Boolean, default: false },
  paidAccessUntil: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

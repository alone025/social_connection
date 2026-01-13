const mongoose = require('mongoose');

const { Schema } = mongoose;

const globalUserProfileSchema = new Schema(
  {
    telegramId: { type: String, required: true, unique: true, index: true },
    firstName: { type: String },
    lastName: { type: String },
    username: { type: String },
    photoUrl: { type: String },
    interests: [{ type: String }],
    offerings: [{ type: String }],
    lookingFor: [{ type: String }],
    roles: [
      {
        type: String,
        enum: ['speaker', 'investor', 'participant', 'organizer'],
      },
    ],
    onboardingCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index for finding profiles
globalUserProfileSchema.index({ telegramId: 1 });

const GlobalUserProfile = mongoose.model('GlobalUserProfile', globalUserProfileSchema);

module.exports = {
  GlobalUserProfile,
};

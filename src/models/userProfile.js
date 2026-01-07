const mongoose = require('mongoose');

const { Schema } = mongoose;

const userProfileSchema = new Schema(
  {
    telegramId: { type: String, required: true, index: true },
    conference: { type: Schema.Types.ObjectId, ref: 'Conference', required: true },
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
    isActive: { type: Boolean, default: true },
    onboardingCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Performance indexes for 500-2000 users
userProfileSchema.index({ conference: 1, isActive: 1 }); // For finding active users in conference
userProfileSchema.index({ telegramId: 1 }); // Already exists via unique, but explicit for clarity
userProfileSchema.index({ conference: 1, telegramId: 1 }); // For finding user's profile in specific conference
userProfileSchema.index({ conference: 1, 'roles': 1 }); // For filtering by role in conference
userProfileSchema.index({ conference: 1, onboardingCompleted: 1 }); // For filtering completed profiles

const UserProfile = mongoose.model('UserProfile', userProfileSchema);

module.exports = {
  UserProfile,
};



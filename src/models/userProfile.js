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
  },
  { timestamps: true }
);

// Performance indexes per spec
userProfileSchema.index({ conference: 1, isActive: 1 });

const UserProfile = mongoose.model('UserProfile', userProfileSchema);

module.exports = {
  UserProfile,
};



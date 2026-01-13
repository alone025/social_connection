const mongoose = require('mongoose');

const { Schema } = mongoose;

const onboardingStateSchema = new Schema(
  {
    telegramId: { type: String, required: true, unique: true, index: true },
    step: { type: Number, required: true, default: 1, min: 1, max: 5 },
    data: {
      firstName: { type: String },
      lastName: { type: String },
      interests: [{ type: String }],
      offerings: [{ type: String }],
      lookingFor: [{ type: String }],
      roles: [{ type: String }],
    },
    startedAt: { type: Date, default: Date.now },
    lastUpdatedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// Index for finding active onboarding sessions
onboardingStateSchema.index({ telegramId: 1, step: 1 });

// Auto-update lastUpdatedAt on save
onboardingStateSchema.pre('save', function (next) {
  this.lastUpdatedAt = new Date();
  next();
});

const OnboardingState = mongoose.model('OnboardingState', onboardingStateSchema);

module.exports = {
  OnboardingState,
};

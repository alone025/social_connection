const mongoose = require('mongoose');

const { Schema } = mongoose;

const tariffPlanSchema = new Schema(
  {
    name: { type: String, required: true, unique: true }, // e.g., 'free', 'basic', 'premium'
    displayName: { type: String, required: true }, // e.g., 'Free Plan', 'Basic Plan'
    description: { type: String },
    pricePerMonth: { type: Number, default: 0 }, // in cents or smallest currency unit
    currency: { type: String, default: 'USD' },
    
    // Limits
    limits: {
      maxConferences: { type: Number, default: -1 }, // -1 = unlimited
      maxParticipantsPerConference: { type: Number, default: -1 },
      maxPollsPerConference: { type: Number, default: -1 },
      maxQuestionsPerConference: { type: Number, default: -1 },
      maxMeetingsPerConference: { type: Number, default: -1 }, // Total meetings per conference
      maxMeetingsPerUser: { type: Number, default: -1 }, // Max meetings per user in conference
      maxSpeakersPerConference: { type: Number, default: -1 },
      maxAdminsPerConference: { type: Number, default: -1 },
      // Feature flags
      pollsEnabled: { type: Boolean, default: true },
      secondScreenEnabled: { type: Boolean, default: true },
      organizerDashboardEnabled: { type: Boolean, default: true },
      exportCsvEnabled: { type: Boolean, default: false },
      exportPdfEnabled: { type: Boolean, default: false },
      customBranding: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
    },
    
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false }, // Default plan for new users
  },
  { timestamps: true }
);

// Ensure only one default plan exists
tariffPlanSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await mongoose.model('TariffPlan').updateMany(
      { _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

const TariffPlan = mongoose.model('TariffPlan', tariffPlanSchema);

module.exports = {
  TariffPlan,
};

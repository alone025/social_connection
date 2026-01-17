const mongoose = require('mongoose');

const { Schema } = mongoose;

const subscriptionSchema = new Schema(
  {
    // Subscription can be for a User (global) or Conference (per-conference)
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    conferenceId: { type: Schema.Types.ObjectId, ref: 'Conference', required: false, index: true },
    
    // At least one of userId or conferenceId must be set
    tariffPlan: { type: Schema.Types.ObjectId, ref: 'TariffPlan', required: true },
    
    // Subscription status
    status: {
      type: String,
      enum: ['active', 'trial', 'expired', 'cancelled'],
      default: 'active',
    },
    
    // Period
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date }, // null = never expires
    trialEndsAt: { type: Date }, // For trial subscriptions
    
    // Payment tracking
    paymentProvider: { type: String }, // e.g., 'stripe', 'yookassa', etc.
    paymentSubscriptionId: { type: String }, // External subscription ID from payment provider
    lastPaymentAt: { type: Date },
    nextPaymentAt: { type: Date },
    
    // Usage tracking (for billing/quota management)
    usage: {
      conferencesCreated: { type: Number, default: 0 },
      participantsAdded: { type: Number, default: 0 },
      pollsCreated: { type: Number, default: 0 },
      questionsCreated: { type: Number, default: 0 },
      meetingsCreated: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ conferenceId: 1, status: 1 });
subscriptionSchema.index({ status: 1, endsAt: 1 }); // For finding expired subscriptions

// Validation: at least one of userId or conferenceId must be set
subscriptionSchema.pre('validate', function(next) {
  if (!this.userId && !this.conferenceId) {
    next(new Error('Either userId or conferenceId must be provided'));
  } else {
    next();
  }
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = {
  Subscription,
};

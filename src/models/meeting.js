const mongoose = require('mongoose');

const { Schema } = mongoose;

const meetingSchema = new Schema(
  {
    conference: { type: Schema.Types.ObjectId, ref: 'Conference', required: true, index: true },
    requester: { type: Schema.Types.ObjectId, ref: 'UserProfile', required: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'UserProfile', required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
      index: true,
    },
    proposedTime: { type: Date, required: true },
    durationMinutes: { type: Number, default: 30, min: 5, max: 120 },
    message: { type: String, maxlength: 500 },
    meetingLocation: { type: String, maxlength: 200 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes for performance
meetingSchema.index({ conference: 1, status: 1 });
meetingSchema.index({ requester: 1, status: 1 });
meetingSchema.index({ recipient: 1, status: 1 });
meetingSchema.index({ proposedTime: 1 });
meetingSchema.index({ conference: 1, requester: 1, recipient: 1 }); // For conflict detection

// Compound index for finding active meetings at a time
meetingSchema.index({ conference: 1, proposedTime: 1, status: 1 });

const Meeting = mongoose.model('Meeting', meetingSchema);

module.exports = {
  Meeting,
};

const mongoose = require('mongoose');

const { Schema } = mongoose;

const questionSchema = new Schema(
  {
    conference: { type: Schema.Types.ObjectId, ref: 'Conference', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'UserProfile' },
    text: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    isAnswered: { type: Boolean, default: false },
    answer: { type: String }, // Answer text from speaker
    answeredBy: { type: Schema.Types.ObjectId, ref: 'UserProfile' }, // Speaker who answered
    targetSpeaker: { type: Schema.Types.ObjectId, ref: 'UserProfile' }, // Specific speaker or null for all
    upvoters: [{ type: Schema.Types.ObjectId, ref: 'UserProfile' }],
  },
  { timestamps: true }
);

// Performance indexes for 500-2000 users
questionSchema.index({ conference: 1, status: 1 }); // For filtering by status (pending/approved/rejected)
questionSchema.index({ conference: 1, isAnswered: 1 }); // For finding unanswered questions
questionSchema.index({ conference: 1, status: 1, createdAt: 1 }); // For sorting approved questions
questionSchema.index({ targetSpeaker: 1, status: 1 }); // For finding questions for specific speaker
questionSchema.index({ author: 1 }); // For finding questions by author

const Question = mongoose.model('Question', questionSchema);

module.exports = {
  Question,
};



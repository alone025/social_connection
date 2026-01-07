const mongoose = require('mongoose');

const { Schema } = mongoose;

const pollSchema = new Schema(
  {
    conference: { type: Schema.Types.ObjectId, ref: 'Conference', required: true },
    question: { type: String, required: true },
    options: [
      {
        _id: false,
        id: { type: Number, required: true },
        text: { type: String, required: true },
        voters: [{ type: Schema.Types.ObjectId, ref: 'UserProfile' }],
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Performance indexes for 500-2000 users
pollSchema.index({ conference: 1, isActive: 1 }); // For finding active polls in conference
pollSchema.index({ conference: 1, createdAt: -1 }); // For sorting polls by creation date

const Poll = mongoose.model('Poll', pollSchema);

module.exports = {
  Poll,
};



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

// Performance indexes per spec
pollSchema.index({ conference: 1, isActive: 1 });

const Poll = mongoose.model('Poll', pollSchema);

module.exports = {
  Poll,
};



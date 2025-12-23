const mongoose = require('mongoose');

const { Schema } = mongoose;

const questionSchema = new Schema(
  {
    conference: { type: Schema.Types.ObjectId, ref: 'Conference', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'UserProfile' },
    text: { type: String, required: true },
    isAnswered: { type: Boolean, default: false },
    upvoters: [{ type: Schema.Types.ObjectId, ref: 'UserProfile' }],
  },
  { timestamps: true }
);

// Performance indexes per spec
questionSchema.index({ conference: 1, isAnswered: 1 });

const Question = mongoose.model('Question', questionSchema);

module.exports = {
  Question,
};



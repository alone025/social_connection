const mongoose = require('mongoose');

const { Schema } = mongoose;

const connectionSchema = new Schema(
  {
    conference: { type: Schema.Types.ObjectId, ref: 'Conference', required: true },
    user1: { type: Schema.Types.ObjectId, ref: 'UserProfile', required: true },
    user2: { type: Schema.Types.ObjectId, ref: 'UserProfile', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

connectionSchema.index({ user1: 1 });
connectionSchema.index({ user2: 1 });
connectionSchema.index({ conference: 1 });

const Connection = mongoose.model('Connection', connectionSchema);

module.exports = {
  Connection,
};



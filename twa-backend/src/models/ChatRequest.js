const mongoose = require('mongoose');

/**
 * A ChatRequest is sent from one participant to another inside a conference.
 * Once accepted, they can exchange Messages.
 */
const chatRequestSchema = new mongoose.Schema({
  conference: { type: mongoose.Types.ObjectId, ref: 'Conference', required: true, index: true },
  from: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, maxlength: 300 }, // Optional intro message
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
    index: true,
  },
}, { timestamps: true });

// Prevent duplicate pending requests
chatRequestSchema.index({ conference: 1, from: 1, to: 1 }, { unique: true });

module.exports = mongoose.model('ChatRequest', chatRequestSchema);

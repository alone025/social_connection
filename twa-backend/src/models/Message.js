const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conference: { type: mongoose.Types.ObjectId, ref: 'Conference', required: true, index: true },
  from: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 2000 },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

// Index for fetching conversations efficiently
messageSchema.index({ conference: 1, from: 1, to: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: ['chat_request', 'request_accepted', 'request_rejected', 'new_message', 'poll_started', 'conference_ending'],
    required: true,
  },
  title: { type: String },
  body: { type: String },
  data: { type: mongoose.Schema.Types.Mixed }, // Extra payload (e.g. chatRequestId, conferenceId)
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);

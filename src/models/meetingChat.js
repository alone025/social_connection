const mongoose = require('mongoose');

const { Schema } = mongoose;

const meetingChatMessageSchema = new Schema(
  {
    meeting: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'UserProfile', required: true },
    text: { type: String, required: true, maxlength: 1000 },
  },
  { timestamps: true }
);

const meetingChatTokenSchema = new Schema(
  {
    meeting: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true, unique: true },
    token: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes for performance
meetingChatMessageSchema.index({ meeting: 1, createdAt: -1 });
meetingChatTokenSchema.index({ token: 1 });
meetingChatTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

const MeetingChatMessage = mongoose.model('MeetingChatMessage', meetingChatMessageSchema);
const MeetingChatToken = mongoose.model('MeetingChatToken', meetingChatTokenSchema);

module.exports = {
  MeetingChatMessage,
  MeetingChatToken,
};

const crypto = require('crypto');
const { MeetingChatMessage, MeetingChatToken } = require('../models/meetingChat');
const { Meeting } = require('../models/meeting');
const { UserProfile } = require('../models/userProfile');
const { ensureUserFromTelegram } = require('./conference.service');

/**
 * Generate a secure token for meeting chat access
 */
function generateChatToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create or get chat token for a meeting
 * Token expires 1 hour after meeting end time
 */
async function getOrCreateChatToken({ meetingId }) {
  const meeting = await Meeting.findById(meetingId).populate('requester recipient');
  if (!meeting) {
    throw new Error('MEETING_NOT_FOUND');
  }

  // Check if token already exists and is valid
  let tokenDoc = await MeetingChatToken.findOne({ meeting: meetingId });
  if (tokenDoc && tokenDoc.expiresAt > new Date()) {
    return tokenDoc;
  }

  // Calculate expiration: 1 hour after meeting end
  const meetingEndTime = new Date(meeting.proposedTime.getTime() + meeting.durationMinutes * 60 * 1000);
  const expiresAt = new Date(meetingEndTime.getTime() + 60 * 60 * 1000); // 1 hour after meeting end

  // Delete old token if exists
  if (tokenDoc) {
    await MeetingChatToken.deleteOne({ _id: tokenDoc._id });
  }

  // Create new token
  const token = generateChatToken();
  tokenDoc = new MeetingChatToken({
    meeting: meetingId,
    token,
    expiresAt,
  });

  await tokenDoc.save();
  return tokenDoc;
}

/**
 * Validate chat token and return meeting info
 */
async function validateChatToken({ token }) {
  const tokenDoc = await MeetingChatToken.findOne({ token }).populate({
    path: 'meeting',
    populate: [
      { path: 'requester', select: 'firstName lastName username telegramId' },
      { path: 'recipient', select: 'firstName lastName username telegramId' },
    ],
  });

  if (!tokenDoc) {
    throw new Error('INVALID_TOKEN');
  }

  if (tokenDoc.expiresAt <= new Date()) {
    await MeetingChatToken.deleteOne({ _id: tokenDoc._id });
    throw new Error('TOKEN_EXPIRED');
  }

  const meeting = tokenDoc.meeting;
  if (!meeting || meeting.status !== 'accepted') {
    throw new Error('MEETING_NOT_AVAILABLE');
  }

  return { meeting, tokenDoc };
}

/**
 * Send a message in meeting chat
 */
async function sendChatMessage({ token, telegramUser, text }) {
  const { meeting } = await validateChatToken({ token });

  const user = await ensureUserFromTelegram(telegramUser);
  
  // Verify user is a participant
  const isRequester = meeting.requester.telegramId === user.telegramId;
  const isRecipient = meeting.recipient.telegramId === user.telegramId;

  if (!isRequester && !isRecipient) {
    throw new Error('NOT_PARTICIPANT');
  }

  // Get user profile for this meeting's conference
  const profile = await UserProfile.findOne({
    telegramId: user.telegramId,
    conference: meeting.conference,
    isActive: true,
  });

  if (!profile) {
    throw new Error('PROFILE_NOT_FOUND');
  }

  // Create message
  const message = new MeetingChatMessage({
    meeting: meeting._id,
    sender: profile._id,
    text: text.trim().substring(0, 1000), // Enforce max length
  });

  await message.save();

  // Populate sender for return
  await message.populate('sender', 'firstName lastName username');

  return { message, meeting };
}

/**
 * Get chat messages for a meeting (with token validation)
 */
async function getChatMessages({ token, limit = 50 }) {
  const { meeting } = await validateChatToken({ token });

  const messages = await MeetingChatMessage.find({ meeting: meeting._id })
    .populate('sender', 'firstName lastName username')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Reverse to show oldest first
  return messages.reverse();
}

/**
 * Get chat URL for a meeting
 */
function getChatUrl({ meetingId, token, baseUrl }) {
  return `${baseUrl}/meeting-chat/${meetingId}?token=${token}`;
}

module.exports = {
  getOrCreateChatToken,
  validateChatToken,
  sendChatMessage,
  getChatMessages,
  getChatUrl,
};

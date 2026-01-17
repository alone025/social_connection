const { Meeting } = require('../models/meeting');
const { Conference } = require('../models/conference');
const { UserProfile } = require('../models/userProfile');
const { getConferenceIdByCode } = require('../lib/conference-helper');
const { ensureUserFromTelegram } = require('./conference.service');

/**
 * Request a 1:1 meeting with another participant
 */
async function requestMeeting({ telegramUser, conferenceCode, recipientProfileId, proposedTime, durationMinutes = 30, message = '' }) {
  const { canCreateMeeting, canUserCreateMeeting } = require('./limit.service');
  
  const user = await ensureUserFromTelegram(telegramUser);
  const conferenceId = await getConferenceIdByCode(conferenceCode);
  
  const conference = await Conference.findById(conferenceId);
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  // Check conference-level meeting limit
  const conferenceLimitCheck = await canCreateMeeting(conferenceId);
  if (!conferenceLimitCheck.allowed) {
    const err = new Error('MEETING_LIMIT_EXCEEDED');
    err.details = {
      limit: conferenceLimitCheck.limit,
      current: conferenceLimitCheck.current,
      reason: 'Conference meeting limit exceeded',
    };
    throw err;
  }

  // Check user-level meeting limit
  const userLimitCheck = await canUserCreateMeeting(conferenceId, user.telegramId);
  if (!userLimitCheck.allowed) {
    const err = new Error('USER_MEETING_LIMIT_EXCEEDED');
    err.details = {
      limit: userLimitCheck.limit,
      current: userLimitCheck.current,
      reason: 'User meeting limit exceeded',
    };
    throw err;
  }

  // Get requester profile
  const requesterProfile = await UserProfile.findOne({
    telegramId: user.telegramId,
    conference: conferenceId,
    isActive: true,
  });

  if (!requesterProfile) {
    throw new Error('NOT_IN_CONFERENCE');
  }

  // Get recipient profile
  const recipientProfile = await UserProfile.findById(recipientProfileId);
  if (!recipientProfile || recipientProfile.conference.toString() !== conferenceId.toString()) {
    throw new Error('RECIPIENT_NOT_FOUND');
  }

  if (requesterProfile._id.toString() === recipientProfileId) {
    throw new Error('CANNOT_MEET_YOURSELF');
  }

  // Validate proposed time
  const now = new Date();
  if (proposedTime <= now) {
    throw new Error('INVALID_TIME_PAST');
  }

  // Check for conflicts: requester or recipient already has a meeting at this time
  const conflictWindowStart = new Date(proposedTime.getTime() - durationMinutes * 60 * 1000);
  const conflictWindowEnd = new Date(proposedTime.getTime() + durationMinutes * 60 * 1000);

  const conflicts = await Meeting.find({
    conference: conferenceId,
    status: { $in: ['pending', 'accepted'] },
    $or: [
      { requester: requesterProfile._id },
      { recipient: requesterProfile._id },
      { requester: recipientProfile._id },
      { recipient: recipientProfile._id },
    ],
    proposedTime: {
      $gte: conflictWindowStart,
      $lte: conflictWindowEnd,
    },
  });

  if (conflicts.length > 0) {
    throw new Error('TIME_CONFLICT');
  }

  // Create meeting request
  const meeting = new Meeting({
    conference: conferenceId,
    requester: requesterProfile._id,
    recipient: recipientProfile._id,
    proposedTime,
    durationMinutes,
    message: message.trim(),
    status: 'pending',
  });

  await meeting.save();

  // Notify recipient about the meeting request
  await notifyMeetingCreated({ meeting, requesterProfile, recipientProfile });

  return { meeting, requesterProfile, recipientProfile };
}

/**
 * Accept a meeting request
 */
async function acceptMeeting({ telegramUser, meetingId }) {
  const user = await ensureUserFromTelegram(telegramUser);
  
  const meeting = await Meeting.findById(meetingId).populate('requester recipient conference');
  if (!meeting) {
    throw new Error('MEETING_NOT_FOUND');
  }

  // Check if user is the recipient
  if (meeting.recipient.telegramId !== user.telegramId) {
    throw new Error('NOT_RECIPIENT');
  }

  if (meeting.status !== 'pending') {
    throw new Error('MEETING_ALREADY_PROCESSED');
  }

  // Check for conflicts again (in case recipient got another request)
  const conflictWindowStart = new Date(meeting.proposedTime.getTime() - meeting.durationMinutes * 60 * 1000);
  const conflictWindowEnd = new Date(meeting.proposedTime.getTime() + meeting.durationMinutes * 60 * 1000);

  const conflicts = await Meeting.find({
    conference: meeting.conference._id,
    status: { $in: ['pending', 'accepted'] },
    _id: { $ne: meetingId },
    $or: [
      { requester: meeting.recipient._id },
      { recipient: meeting.recipient._id },
    ],
    proposedTime: {
      $gte: conflictWindowStart,
      $lte: conflictWindowEnd,
    },
  });

  if (conflicts.length > 0) {
    throw new Error('TIME_CONFLICT');
  }

  meeting.status = 'accepted';
  meeting.updatedAt = new Date();
  await meeting.save();

  return { meeting };
}

/**
 * Reject a meeting request
 */
async function rejectMeeting({ telegramUser, meetingId }) {
  const user = await ensureUserFromTelegram(telegramUser);
  
  const meeting = await Meeting.findById(meetingId).populate('recipient');
  if (!meeting) {
    throw new Error('MEETING_NOT_FOUND');
  }

  if (meeting.recipient.telegramId !== user.telegramId) {
    throw new Error('NOT_RECIPIENT');
  }

  if (meeting.status !== 'pending') {
    throw new Error('MEETING_ALREADY_PROCESSED');
  }

  meeting.status = 'rejected';
  meeting.updatedAt = new Date();
  await meeting.save();

  return { meeting };
}

/**
 * Cancel a meeting (by requester or recipient)
 */
async function cancelMeeting({ telegramUser, meetingId }) {
  const user = await ensureUserFromTelegram(telegramUser);
  
  const meeting = await Meeting.findById(meetingId).populate('requester recipient');
  if (!meeting) {
    throw new Error('MEETING_NOT_FOUND');
  }

  const isRequester = meeting.requester.telegramId === user.telegramId;
  const isRecipient = meeting.recipient.telegramId === user.telegramId;

  if (!isRequester && !isRecipient) {
    throw new Error('NOT_PARTICIPANT');
  }

  if (meeting.status === 'completed' || meeting.status === 'cancelled') {
    throw new Error('MEETING_ALREADY_FINALIZED');
  }

  meeting.status = 'cancelled';
  meeting.updatedAt = new Date();
  await meeting.save();

  // Notify both participants about cancellation
  await notifyMeetingCancelled({ meeting });

  return { meeting };
}

/**
 * List meetings for a user in a conference
 */
async function listMeetings({ telegramUser, conferenceCode, status = null }) {
  const user = await ensureUserFromTelegram(telegramUser);
  const conferenceId = await getConferenceIdByCode(conferenceCode);

  const profile = await UserProfile.findOne({
    telegramId: user.telegramId,
    conference: conferenceId,
    isActive: true,
  });

  if (!profile) {
    throw new Error('NOT_IN_CONFERENCE');
  }

  const query = {
    conference: conferenceId,
    $or: [
      { requester: profile._id },
      { recipient: profile._id },
    ],
  };

  if (status) {
    query.status = status;
  }

  const meetings = await Meeting.find(query)
    .populate('requester', 'firstName lastName roles')
    .populate('recipient', 'firstName lastName roles')
    .sort({ proposedTime: 1 });

  return { meetings, profile };
}

/**
 * Get available time slots for a user (times when they don't have meetings)
 */
async function getAvailableTimeSlots({ telegramUser, conferenceCode, date }) {
  const user = await ensureUserFromTelegram(telegramUser);
  const conferenceId = await getConferenceIdByCode(conferenceCode);

  const profile = await UserProfile.findOne({
    telegramId: user.telegramId,
    conference: conferenceId,
    isActive: true,
  });

  if (!profile) {
    throw new Error('NOT_IN_CONFERENCE');
  }

  const conference = await Conference.findById(conferenceId);
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  // If date is not provided, use today
  if (!date) {
    date = new Date();
  }
  
  // Get all accepted/pending meetings for this user on this date
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const meetings = await Meeting.find({
    conference: conferenceId,
    $or: [
      { requester: profile._id },
      { recipient: profile._id },
    ],
    status: { $in: ['pending', 'accepted'] },
    proposedTime: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  }).sort({ proposedTime: 1 });

  // Generate available slots (every 30 minutes from 9:00 to 18:00)
  const slots = [];
  const startHour = 9;
  const endHour = 18;
  const slotDuration = 30; // minutes

  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += slotDuration) {
      const slotTime = new Date(date);
      slotTime.setHours(hour, minute, 0, 0);
      
      if (slotTime < new Date()) {
        continue; // Skip past times
      }

      // Check if this slot conflicts with any meeting
      const hasConflict = meetings.some((meeting) => {
        const meetingStart = new Date(meeting.proposedTime);
        const meetingEnd = new Date(meetingStart.getTime() + meeting.durationMinutes * 60 * 1000);
        const slotEnd = new Date(slotTime.getTime() + slotDuration * 60 * 1000);
        
        return (slotTime >= meetingStart && slotTime < meetingEnd) ||
               (slotEnd > meetingStart && slotEnd <= meetingEnd) ||
               (slotTime <= meetingStart && slotEnd >= meetingEnd);
      });

      if (!hasConflict) {
        slots.push(slotTime);
      }
    }
  }

  return { slots, meetings };
}

/**
 * Notify participants when a meeting is created
 */
async function notifyMeetingCreated({ meeting, requesterProfile, recipientProfile }) {
  try {
    const { getBot } = require('../telegram/bot');
    const { Conference } = require('../models/conference');
    const bot = getBot();
    
    if (!bot) {
      console.warn('Bot instance not available, skipping meeting notification');
      return;
    }

    const conference = await Conference.findById(meeting.conference);
    if (!conference) return;

    const requesterName = `${requesterProfile.firstName || ''} ${requesterProfile.lastName || ''}`.trim() || 'Участник';
    const meetingTime = new Date(meeting.proposedTime).toLocaleString('ru-RU');
    
    const notificationText = `🤝 Новый запрос на встречу\n\n` +
      `📋 Конференция: ${conference.title}\n` +
      `👤 От: ${requesterName}\n` +
      `⏰ Время: ${meetingTime}\n` +
      `⏱️ Длительность: ${meeting.durationMinutes} минут\n` +
      (meeting.message ? `💬 Сообщение: ${meeting.message}\n` : '') +
      `\nВы можете принять или отклонить запрос.`;

    const menu = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Принять', callback_data: `meeting:accept:${meeting._id}` }],
          [{ text: '❌ Отклонить', callback_data: `meeting:reject:${meeting._id}` }],
          [{ text: '📋 Мои встречи', callback_data: `meeting:list:${conference.conferenceCode}` }],
        ],
      },
    };

    try {
      await bot.telegram.sendMessage(recipientProfile.telegramId, notificationText, menu);
    } catch (err) {
      console.error(`Failed to send meeting notification to ${recipientProfile.telegramId}:`, err.message);
    }
  } catch (err) {
    console.error('Error notifying about meeting creation:', err);
    // Don't throw - notification failure shouldn't break meeting creation
  }
}

/**
 * Notify participants when a meeting is cancelled
 */
async function notifyMeetingCancelled({ meeting }) {
  try {
    const { getBot } = require('../telegram/bot');
    const { Conference } = require('../models/conference');
    const bot = getBot();
    
    if (!bot) {
      console.warn('Bot instance not available, skipping meeting cancellation notification');
      return;
    }

    const conference = await Conference.findById(meeting.conference);
    if (!conference) return;

    const meetingTime = new Date(meeting.proposedTime).toLocaleString('ru-RU');
    // Determine the other person (not the one who cancelled)
    const requesterName = `${meeting.requester.firstName || ''} ${meeting.requester.lastName || ''}`.trim() || 'Участник';
    const recipientName = `${meeting.recipient.firstName || ''} ${meeting.recipient.lastName || ''}`.trim() || 'Участник';
    const otherPersonName = meeting.requester.telegramId === meeting.recipient.telegramId ? requesterName : 
      (meeting.requester.telegramId ? recipientName : requesterName);
    
    const notificationText = `🚫 Встреча отменена\n\n` +
      `📋 Конференция: ${conference.title}\n` +
      `👤 С: ${otherPersonName}\n` +
      `⏰ Время: ${meetingTime}\n` +
      `\nВстреча была отменена.`;

    const menu = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Мои встречи', callback_data: `meeting:list:${conference.conferenceCode}` }],
        ],
      },
    };

    // Notify requester
    if (meeting.requester.telegramId) {
      try {
        await bot.telegram.sendMessage(meeting.requester.telegramId, notificationText, menu);
      } catch (err) {
        console.error(`Failed to send cancellation notification to requester ${meeting.requester.telegramId}:`, err.message);
      }
    }

    // Notify recipient
    if (meeting.recipient.telegramId) {
      try {
        await bot.telegram.sendMessage(meeting.recipient.telegramId, notificationText, menu);
      } catch (err) {
        console.error(`Failed to send cancellation notification to recipient ${meeting.recipient.telegramId}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error notifying about meeting cancellation:', err);
    // Don't throw - notification failure shouldn't break meeting cancellation
  }
}

/**
 * Notify participants when a meeting is starting (called by scheduled job)
 */
async function notifyMeetingStarting({ meeting }) {
  try {
    const { getBot } = require('../telegram/bot');
    const { Conference } = require('../models/conference');
    const bot = getBot();
    
    if (!bot) {
      console.warn('Bot instance not available, skipping meeting start notification');
      return;
    }

    const conference = await Conference.findById(meeting.conference);
    if (!conference) return;

    const requesterName = `${meeting.requester.firstName || ''} ${meeting.requester.lastName || ''}`.trim() || 'Участник';
    const recipientName = `${meeting.recipient.firstName || ''} ${meeting.recipient.lastName || ''}`.trim() || 'Участник';
    const meetingTime = new Date(meeting.proposedTime).toLocaleString('ru-RU');
    const otherPersonName = meeting.requester.telegramId === meeting.recipient.telegramId ? requesterName : 
      (meeting.requester.telegramId ? recipientName : requesterName);
    
    // Get chat token for this meeting
    const { getOrCreateChatToken, getChatUrl } = require('./meetingChat.service');
    const tokenDoc = await getOrCreateChatToken({ meetingId: meeting._id });
    const baseUrl = process.env.BASE_URL || process.env.SERVER_URL || 'http://localhost:3000';
    
    // Create chat URLs with telegramId for both participants
    const requesterChatUrl = getChatUrl({ meetingId: meeting._id.toString(), token: tokenDoc.token, baseUrl }) + `&telegramId=${meeting.requester.telegramId}`;
    const recipientChatUrl = getChatUrl({ meetingId: meeting._id.toString(), token: tokenDoc.token, baseUrl }) + `&telegramId=${meeting.recipient.telegramId}`;

    const notificationText = `⏰ Встреча начинается!\n\n` +
      `📋 Конференция: ${conference.title}\n` +
      `👤 С: ${otherPersonName}\n` +
      `⏰ Время: ${meetingTime}\n` +
      `⏱️ Длительность: ${meeting.durationMinutes} минут\n` +
      `\n💬 Теперь вы можете общаться в чате встречи!\n\nУдачной встречи!`;

    // Create menus with appropriate chat URLs for each participant
    const requesterMenu = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 Открыть чат', url: requesterChatUrl }],
          [{ text: '✅ Отметить как завершённую', callback_data: `meeting:complete:${meeting._id}:${conference.conferenceCode}` }],
          [{ text: '📋 Мои встречи', callback_data: `meeting:list:${conference.conferenceCode}` }],
        ],
      },
    };

    const recipientMenu = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 Открыть чат', url: recipientChatUrl }],
          [{ text: '✅ Отметить как завершённую', callback_data: `meeting:complete:${meeting._id}:${conference.conferenceCode}` }],
          [{ text: '📋 Мои встречи', callback_data: `meeting:list:${conference.conferenceCode}` }],
        ],
      },
    };

    // Notify requester
    if (meeting.requester.telegramId) {
      try {
        await bot.telegram.sendMessage(meeting.requester.telegramId, notificationText, requesterMenu);
      } catch (err) {
        console.error(`Failed to send start notification to requester ${meeting.requester.telegramId}:`, err.message);
      }
    }

    // Notify recipient
    if (meeting.recipient.telegramId && meeting.recipient.telegramId !== meeting.requester.telegramId) {
      try {
        await bot.telegram.sendMessage(meeting.recipient.telegramId, notificationText, recipientMenu);
      } catch (err) {
        console.error(`Failed to send start notification to recipient ${meeting.recipient.telegramId}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error notifying about meeting start:', err);
    // Don't throw - notification failure shouldn't break anything
  }
}

module.exports = {
  requestMeeting,
  acceptMeeting,
  rejectMeeting,
  cancelMeeting,
  listMeetings,
  getAvailableTimeSlots,
  notifyMeetingStarting,
};

const { Conference } = require('../models/conference');
const { Poll } = require('../models/poll');
const { UserProfile } = require('../models/userProfile');
const { ensureUserFromTelegram, userIsMainAdmin } = require('./conference.service');
const { emitToConference } = require('../lib/realtime');
const { validate, pollSchema } = require('../lib/validation');

/**
 * Check if user is speaker or admin in conference
 */
async function canManagePolls({ user, conference }) {
  if (userIsMainAdmin(user)) return true;
  
  const profiles = await UserProfile.find({
    telegramId: user.telegramId,
    conference: conference._id,
    isActive: true,
  });

  if (!profiles.length) return false;

  const profileIdsStr = profiles.map((p) => p._id.toString());
  const isConferenceAdmin =
    profileIdsStr.length > 0 &&
    conference.admins.some((id) => profileIdsStr.includes(id.toString()));

  const isSpeaker = profiles.some((p) => p.roles && p.roles.includes('speaker'));

  return isConferenceAdmin || isSpeaker;
}

/**
 * Create a new poll for a conference (admin or speaker)
 */
async function createPoll({ moderatorUser, conferenceCode, payload }) {
  const conference = await Conference.findOne({ conferenceCode });
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  // Check admin or speaker rights
  const canManage = await canManagePolls({ user: moderatorUser, conference });
  if (!canManage) {
    throw new Error('ACCESS_DENIED');
  }

  // Validate poll data
  const validated = validate({ ...payload, conferenceCode }, pollSchema);

  // Ensure option IDs are sequential starting from 0
  const optionsWithIds = validated.options.map((opt, idx) => ({
    id: idx,
    text: opt.text,
    voters: [],
  }));

  const poll = new Poll({
    conference: conference._id,
    question: validated.question,
    options: optionsWithIds,
    isActive: true,
  });

  await poll.save();

  emitToConference(conference._id, 'poll-created', {
    id: poll._id,
    question: poll.question,
    options: poll.options,
  });

  // Notify all users in the conference about the new poll
  await notifyUsersAboutPoll({ poll, conference });

  return { conference, poll };
}

/**
 * Vote in a poll (atomic operation using updateOne + $addToSet)
 * Per P1.3: prevents duplicate votes and race conditions
 */
async function voteInPoll({ telegramUser, pollId, optionId }) {
  const user = await ensureUserFromTelegram(telegramUser);

  const poll = await Poll.findById(pollId);
  if (!poll) {
    throw new Error('POLL_NOT_FOUND');
  }

  if (!poll.isActive) {
    throw new Error('POLL_INACTIVE');
  }

  // Find user's profile for this conference
  const profile = await UserProfile.findOne({
    telegramId: user.telegramId,
    conference: poll.conference,
    isActive: true,
  });

  if (!profile) {
    throw new Error('NOT_IN_CONFERENCE');
  }

  // Check if option exists
  const option = poll.options.find((opt) => opt.id === optionId);
  if (!option) {
    throw new Error('INVALID_OPTION');
  }

  // Check if user already voted in this poll (check all options)
  let alreadyVoted = false;
  for (const opt of poll.options) {
    if (opt.voters.some((v) => v.toString() === profile._id.toString())) {
      alreadyVoted = true;
      break;
    }
  }

  if (alreadyVoted) {
    throw new Error('ALREADY_VOTED');
  }

  // Atomic update: add voter to the specific option using $addToSet
  // This prevents race conditions and duplicate votes at DB level
  const result = await Poll.updateOne(
    {
      _id: pollId,
      'options.id': optionId,
      'options.voters': { $ne: profile._id }, // Ensure voter is not already in array
    },
    {
      $addToSet: {
        'options.$.voters': profile._id,
      },
    }
  );

  if (result.matchedCount === 0) {
    // Either poll/option not found, or user already voted (race condition caught)
    throw new Error('VOTE_FAILED');
  }

  // Fetch updated poll
  const updatedPoll = await Poll.findById(pollId);

  emitToConference(poll.conference, 'poll-updated', {
    id: updatedPoll._id,
    question: updatedPoll.question,
    options: updatedPoll.options,
  });

  return { poll: updatedPoll, profile };
}

/**
 * Get active polls for a conference
 */
async function getPollsForConference({ conferenceCode }) {
  const conference = await Conference.findOne({ conferenceCode });
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  const polls = await Poll.find({
    conference: conference._id,
    isActive: true,
  }).sort({ createdAt: -1 });

  return { conference, polls };
}

/**
 * Deactivate a poll (admin only)
 */
async function deactivatePoll({ moderatorUser, pollId }) {
  const poll = await Poll.findById(pollId);
  if (!poll) {
    throw new Error('POLL_NOT_FOUND');
  }

  const conference = await Conference.findById(poll.conference);
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  // Check admin rights
  const profiles = await UserProfile.find({
    telegramId: moderatorUser.telegramId,
    conference: conference._id,
  });
  const profileIdsStr = profiles.map((p) => p._id.toString());
  const isConferenceAdmin =
    profileIdsStr.length > 0 &&
    conference.admins.some((id) => profileIdsStr.includes(id.toString()));

  if (!userIsMainAdmin(moderatorUser) && !isConferenceAdmin) {
    throw new Error('ACCESS_DENIED');
  }

  poll.isActive = false;
  await poll.save();

  emitToConference(conference._id, 'poll-updated', {
    id: poll._id,
    question: poll.question,
    options: poll.options,
    isActive: false,
  });

  return { poll, conference };
}

/**
 * Update a poll (admin or speaker)
 */
async function updatePoll({ moderatorUser, pollId, payload }) {
  const poll = await Poll.findById(pollId);
  if (!poll) {
    throw new Error('POLL_NOT_FOUND');
  }

  const conference = await Conference.findById(poll.conference);
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  // Check admin or speaker rights
  const canManage = await canManagePolls({ user: moderatorUser, conference });
  if (!canManage) {
    throw new Error('ACCESS_DENIED');
  }

  // Validate poll data
  const validated = validate({ ...payload, conferenceCode: conference.conferenceCode }, pollSchema);

  if (validated.question) poll.question = validated.question;
  if (validated.options) {
    poll.options = validated.options.map((opt, idx) => ({
      id: idx,
      text: opt.text,
      voters: poll.options[idx]?.voters || [], // Preserve existing voters
    }));
  }

  await poll.save();

  emitToConference(conference._id, 'poll-updated', {
    id: poll._id,
    question: poll.question,
    options: poll.options,
  });

  return { poll, conference };
}

/**
 * Delete a poll (admin or speaker)
 */
async function deletePoll({ moderatorUser, pollId }) {
  const poll = await Poll.findById(pollId);
  if (!poll) {
    throw new Error('POLL_NOT_FOUND');
  }

  const conference = await Conference.findById(poll.conference);
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  // Check admin or speaker rights
  const canManage = await canManagePolls({ user: moderatorUser, conference });
  if (!canManage) {
    throw new Error('ACCESS_DENIED');
  }

  await Poll.deleteOne({ _id: pollId });

  emitToConference(conference._id, 'poll-deleted', {
    id: poll._id,
  });

  return { deleted: true, pollId };
}

/**
 * List polls for speaker/admin management
 */
async function listPollsForManagement({ moderatorUser, conferenceCode }) {
  const conference = await Conference.findOne({ conferenceCode });
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  // Check admin or speaker rights
  const canManage = await canManagePolls({ user: moderatorUser, conference });
  if (!canManage) {
    throw new Error('ACCESS_DENIED');
  }

  const polls = await Poll.find({
    conference: conference._id,
  }).sort({ createdAt: -1 });

  return { conference, polls };
}

/**
 * Notify all users in the conference about a new poll
 */
async function notifyUsersAboutPoll({ poll, conference }) {
  try {
    const { getBot } = require('../telegram/bot');
    const { getPollNotificationMenu } = require('../telegram/menus');
    const bot = getBot();
    
    if (!bot) {
      console.warn('Bot instance not available, skipping poll notification');
      return;
    }

    // Get all active users in the conference
    const profiles = await UserProfile.find({
      conference: conference._id,
      isActive: true,
      onboardingCompleted: true,
    });

    const userTelegramIds = new Set();
    profiles.forEach(profile => {
      if (profile.telegramId) {
        userTelegramIds.add(profile.telegramId);
      }
    });

    const optionsText = poll.options.map((opt, idx) => `${idx + 1}. ${opt.text}`).join('\n');

    const notificationText = `📊 Новый опрос\n\n` +
      `📋 Конференция: ${conference.title}\n\n` +
      `❓ Вопрос:\n${poll.question}\n\n` +
      `📝 Варианты ответов:\n${optionsText}`;

    const menu = getPollNotificationMenu(conference.conferenceCode, poll._id);

    // Send notification to all users
    for (const telegramId of userTelegramIds) {
      try {
        await bot.telegram.sendMessage(telegramId, notificationText, menu);
      } catch (err) {
        console.error(`Failed to send poll notification to ${telegramId}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error notifying users about poll:', err);
    // Don't throw - notification failure shouldn't break poll creation
  }
}

module.exports = {
  createPoll,
  voteInPoll,
  getPollsForConference,
  deactivatePoll,
  updatePoll,
  deletePoll,
  listPollsForManagement,
};


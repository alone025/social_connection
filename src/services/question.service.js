const { Conference } = require('../models/conference');
const { Question } = require('../models/question');
const { UserProfile } = require('../models/userProfile');
const { User } = require('../models/user');
const { ensureUserFromTelegram, userIsMainAdmin } = require('./conference.service');
const { emitToConference } = require('../lib/realtime');
const { getConferenceIdByCode } = require('../lib/conference-helper');

function parseMainAdminIdsFromEnv() {
  const raw = process.env.MAIN_ADMIN_TELEGRAM_IDS || '';
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

async function askQuestion({ telegramUser, conferenceCode, text, targetSpeakerProfileId = null }) {
  const { validate, questionSchema } = require('../lib/validation');
  
  // Validate input data
  const validated = validate({ text, conferenceCode }, questionSchema);
  const validatedText = validated.text;
  const validatedCode = validated.conferenceCode;

  const user = await ensureUserFromTelegram(telegramUser);

  // Convert conferenceCode to conferenceId (ObjectId) for consistent DB queries
  const conferenceId = await getConferenceIdByCode(validatedCode);
  
  // Verify conference is not ended
  const conference = await Conference.findOne({
    _id: conferenceId,
    isEnded: false,
  });
  if (!conference) {
    const err = new Error('CONFERENCE_NOT_FOUND');
    throw err;
  }

  // Use conferenceId (ObjectId) for all DB queries
  const profile = await UserProfile.findOne({
    telegramId: user.telegramId,
    conference: conferenceId,
    isActive: true,
  });

  if (!profile) {
    const err = new Error('NOT_IN_CONFERENCE');
    throw err;
  }

  // If target speaker specified, verify they are a speaker
  if (targetSpeakerProfileId) {
    const targetProfile = await UserProfile.findById(targetSpeakerProfileId);
    if (!targetProfile || !targetProfile.roles || !targetProfile.roles.includes('speaker')) {
      throw new Error('TARGET_NOT_SPEAKER');
    }
  }

  // Check limits
  const { canCreateQuestion } = require('./limit.service');
  const limitCheck = await canCreateQuestion(conferenceId);
  if (!limitCheck.allowed) {
    const err = new Error('LIMIT_EXCEEDED');
    err.details = {
      limit: limitCheck.limit,
      current: limitCheck.current,
      resource: 'questions',
    };
    throw err;
  }

  // Use conferenceId (ObjectId) for all DB operations
  const question = new Question({
    conference: conferenceId,
    author: profile._id,
    text: validatedText,
    status: 'pending',
    targetSpeaker: targetSpeakerProfileId || null,
  });

  await question.save();

  // Use conferenceId (ObjectId) for real-time events
  emitToConference(conferenceId, 'question-created', {
    _id: question._id,
    id: question._id,
    text: question.text,
    status: question.status,
    createdAt: question.createdAt,
    targetSpeaker: targetSpeakerProfileId,
  });

  // Notify admins about new question
  await notifyAdminsAboutQuestion({ question, conference });

  return { question, conference, profile };
}

async function listQuestionsForModeration({ moderatorUser, conferenceCode }) {
  // Convert conferenceCode to conferenceId (ObjectId) for consistent DB queries
  const conferenceId = await getConferenceIdByCode(conferenceCode);
  
  const conference = await Conference.findById(conferenceId);
  if (!conference) {
    const err = new Error('CONFERENCE_NOT_FOUND');
    throw err;
  }

  // Use conferenceId (ObjectId) for all DB queries
  const profiles = await UserProfile.find({
    telegramId: moderatorUser.telegramId,
    conference: conferenceId,
  });
  const profileIdsStr = profiles.map((p) => p._id.toString());
  const isConferenceAdmin =
    profileIdsStr.length > 0 &&
    conference.admins.some((id) => profileIdsStr.includes(id.toString()));

  if (!userIsMainAdmin(moderatorUser) && !isConferenceAdmin) {
    const err = new Error('ACCESS_DENIED');
    throw err;
  }

  // Use conferenceId (ObjectId) for all DB queries
  const questions = await Question.find({
    conference: conferenceId,
    status: 'pending',
  }).sort({ createdAt: 1 });

  return { conference, questions };
}

async function approveQuestion({ moderatorUser, conferenceCode, questionId }) {
  const conference = await Conference.findOne({ conferenceCode });
  if (!conference) {
    const err = new Error('CONFERENCE_NOT_FOUND');
    throw err;
  }

  const profiles = await UserProfile.find({
    telegramId: moderatorUser.telegramId,
    conference: conference._id,
  });
  const profileIdsStr = profiles.map((p) => p._id.toString());
  const isConferenceAdmin =
    profileIdsStr.length > 0 &&
    conference.admins.some((id) => profileIdsStr.includes(id.toString()));

  if (!userIsMainAdmin(moderatorUser) && !isConferenceAdmin) {
    const err = new Error('ACCESS_DENIED');
    throw err;
  }

  const question = await Question.findOne({
    _id: questionId,
    conference: conference._id,
  });
  if (!question) {
    const err = new Error('QUESTION_NOT_FOUND');
    throw err;
  }

  question.status = 'approved';
  await question.save();

  // Use conference._id (ObjectId) for real-time events
  emitToConference(conference._id, 'question-updated', {
    _id: question._id,
    id: question._id,
    text: question.text,
    status: question.status,
    createdAt: question.createdAt,
  });

  return { conference, question };
}

async function rejectQuestion({ moderatorUser, conferenceCode, questionId }) {
  const conference = await Conference.findOne({ conferenceCode });
  if (!conference) {
    const err = new Error('CONFERENCE_NOT_FOUND');
    throw err;
  }

  const profiles = await UserProfile.find({
    telegramId: moderatorUser.telegramId,
    conference: conference._id,
  });
  const profileIdsStr = profiles.map((p) => p._id.toString());
  const isConferenceAdmin =
    profileIdsStr.length > 0 &&
    conference.admins.some((id) => profileIdsStr.includes(id.toString()));

  if (!userIsMainAdmin(moderatorUser) && !isConferenceAdmin) {
    const err = new Error('ACCESS_DENIED');
    throw err;
  }

  const question = await Question.findOne({
    _id: questionId,
    conference: conference._id,
  });
  if (!question) {
    const err = new Error('QUESTION_NOT_FOUND');
    throw err;
  }

  question.status = 'rejected';
  await question.save();

  // Use conference._id (ObjectId) for real-time events
  emitToConference(conference._id, 'question-updated', {
    _id: question._id,
    id: question._id,
    text: question.text,
    status: question.status,
    createdAt: question.createdAt,
  });

  return { conference, question };
}

/**
 * Answer a question (speaker only)
 */
async function answerQuestion({ speakerUser, conferenceCode, questionId, answerText }) {
  const { validate } = require('../lib/validation');
  const Joi = require('joi');
  
  // Validate answer text
  const answerSchema = Joi.object({
    answerText: Joi.string().min(5).max(1000).required().messages({
      'string.min': 'Ответ должен содержать минимум 5 символов.',
      'string.max': 'Ответ должен содержать максимум 1000 символов.',
      'any.required': 'Ответ обязателен.',
    }),
  });
  
  validate({ answerText }, answerSchema);

  const user = await ensureUserFromTelegram(speakerUser);
  const conference = await Conference.findOne({ conferenceCode });
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  const speakerProfile = await UserProfile.findOne({
    telegramId: user.telegramId,
    conference: conference._id,
    isActive: true,
    roles: 'speaker',
  });

  if (!speakerProfile) {
    throw new Error('NOT_SPEAKER');
  }

  const question = await Question.findOne({
    _id: questionId,
    conference: conference._id,
    status: 'approved',
  });

  if (!question) {
    throw new Error('QUESTION_NOT_FOUND');
  }

  // Check if question is for this speaker or for all
  if (question.targetSpeaker && question.targetSpeaker.toString() !== speakerProfile._id.toString()) {
    throw new Error('QUESTION_NOT_FOR_YOU');
  }

  question.isAnswered = true;
  question.answer = answerText;
  question.answeredBy = speakerProfile._id;
  await question.save();

  // Use conference._id (ObjectId) for real-time events
  emitToConference(conference._id, 'question-answered', {
    id: question._id,
    text: question.text,
    answer: question.answer,
    answeredBy: speakerProfile._id,
  });

  return { question, conference, speakerProfile };
}

/**
 * List questions for a speaker (their questions or all if no target)
 */
async function listQuestionsForSpeaker({ speakerUser, conferenceCode }) {
  const user = await ensureUserFromTelegram(speakerUser);
  const conference = await Conference.findOne({ conferenceCode });
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  const speakerProfile = await UserProfile.findOne({
    telegramId: user.telegramId,
    conference: conference._id,
    isActive: true,
    roles: 'speaker',
  });

  if (!speakerProfile) {
    throw new Error('NOT_SPEAKER');
  }

  const questions = await Question.find({
    conference: conference._id,
    status: 'approved',
    $or: [
      { targetSpeaker: null }, // Questions for all speakers
      { targetSpeaker: speakerProfile._id }, // Questions for this speaker
    ],
    isAnswered: false,
  })
    .populate('author', 'firstName lastName')
    .sort({ createdAt: 1 });

  return { conference, questions, speakerProfile };
}

/**
 * List speakers in a conference
 */
async function listSpeakers({ conferenceCode }) {
  const conference = await Conference.findOne({ conferenceCode });
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  const speakers = await UserProfile.find({
    conference: conference._id,
    isActive: true,
    roles: 'speaker',
  }).select('firstName lastName username telegramId');

  return { conference, speakers };
}

/**
 * Notify all admins (main admins + conference admins) about a new question
 */
async function notifyAdminsAboutQuestion({ question, conference }) {
  try {
    const { getBot } = require('../telegram/bot');
    const { getQuestionNotificationMenu } = require('../telegram/menus');
    const bot = getBot();
    
    if (!bot) {
      console.warn('Bot instance not available, skipping admin notification');
      return;
    }

    // Get all main admins
    const mainAdminIds = parseMainAdminIdsFromEnv();
    const mainAdmins = await User.find({
      $or: [
        { telegramId: { $in: mainAdminIds } },
        { globalRole: 'main_admin' }
      ]
    });

    // Get all conference admins
    const adminProfiles = await UserProfile.find({
      _id: { $in: conference.admins },
      isActive: true,
    }).populate('conference');

    const adminTelegramIds = new Set();

    // Add main admins
    mainAdmins.forEach(admin => {
      if (admin.telegramId) {
        adminTelegramIds.add(admin.telegramId);
      }
    });

    // Add conference admins
    adminProfiles.forEach(profile => {
      if (profile.telegramId) {
        adminTelegramIds.add(profile.telegramId);
      }
    });

    // Get author name if available
    const authorProfile = await UserProfile.findById(question.author);
    const authorName = authorProfile 
      ? `${authorProfile.firstName || ''} ${authorProfile.lastName || ''}`.trim() || 'Участник'
      : 'Участник';

    const notificationText = `🔔 Новый вопрос для модерации\n\n` +
      `📋 Конференция: ${conference.title}\n` +
      `👤 От: ${authorName}\n\n` +
      `❓ Вопрос:\n${question.text}`;

    const menu = getQuestionNotificationMenu(conference.conferenceCode);

    // Send notification to all admins
    for (const telegramId of adminTelegramIds) {
      try {
        await bot.telegram.sendMessage(telegramId, notificationText, menu);
      } catch (err) {
        console.error(`Failed to send question notification to ${telegramId}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error notifying admins about question:', err);
    // Don't throw - notification failure shouldn't break question creation
  }
}

module.exports = {
  askQuestion,
  listQuestionsForModeration,
  approveQuestion,
  rejectQuestion,
  answerQuestion,
  listQuestionsForSpeaker,
  listSpeakers,
};



const { Conference } = require('../models/conference');
const { Question } = require('../models/question');
const { UserProfile } = require('../models/userProfile');
const { ensureUserFromTelegram, userIsMainAdmin } = require('./conference.service');
const { emitToConference } = require('../lib/realtime');

async function askQuestion({ telegramUser, conferenceCode, text, targetSpeakerProfileId = null }) {
  const { validate, questionSchema } = require('../lib/validation');
  
  // Validate input data
  const validated = validate({ text, conferenceCode }, questionSchema);
  const validatedText = validated.text;
  const validatedCode = validated.conferenceCode;

  const user = await ensureUserFromTelegram(telegramUser);

  const conference = await Conference.findOne({
    conferenceCode: validatedCode,
    isEnded: false,
  });
  if (!conference) {
    const err = new Error('CONFERENCE_NOT_FOUND');
    throw err;
  }

  const profile = await UserProfile.findOne({
    telegramId: user.telegramId,
    conference: conference._id,
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

  const question = new Question({
    conference: conference._id,
    author: profile._id,
    text: validatedText,
    status: 'pending',
    targetSpeaker: targetSpeakerProfileId || null,
  });

  await question.save();

  // Optionally notify second screen / moderators about new question
  emitToConference(conference._id, 'question-created', {
    _id: question._id,
    id: question._id,
    text: question.text,
    status: question.status,
    createdAt: question.createdAt,
    targetSpeaker: targetSpeakerProfileId,
  });

  return { question, conference, profile };
}

async function listQuestionsForModeration({ moderatorUser, conferenceCode }) {
  const conference = await Conference.findOne({ conferenceCode });
  if (!conference) {
    const err = new Error('CONFERENCE_NOT_FOUND');
    throw err;
  }

  // Main admin or conference admin
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

  const questions = await Question.find({
    conference: conference._id,
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

module.exports = {
  askQuestion,
  listQuestionsForModeration,
  approveQuestion,
  rejectQuestion,
  answerQuestion,
  listQuestionsForSpeaker,
  listSpeakers,
};



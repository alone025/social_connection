const { Conference } = require('../models/conference');
const { UserProfile } = require('../models/userProfile');
const { Question } = require('../models/question');
const { Poll } = require('../models/poll');
const { Meeting } = require('../models/meeting');
const { getConferenceIdByCode } = require('../lib/conference-helper');
const { ensureUserFromTelegram, userIsMainAdmin, isConferenceAdminFor } = require('./conference.service');

/**
 * Generate organizer report for a conference
 */
async function generateOrganizerReport({ telegramUser, conferenceCode }) {
  const user = await ensureUserFromTelegram(telegramUser);
  const conferenceId = await getConferenceIdByCode(conferenceCode);

  const conference = await Conference.findById(conferenceId);
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  // Check access: must be main admin or conference admin
  const isMainAdmin = userIsMainAdmin(user);
  const isAdmin = await isConferenceAdminFor({ user, conference });
  
  if (!isMainAdmin && !isAdmin) {
    throw new Error('ACCESS_DENIED');
  }

  // Get all participants
  const participants = await UserProfile.find({
    conference: conferenceId,
    isActive: true,
  });

  // Get participants by role
  const speakers = participants.filter((p) => p.roles && p.roles.includes('speaker'));
  const investors = participants.filter((p) => p.roles && p.roles.includes('investor'));
  const organizers = participants.filter((p) => p.roles && p.roles.includes('organizer'));
  const regularParticipants = participants.filter(
    (p) => !p.roles || (!p.roles.includes('speaker') && !p.roles.includes('investor') && !p.roles.includes('organizer'))
  );

  // Get onboarding completion rate
  const completedOnboarding = participants.filter((p) => p.onboardingCompleted).length;
  const onboardingRate = participants.length > 0 ? (completedOnboarding / participants.length) * 100 : 0;

  // Get questions stats
  const totalQuestions = await Question.countDocuments({ conference: conferenceId });
  const approvedQuestions = await Question.countDocuments({ conference: conferenceId, status: 'approved' });
  const pendingQuestions = await Question.countDocuments({ conference: conferenceId, status: 'pending' });
  const rejectedQuestions = await Question.countDocuments({ conference: conferenceId, status: 'rejected' });

  // Get polls stats
  const totalPolls = await Poll.countDocuments({ conference: conferenceId });
  const activePolls = await Poll.countDocuments({ conference: conferenceId, isActive: true });
  const totalVotes = await Poll.aggregate([
    { $match: { conference: conferenceId } },
    { $unwind: '$options' },
    { $group: { _id: null, total: { $sum: { $size: '$options.voters' } } } },
  ]);
  const voteCount = totalVotes.length > 0 ? totalVotes[0].total : 0;

  // Get meetings stats
  const totalMeetings = await Meeting.countDocuments({ conference: conferenceId });
  const acceptedMeetings = await Meeting.countDocuments({ conference: conferenceId, status: 'accepted' });
  const completedMeetings = await Meeting.countDocuments({ conference: conferenceId, status: 'completed' });
  const pendingMeetings = await Meeting.countDocuments({ conference: conferenceId, status: 'pending' });

  // Calculate engagement metrics
  const participantsWithQuestions = await Question.distinct('author', { conference: conferenceId });
  const participantsWithVotes = await Poll.aggregate([
    { $match: { conference: conferenceId } },
    { $unwind: '$options' },
    { $unwind: '$options.voters' },
    { $group: { _id: '$options.voters' } },
  ]);
  // Get all meetings for this conference and extract participant IDs
  const meetings = await Meeting.find({ conference: conferenceId }).select('requester recipient');
  const participantsWithMeetings = new Set();
  meetings.forEach((m) => {
    if (m.requester) participantsWithMeetings.add(m.requester.toString());
    if (m.recipient) participantsWithMeetings.add(m.recipient.toString());
  });

  const engagedParticipants = new Set();
  participantsWithQuestions.forEach((id) => engagedParticipants.add(id.toString()));
  participantsWithVotes.forEach((v) => engagedParticipants.add(v._id.toString()));
  participantsWithMeetings.forEach((id) => engagedParticipants.add(id));

  const engagementRate = participants.length > 0 ? (engagedParticipants.size / participants.length) * 100 : 0;

  // Format report
  const report = {
    conference: {
      title: conference.title,
      conferenceCode: conference.conferenceCode, // Fixed: use conferenceCode instead of code
      status: conference.isEnded ? 'Завершена' : conference.isActive ? 'Активна' : 'Остановлена',
      startsAt: conference.startsAt,
      endsAt: conference.endsAt,
    },
    participants: {
      total: participants.length,
      speakers: speakers.length,
      investors: investors.length,
      organizers: organizers.length,
      regular: regularParticipants.length,
      onboardingCompleted: completedOnboarding,
      onboardingRate: Math.round(onboardingRate * 10) / 10,
    },
    questions: {
      total: totalQuestions,
      approved: approvedQuestions,
      pending: pendingQuestions,
      rejected: rejectedQuestions,
    },
    polls: {
      total: totalPolls,
      active: activePolls,
      totalVotes: voteCount,
    },
    meetings: {
      total: totalMeetings,
      accepted: acceptedMeetings,
      completed: completedMeetings,
      pending: pendingMeetings,
    },
    engagement: {
      engagedParticipants: engagedParticipants.size,
      engagementRate: Math.round(engagementRate * 10) / 10,
    },
  };

  return report;
}

/**
 * Format report as text for Telegram
 */
function formatReportAsText(report) {
  const lines = [
    `📊 ОТЧЁТ ОРГАНИЗАТОРА`,
    ``,
    `📋 Конференция: ${report.conference.title}`,
    `Код: ${report.conference.conferenceCode}`,
    `Статус: ${report.conference.status}`,
    report.conference.startsAt ? `Начало: ${new Date(report.conference.startsAt).toLocaleString('ru-RU')}` : '',
    report.conference.endsAt ? `Конец: ${new Date(report.conference.endsAt).toLocaleString('ru-RU')}` : '',
    ``,
    `👥 УЧАСТНИКИ`,
    `Всего: ${report.participants.total}`,
    `🎤 Спикеры: ${report.participants.speakers}`,
    `💰 Инвесторы: ${report.participants.investors}`,
    `📋 Организаторы: ${report.participants.organizers}`,
    `👤 Обычные участники: ${report.participants.regular}`,
    `✅ Завершили онбординг: ${report.participants.onboardingCompleted} (${report.participants.onboardingRate}%)`,
    ``,
    `❓ ВОПРОСЫ`,
    `Всего: ${report.questions.total}`,
    `✅ Одобрено: ${report.questions.approved}`,
    `⏳ На модерации: ${report.questions.pending}`,
    `❌ Отклонено: ${report.questions.rejected}`,
    ``,
    `📊 ОПРОСЫ`,
    `Всего: ${report.polls.total}`,
    `✅ Активных: ${report.polls.active}`,
    `🗳️ Всего голосов: ${report.polls.totalVotes}`,
    ``,
    `🤝 ВСТРЕЧИ 1:1`,
    `Всего: ${report.meetings.total}`,
    `✅ Принято: ${report.meetings.accepted}`,
    `✅ Завершено: ${report.meetings.completed}`,
    `⏳ Ожидают ответа: ${report.meetings.pending}`,
    ``,
    `📈 ВОВЛЕЧЁННОСТЬ`,
    `Активных участников: ${report.engagement.engagedParticipants}`,
    `Уровень вовлечённости: ${report.engagement.engagementRate}%`,
  ];

  return lines.filter(Boolean).join('\n');
}

module.exports = {
  generateOrganizerReport,
  formatReportAsText,
};

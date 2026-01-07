/**
 * Handler Service - Business logic for Telegram bot handlers
 * Extracts complex logic from handlers to make them thin controllers (30-40 lines)
 */

const { ensureUserFromTelegram } = require('./conference.service');
const { getMainMenu, getUserMenu, getConferenceAdminMenu, getMainAdminMenu } = require('../telegram/menus');

/**
 * Format error message for user
 */
function formatErrorMessage(error) {
  const errorMessages = {
    'CONFERENCE_NOT_FOUND': '❌ Конференция не найдена.',
    'CONFERENCE_PRIVATE': '❌ Эта конференция приватная. Для присоединения нужен специальный код доступа.',
    'NOT_IN_CONFERENCE': '❌ Вы не участвуете в этой конференции.',
    'ACCESS_DENIED': '❌ У вас нет прав для выполнения этого действия.',
    'QUESTION_NOT_FOUND': '❌ Вопрос не найден.',
    'POLL_NOT_FOUND': '❌ Опрос не найден.',
    'POLL_INACTIVE': '❌ Опрос завершён.',
    'ALREADY_VOTED': '❌ Вы уже проголосовали в этом опросе.',
    'VOTE_FAILED': '❌ Не удалось проголосовать. Возможно, вы уже голосовали.',
    'INVALID_OPTION': '❌ Неверный вариант ответа.',
    'TARGET_USER_NOT_FOUND': '❌ Пользователь не найден.',
    'TARGET_USER_NOT_ADMIN': '❌ Пользователь не является администратором этой конференции.',
    'TARGET_NOT_SPEAKER': '❌ Выбранный пользователь не является спикером.',
    'NOT_SPEAKER': '❌ У вас нет прав спикера в этой конференции.',
    'QUESTION_NOT_FOR_YOU': '❌ Этот вопрос адресован другому спикеру.',
    'VALIDATION_ERROR': '❌ Ошибка валидации данных.',
  };

  if (error.message && errorMessages[error.message]) {
    return errorMessages[error.message];
  }

  // Handle validation errors with details
  if (error.message && error.message.startsWith('VALIDATION_ERROR:')) {
    const details = error.message.replace('VALIDATION_ERROR: ', '');
    return `❌ Ошибка валидации: ${details}`;
  }

  return '❌ Произошла ошибка. Попробуйте ещё раз.';
}

/**
 * Get appropriate menu based on user roles
 */
async function getMenuForUser(telegramUser) {
  const { getUserRoles } = require('../telegram/menus');
  const roles = await getUserRoles(telegramUser);
  
  if (roles.isMainAdmin) {
    return getMainAdminMenu();
  }
  if (roles.isConferenceAdmin || roles.conferenceAdminFor.length > 0) {
    return getConferenceAdminMenu();
  }
  if (roles.hasSpeakerRole) {
    return getUserMenu(); // Speakers use user menu
  }
  return getUserMenu();
}

/**
 * Handle handler errors consistently
 */
async function handleHandlerError(ctx, error, defaultMenu = null) {
  console.error('Handler error:', error);
  
  const errorMsg = formatErrorMessage(error);
  const menu = defaultMenu || await getMenuForUser(ctx.from);
  
  // Try to edit message, fallback to reply if it fails
  try {
    await ctx.editMessageText(errorMsg, menu);
  } catch (editError) {
    // Handle "message is not modified" error - this is not critical
    if (editError.response && editError.response.error_code === 400 && 
        editError.response.description && editError.response.description.includes('message is not modified')) {
      // Message is already up to date, just return
      return;
    }
    // For other errors, try to reply
    try {
      await ctx.reply(errorMsg, menu);
    } catch (replyError) {
      // If reply also fails, just log it
      console.error('Failed to send error message:', replyError);
    }
  }
}

/**
 * Format conference details text
 */
function formatConferenceDetails(conference, conferenceCode) {
  const startDate = conference.startsAt instanceof Date 
    ? conference.startsAt.toLocaleString('ru-RU') 
    : (conference.startsAt ? new Date(conference.startsAt).toLocaleString('ru-RU') : 'Не указана');
  
  const endDate = conference.endsAt instanceof Date 
    ? conference.endsAt.toLocaleString('ru-RU') 
    : (conference.endsAt ? new Date(conference.endsAt).toLocaleString('ru-RU') : 'Не указана');
  
  const status = conference.isEnded ? 'Завершена' : (conference.isActive ? 'Активна' : 'Остановлена');
  
  return `📋 ${conference.title}\n\n` +
    `Код: ${conferenceCode}\n` +
    `Статус: ${status}\n` +
    `Начало: ${startDate}\n` +
    `Окончание: ${endDate}\n` +
    (conference.description ? `\n${conference.description}` : '');
}

/**
 * Format conferences list
 */
function formatConferencesList(conferences) {
  return conferences
    .filter((c) => c && c.conferenceCode)
    .map((c) => {
      const startDate = c.startsAt instanceof Date 
        ? c.startsAt.toLocaleString('ru-RU') 
        : (c.startsAt ? new Date(c.startsAt).toLocaleString('ru-RU') : '');
      return `• ${c.title}\n  Код: ${c.conferenceCode}${startDate ? `\n  Старт: ${startDate}` : ''}`;
    });
}

/**
 * Format polls list for management
 */
function formatPollsList(polls, conferenceCode) {
  if (!polls.length) {
    return { text: '📊 Нет опросов. Создайте новый опрос.', hasPolls: false };
  }
  
  const text = `📊 Опросы (${polls.length})\n\nВыберите опрос для управления:`;
  const buttons = polls.map((p) => [
    { text: `${p.isActive ? '✅' : '⏸️'} ${p.question}`, callback_data: `admin:poll:${p._id}:${conferenceCode}` }
  ]);
  
  return { text, buttons, hasPolls: true };
}

/**
 * Format questions list for moderation
 */
function formatQuestionsList(questions, conferenceCode) {
  if (!questions.length) {
    return { text: '✅ Нет вопросов на модерации.', hasQuestions: false };
  }
  
  const text = questions.map((q, idx) => 
    `${idx + 1}. ${q.text.substring(0, 100)}${q.text.length > 100 ? '...' : ''}`
  ).join('\n\n');
  
  const buttons = questions.map((q) => [
    { text: `❓ ${q.text.substring(0, 30)}${q.text.length > 30 ? '...' : ''}`, callback_data: `moderate:question:${conferenceCode}:${q._id}` }
  ]);
  
  return { text: `❓ Вопросы на модерации (${questions.length}):\n\n${text}`, buttons, hasQuestions: true };
}

/**
 * Get conference code from poll or conference
 */
async function getConferenceCodeFromPoll(pollId) {
  const { Poll } = require('../models/poll');
  const { Conference } = require('../models/conference');
  
  const poll = await Poll.findById(pollId);
  if (!poll) return null;
  
  const conference = await Conference.findById(poll.conference);
  return conference ? conference.conferenceCode : null;
}

module.exports = {
  formatErrorMessage,
  getMenuForUser,
  handleHandlerError,
  formatConferenceDetails,
  formatConferencesList,
  formatPollsList,
  formatQuestionsList,
  getConferenceCodeFromPoll,
};

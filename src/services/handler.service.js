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

/**
 * Format conferences list with buttons for my_conferences handler
 */
async function formatConferencesListWithButtons(conferences, getSecondScreenUrl) {
  const { Markup } = require('telegraf');
  
  const lines = conferences
    .filter((c) => c && c.conferenceCode)
    .map((c) => {
      const startDate = c.startsAt instanceof Date 
        ? c.startsAt.toLocaleString('ru-RU') 
        : (c.startsAt ? new Date(c.startsAt).toLocaleString('ru-RU') : '');
      return `• ${c.title}\n  Код: ${c.conferenceCode}${startDate ? `\n  Старт: ${startDate}` : ''}`;
    });

  const buttons = conferences
    .filter((c) => c && c.conferenceCode)
    .map((c) => {
      const row = [Markup.button.callback(`📋 ${c.title}`, `conf:details:${c.conferenceCode}`)];
      const secondScreenUrl = getSecondScreenUrl(c.conferenceCode);
      if (secondScreenUrl) {
        row.push(Markup.button.url('📺', secondScreenUrl));
      }
      return row;
    });
  buttons.push([Markup.button.callback('◀️ Назад', 'menu:main')]);

  return {
    text: `📋 Ваши конференции:\n\n${lines.join('\n\n')}\n\n📺 - открыть второй экран`,
    buttons: Markup.inlineKeyboard(buttons),
  };
}

/**
 * Process search filter results and send notifications
 */
async function processSearchFilterResults({ profiles, conferenceCode, searcherTelegramId, getSearchFilterMenu }) {
  const { ensureUserFromTelegram } = require('./conference.service');
  const { UserProfile } = require('../models/userProfile');
  const { getConferenceIdByCode } = require('../lib/conference-helper');
  const { getBot } = require('../telegram/bot');

  const searcher = await ensureUserFromTelegram({ id: searcherTelegramId });
  const conferenceId = await getConferenceIdByCode(conferenceCode);
  const searcherProfile = await UserProfile.findOne({
    telegramId: searcher.telegramId,
    conference: conferenceId,
    isActive: true,
  });

  const resultText = [];
  const profilesWithoutUsername = [];

  for (const p of profiles) {
    const roles = p.roles && p.roles.length > 0 ? ` (${p.roles.join(', ')})` : '';
    const interests = p.interests && p.interests.length > 0 ? `\n  Интересы: ${p.interests.join(', ')}` : '';
    const username = p.user?.username ? `\n  @${p.user.username}` : '';
    resultText.push(`${resultText.length + 1}. ${p.firstName || ''} ${p.lastName || ''}${username}${roles}${interests}`);
    
    if (!p.user?.username && p.telegramId !== searcher.telegramId) {
      profilesWithoutUsername.push(p);
    }
  }

  // Send notifications to users without username
  if (profilesWithoutUsername.length > 0 && searcherProfile) {
    const bot = getBot();
    const searcherName = `${searcherProfile.firstName || ''} ${searcherProfile.lastName || ''}`.trim() || 'Участник';
    const searcherUsername = searcherProfile.username ? `@${searcherProfile.username}` : null;
    
    for (const profile of profilesWithoutUsername) {
      try {
        const notificationText = `👋 ${searcherName}${searcherUsername ? ` (${searcherUsername})` : ''} ищет участников в конференции и хотел бы с вами связаться.\n\n` +
          `💡 Добавьте username в свой профиль Telegram, чтобы другие участники могли с вами связаться напрямую.`;
        await bot.telegram.sendMessage(profile.telegramId, notificationText);
      } catch (err) {
        console.error(`Error sending notification to ${profile.telegramId}:`, err);
      }
    }
  }

  return {
    text: `🔍 Найдено участников: ${profiles.length}\n\n${resultText.join('\n\n')}`,
    menu: getSearchFilterMenu(conferenceCode),
  };
}

/**
 * Process text search results and send notifications
 */
async function processTextSearchResults({ profiles, searchText, conferenceCode, searcherTelegramId, getSearchFilterMenu }) {
  const { ensureUserFromTelegram } = require('./conference.service');
  const { UserProfile } = require('../models/userProfile');
  const { getConferenceIdByCode } = require('../lib/conference-helper');
  const { getBot } = require('../telegram/bot');

  const searcher = await ensureUserFromTelegram({ id: searcherTelegramId });
  const conferenceId = await getConferenceIdByCode(conferenceCode);
  const searcherProfile = await UserProfile.findOne({
    telegramId: searcher.telegramId,
    conference: conferenceId,
    isActive: true,
  });

  const resultText = [];
  const profilesWithoutUsername = [];

  for (const p of profiles) {
    const roles = p.roles && p.roles.length > 0 ? ` (${p.roles.join(', ')})` : '';
    const interests = p.interests && p.interests.length > 0 ? `\n  Интересы: ${p.interests.join(', ')}` : '';
    const username = p.user?.username ? `\n  @${p.user.username}` : '';
    resultText.push(`${resultText.length + 1}. ${p.firstName || ''} ${p.lastName || ''}${username}${roles}${interests}`);
    
    if (!p.user?.username && p.telegramId !== searcher.telegramId) {
      profilesWithoutUsername.push(p);
    }
  }

  // Send notifications to users without username
  if (profilesWithoutUsername.length > 0 && searcherProfile) {
    const bot = getBot();
    const searcherName = `${searcherProfile.firstName || ''} ${searcherProfile.lastName || ''}`.trim() || 'Участник';
    const searcherUsername = searcherProfile.username ? `@${searcherProfile.username}` : null;
    
    for (const profile of profilesWithoutUsername) {
      try {
        const notificationText = `👋 ${searcherName}${searcherUsername ? ` (${searcherUsername})` : ''} ищет участников в конференции и хотел бы с вами связаться.\n\n` +
          `💡 Добавьте username в свой профиль Telegram, чтобы другие участники могли с вами связаться напрямую.`;
        await bot.telegram.sendMessage(profile.telegramId, notificationText);
      } catch (err) {
        console.error(`Error sending notification to ${profile.telegramId}:`, err);
      }
    }
  }

  return {
    text: `🔍 Найдено участников по запросу "${searchText}": ${profiles.length}\n\n${resultText.join('\n\n')}`,
    menu: getSearchFilterMenu(conferenceCode),
  };
}

/**
 * Process onboarding step
 */
async function processOnboardingStep({ step, text, onboardingData, telegramUser }) {
  const { validate, userProfileSchema } = require('../lib/validation');
  const { listConferencesForUser } = require('./conference.service');
  const { getConferenceSelectionMenu, getMainMenu } = require('../telegram/menus');
  const { Markup } = require('telegraf');

  const result = {
    nextStep: step,
    data: { ...onboardingData },
    response: null,
    shouldContinue: true,
  };

  if (step === 1) {
    const parts = text.trim().split(/\s+/);
    if (parts.length < 1) {
      result.response = 'Пожалуйста, введите хотя бы имя.';
      result.shouldContinue = false;
      return result;
    }
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || '';

    if (lastName) {
      validate({ firstName, lastName }, userProfileSchema);
    } else {
      validate({ firstName }, userProfileSchema);
    }

    result.data.firstName = firstName;
    result.data.lastName = lastName;
    result.nextStep = 2;
    result.response = '✅ Отлично!\n\n' +
      'Шаг 2/5: Напиши свои интересы через запятую (например: AI, Web3, Product).\n' +
      '💡 Это поможет другим участникам найти тебя по интересам.\n' +
      'Если не хочешь указывать — напиши "-".';
    return result;
  }

  if (step === 2) {
    let interests = [];
    if (text.trim() !== '-' && text.trim() !== '') {
      interests = text.split(',').map((s) => s.trim()).filter(Boolean);
    }

    if (interests.length) {
      try {
        validate({ interests }, userProfileSchema);
        result.data.interests = interests;
      } catch (validationErr) {
        const errorMsg = validationErr.message?.replace('VALIDATION_ERROR: ', '') || 'Ошибка валидации интересов';
        result.response = `❌ ${errorMsg}\n\nПопробуй ещё раз или отправь "-" чтобы пропустить.`;
        result.shouldContinue = false;
        return result;
      }
    }

    result.nextStep = 3;
    result.response = '✅ Отлично!\n\n' +
      'Шаг 3/5: Что ты предлагаешь другим участникам? Напиши 1–3 пункта через запятую.\n' +
      'Например: консалтинг по маркетингу, инвестиции, партнёрства.\n' +
      '💡 Это поможет людям понять, чем ты можешь быть полезен.\n' +
      'Если хочешь пропустить — напиши "-".';
    return result;
  }

  if (step === 3) {
    let offerings = [];
    if (text.trim() !== '-' && text.trim() !== '') {
      offerings = text.split(',').map((s) => s.trim()).filter(Boolean);
    }

    if (offerings.length) {
      try {
        validate({ offerings }, userProfileSchema);
        result.data.offerings = offerings;
      } catch (validationErr) {
        const errorMsg = validationErr.message?.replace('VALIDATION_ERROR: ', '') || 'Ошибка валидации предложений';
        result.response = `❌ ${errorMsg}\n\nПопробуй ещё раз или отправь "-" чтобы пропустить.`;
        result.shouldContinue = false;
        return result;
      }
    }

    result.nextStep = 4;
    result.response = '✅ Отлично!\n\n' +
      'Шаг 4/5: Что ты ищешь на конференции? Напиши 1–3 пункта через запятую.\n' +
      'Например: партнёры, ментор, инвестор.\n' +
      '💡 Это поможет найти людей, которые могут помочь тебе.\n' +
      'Если хочешь пропустить — напиши "-".';
    return result;
  }

  if (step === 4) {
    let lookingFor = [];
    if (text.trim() !== '-' && text.trim() !== '') {
      lookingFor = text.split(',').map((s) => s.trim()).filter(Boolean);
    }

    if (lookingFor.length) {
      try {
        validate({ lookingFor }, userProfileSchema);
        result.data.lookingFor = lookingFor;
      } catch (validationErr) {
        const errorMsg = validationErr.message?.replace('VALIDATION_ERROR: ', '') || 'Ошибка валидации пунктов поиска';
        result.response = `❌ ${errorMsg}\n\nПопробуй ещё раз или отправь "-" чтобы пропустить.`;
        result.shouldContinue = false;
        return result;
      }
    }

    result.nextStep = 5;
    result.response = {
      text: '✅ Отлично!\n\n' +
        'Шаг 5/5: Выбери свою роль на конференции.\n' +
        '💡 Это поможет другим участникам найти тебя по роли.\n' +
        '⚠️ Роль "Спикер" назначается только администратором конференции.\n\n' +
        'Выбери роль:',
      menu: Markup.inlineKeyboard([
        [{ text: '💰 Инвестор', callback_data: 'onboarding:role:investor' }],
        [{ text: '👤 Участник', callback_data: 'onboarding:role:participant' }],
        [{ text: '📋 Организатор', callback_data: 'onboarding:role:organizer' }],
        [{ text: '⏭️ Пропустить', callback_data: 'onboarding:role:skip' }],
      ]),
    };
    return result;
  }

  // Step 5 (role selection) is the final step now
  // Profile is saved to global profile, not conference-specific
  // When user joins a conference, profile data will be copied automatically
  return result;
}

module.exports = {
  formatErrorMessage,
  getMenuForUser,
  handleHandlerError,
  formatConferenceDetails,
  formatConferencesList,
  formatConferencesListWithButtons,
  formatPollsList,
  formatQuestionsList,
  getConferenceCodeFromPoll,
  processSearchFilterResults,
  processOnboardingStep,
  processTextSearchResults,
};

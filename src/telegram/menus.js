const { Markup } = require('telegraf');
const { ensureUserFromTelegram, userIsMainAdmin } = require('../services/conference.service');
const { UserProfile } = require('../models/userProfile');
const { Conference } = require('../models/conference');

/**
 * Generate second screen URL for a conference
 */
function getSecondScreenUrl(conferenceCode) {
  const baseUrl = process.env.BASE_URL || process.env.SERVER_URL || 'http://localhost:3000';
  const apiKey = process.env.SECOND_SCREEN_API_KEY;
  if (!apiKey) {
    return null; // Can't generate URL without API key
  }
  return `${baseUrl}/second-screen/${conferenceCode}?key=${encodeURIComponent(apiKey)}`;
}

/**
 * Get user's effective roles (global + per-conference)
 */
async function getUserRoles(telegramUser) {
  const user = await ensureUserFromTelegram(telegramUser);
  const isMainAdmin = userIsMainAdmin(user);
  const isConferenceAdmin = user.globalRole === 'conference_admin' || user.globalRole === 'main_admin';

  // Check if user has speaker role in any active conference
  const profiles = await UserProfile.find({
    telegramId: user.telegramId,
    isActive: true,
  }).populate('conference');

  const activeConferences = profiles
    .map((p) => p.conference)
    .filter((c) => c && !c.isEnded);

  const hasSpeakerRole = profiles.some((p) => p.roles && p.roles.includes('speaker'));

  // Check conference admin status per conference
  const conferenceAdminFor = [];
  for (const profile of profiles) {
    if (profile.conference && !profile.conference.isEnded) {
      const conf = await Conference.findById(profile.conference._id || profile.conference);
      if (conf && conf.admins.some((id) => id.toString() === profile._id.toString())) {
        conferenceAdminFor.push(conf.conferenceCode);
      }
    }
  }

  return {
    isMainAdmin,
    isConferenceAdmin,
    hasSpeakerRole,
    conferenceAdminFor,
    activeConferences: activeConferences.map((c) => ({
      code: c.conferenceCode,
      title: c.title,
    })),
  };
}

/**
 * Main menu based on user roles
 */
async function getMainMenu(telegramUser) {
  const roles = await getUserRoles(telegramUser);
  const buttons = [];

  // User menu (always available)
  buttons.push([Markup.button.callback('📋 Мои конференции', 'menu:my_conferences')]);
  buttons.push([Markup.button.callback('➕ Присоединиться к конференции', 'menu:join_conference')]);
  buttons.push([Markup.button.callback('👤 Заполнить профиль', 'menu:onboarding')]);
  buttons.push([Markup.button.callback('🔍 Найти участников', 'menu:find_participants')]);
  buttons.push([Markup.button.callback('❓ Задать вопрос', 'menu:ask_question')]);
  buttons.push([Markup.button.callback('📊 Опросы', 'menu:polls')]);

  // Speaker menu
  if (roles.hasSpeakerRole) {
    buttons.push([Markup.button.callback('🎤 Меню спикера', 'menu:speaker')]);
  }

  // Conference Admin menu
  if (roles.isConferenceAdmin || roles.conferenceAdminFor.length > 0) {
    buttons.push([Markup.button.callback('⚙️ Меню администратора', 'menu:conference_admin')]);
  }

  // Main Admin menu
  if (roles.isMainAdmin) {
    buttons.push([Markup.button.callback('👑 Меню главного админа', 'menu:main_admin')]);
  }

  return Markup.inlineKeyboard(buttons);
}

/**
 * User menu
 */
function getUserMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📋 Мои конференции', 'menu:my_conferences')],
    [Markup.button.callback('➕ Присоединиться', 'menu:join_conference')],
    [Markup.button.callback('👤 Заполнить профиль', 'menu:onboarding')],
    [Markup.button.callback('🔍 Найти участников', 'menu:find_participants')],
    [Markup.button.callback('❓ Задать вопрос', 'menu:ask_question')],
    [Markup.button.callback('📊 Опросы', 'menu:polls')],
    [Markup.button.callback('◀️ Главное меню', 'menu:main')],
  ]);
}

/**
 * Speaker menu
 */
function getSpeakerMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('❓ Вопросы для ответа', 'menu:speaker_questions')],
    [Markup.button.callback('📊 Управление опросами', 'menu:speaker_polls')],
    [Markup.button.callback('📋 Мои конференции', 'menu:my_conferences')],
    [Markup.button.callback('◀️ Главное меню', 'menu:main')],
  ]);
}

/**
 * Conference Admin menu
 */
function getConferenceAdminMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📋 Управление конференциями', 'menu:admin_conferences')],
    [Markup.button.callback('👥 Участники', 'menu:admin_participants')],
    [Markup.button.callback('❓ Модерация вопросов', 'menu:admin_moderate_questions')],
    [Markup.button.callback('📊 Управление опросами', 'menu:admin_polls')],
    [Markup.button.callback('🖼️ Управление слайдами', 'menu:admin_slides')],
    [Markup.button.callback('◀️ Главное меню', 'menu:main')],
  ]);
}

/**
 * Main Admin menu
 */
function getMainAdminMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📋 Все конференции', 'menu:admin_all_conferences')],
    [Markup.button.callback('➕ Создать конференцию', 'menu:admin_create_conference')],
    [Markup.button.callback('👥 Управление админами', 'menu:admin_manage_admins')],
    [Markup.button.callback('📊 Статистика системы', 'menu:admin_stats')],
    [Markup.button.callback('◀️ Главное меню', 'menu:main')],
  ]);
}

/**
 * Conference selection menu
 */
function getConferenceSelectionMenu(conferences, actionPrefix) {
  const buttons = conferences
    .filter((conf) => conf && conf.conferenceCode) // Filter out invalid conferences
    .map((conf) => {
      const row = [Markup.button.callback(`${conf.title} (${conf.conferenceCode})`, `${actionPrefix}:${conf.conferenceCode}`)];
      // Add second screen button next to conference name if URL can be generated
      const secondScreenUrl = getSecondScreenUrl(conf.conferenceCode);
      if (secondScreenUrl) {
        row.push(Markup.button.url('📺', secondScreenUrl));
      }
      return row;
    });
  buttons.push([Markup.button.callback('◀️ Назад', 'menu:main')]);
  return Markup.inlineKeyboard(buttons);
}

/**
 * Yes/No confirmation menu
 */
function getConfirmationMenu(actionPrefix, data) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Да', `${actionPrefix}:yes:${data}`), Markup.button.callback('❌ Нет', `${actionPrefix}:no`)],
    [Markup.button.callback('◀️ Назад', 'menu:main')],
  ]);
}

/**
 * Question moderation menu (for a specific question)
 */
function getQuestionModerationMenu(questionId, conferenceCode) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Одобрить', `moderate:approve:${conferenceCode}:${questionId}`),
      Markup.button.callback('❌ Отклонить', `moderate:reject:${conferenceCode}:${questionId}`),
    ],
    [Markup.button.callback('◀️ Назад', 'menu:admin_moderate_questions')],
  ]);
}

/**
 * Poll options menu for voting
 */
function getPollVoteMenu(pollId, options) {
  const buttons = options.map((opt, idx) => [
    Markup.button.callback(`${opt.text}`, `vote:poll:${pollId}:${opt.id}`),
  ]);
  buttons.push([Markup.button.callback('◀️ Назад', 'menu:polls')]);
  return Markup.inlineKeyboard(buttons);
}

/**
 * Reply keyboard (persistent buttons at bottom of chat)
 */
function getReplyKeyboard() {
  return Markup.keyboard([
    ['📋 Мои конференции', '➕ Присоединиться'],
    ['👤 Профиль', '🔍 Найти участников'],
    ['❓ Задать вопрос', '📊 Опросы'],
  ])
    .resize()
    .persistent();
}

/**
 * Remove reply keyboard
 */
function removeReplyKeyboard() {
  return Markup.removeKeyboard();
}

/**
 * Conference management menu (for conference admins)
 */
function getConferenceManagementMenu(conferenceCode) {
  const buttons = [
    [
      Markup.button.callback('✏️ Редактировать', `admin:edit_conf:${conferenceCode}`),
      Markup.button.callback('▶️ Запустить', `admin:start_conf:${conferenceCode}`)
    ],
    [
      Markup.button.callback('⏸️ Остановить', `admin:stop_conf:${conferenceCode}`),
      Markup.button.callback('✅ Завершить', `admin:end_conf:${conferenceCode}`)
    ],
    [Markup.button.callback('🗑️ Удалить', `admin:delete_conf:${conferenceCode}`)],
    [
      Markup.button.callback('❓ Модерация вопросов', `admin:moderate:${conferenceCode}`),
      Markup.button.callback('📊 Опросы', `admin:polls:${conferenceCode}`)
    ],
    [
      Markup.button.callback('🖼️ Слайды', `admin:slides:${conferenceCode}`),
      Markup.button.callback('👥 Участники', `admin:participants:${conferenceCode}`)
    ],
  ];

  // Add second screen button if URL can be generated
  const secondScreenUrl = getSecondScreenUrl(conferenceCode);
  if (secondScreenUrl) {
    buttons.push([Markup.button.url('📺 Открыть второй экран', secondScreenUrl)]);
  }

  buttons.push([Markup.button.callback('◀️ Назад', 'menu:conference_admin')]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * Speaker selection menu
 */
function getSpeakerSelectionMenu(speakers, actionPrefix) {
  const buttons = speakers.map((speaker) => [
    Markup.button.callback(
      `${speaker.firstName} ${speaker.lastName || ''}`.trim(),
      `${actionPrefix}:${speaker._id}`
    ),
  ]);
  buttons.push([Markup.button.callback('Для всех спикеров', `${actionPrefix}:all`)]);
  buttons.push([Markup.button.callback('◀️ Назад', 'menu:ask_question')]);
  return Markup.inlineKeyboard(buttons);
}

/**
 * Question list menu for speaker
 */
function getQuestionListMenu(questions, actionPrefix) {
  const buttons = questions.slice(0, 10).map((q, idx) => [
    Markup.button.callback(
      `❓ ${q.text.substring(0, 40)}${q.text.length > 40 ? '...' : ''}`,
      `${actionPrefix}:${q._id}`
    ),
  ]);
  if (questions.length === 0) {
    buttons.push([Markup.button.callback('Нет вопросов', 'menu:speaker')]);
  }
  buttons.push([Markup.button.callback('◀️ Назад', 'menu:speaker')]);
  return Markup.inlineKeyboard(buttons);
}

/**
 * Poll management menu (for speaker/admin)
 */
function getPollManagementMenu(pollId, conferenceCode) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✏️ Редактировать', `poll:edit:${pollId}`)],
    [Markup.button.callback('⏸️ Деактивировать', `poll:deactivate:${pollId}`)],
    [Markup.button.callback('🗑️ Удалить', `poll:delete:${pollId}:${conferenceCode}`)],
    [Markup.button.callback('◀️ Назад', `admin:polls:${conferenceCode}`)],
  ]);
}

/**
 * Participant selection menu (for assigning speakers)
 */
function getParticipantSelectionMenu(participants, actionPrefix) {
  const buttons = participants.slice(0, 20).map((p) => [
    Markup.button.callback(
      `${p.firstName} ${p.lastName || ''}${p.roles && p.roles.includes('speaker') ? ' 🎤' : ''}`.trim(),
      `${actionPrefix}:${p._id}`
    ),
  ]);
  buttons.push([Markup.button.callback('◀️ Назад', 'menu:conference_admin')]);
  return Markup.inlineKeyboard(buttons);
}

/**
 * Search filter menu (for filtering participants by role)
 */
function getSearchFilterMenu(conferenceCode) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('👥 Все участники', `search:filter:${conferenceCode}:all`)],
    [Markup.button.callback('🎤 Спикеры', `search:filter:${conferenceCode}:speaker`)],
    [Markup.button.callback('💰 Инвесторы', `search:filter:${conferenceCode}:investor`)],
    [Markup.button.callback('👤 Участники', `search:filter:${conferenceCode}:participant`)],
    [Markup.button.callback('📋 Организаторы', `search:filter:${conferenceCode}:organizer`)],
    [Markup.button.callback('🔍 Поиск по тексту', `search:text:${conferenceCode}`)],
    [Markup.button.callback('◀️ Назад', 'menu:find_participants')],
  ]);
}

/**
 * Notification menu for question moderation (shown in admin notifications)
 */
function getQuestionNotificationMenu(conferenceCode) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Перейти к модерации', `moderate:conf:${conferenceCode}`)],
  ]);
}

/**
 * Notification menu for poll voting (shown in user notifications)
 */
function getPollNotificationMenu(conferenceCode, pollId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📊 Проголосовать', `polls:vote:${conferenceCode}:${pollId}`)],
  ]);
}

module.exports = {
  getUserRoles,
  getMainMenu,
  getUserMenu,
  getSpeakerMenu,
  getConferenceAdminMenu,
  getMainAdminMenu,
  getConferenceSelectionMenu,
  getConfirmationMenu,
  getQuestionModerationMenu,
  getPollVoteMenu,
  getReplyKeyboard,
  removeReplyKeyboard,
  getConferenceManagementMenu,
  getSpeakerSelectionMenu,
  getQuestionListMenu,
  getPollManagementMenu,
  getParticipantSelectionMenu,
  getSearchFilterMenu,
  getQuestionNotificationMenu,
  getPollNotificationMenu,
  getSecondScreenUrl,
};


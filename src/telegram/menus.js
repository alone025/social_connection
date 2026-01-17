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
 * Generate organizer dashboard URL for a conference (reports only)
 */
function getOrganizerDashboardUrl(conferenceCode, telegramId) {
  const baseUrl = process.env.BASE_URL || process.env.SERVER_URL || 'http://localhost:3000';
  const apiKey = process.env.SECOND_SCREEN_API_KEY;
  if (!apiKey || !telegramId) {
    return null; // Can't generate URL without API key or telegram ID
  }
  return `${baseUrl}/organizer-dashboard/${conferenceCode}?key=${encodeURIComponent(apiKey)}&telegramId=${telegramId}`;
}

/**
 * Generate organizer admin panel URL for a conference (management interface)
 */
function getOrganizerAdminUrl(conferenceCode, telegramId) {
  const baseUrl = process.env.BASE_URL || process.env.SERVER_URL || 'http://localhost:3000';
  const apiKey = process.env.SECOND_SCREEN_API_KEY;
  if (!apiKey || !telegramId) {
    return null; // Can't generate URL without API key or telegram ID
  }
  return `${baseUrl}/organizer-admin/${conferenceCode}?key=${encodeURIComponent(apiKey)}&telegramId=${telegramId}`;
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
  buttons.push([Markup.button.callback('👁️ Мой профиль', 'menu:view_profile')]);
  buttons.push([Markup.button.callback('🔍 Найти участников', 'menu:find_participants')]);
  buttons.push([Markup.button.callback('🤝 Встречи 1:1', 'menu:meetings')]);
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
    [Markup.button.callback('👁️ Мой профиль', 'menu:view_profile')],
    [Markup.button.callback('🔍 Найти участников', 'menu:find_participants')],
    [Markup.button.callback('🤝 Встречи 1:1', 'menu:meetings')],
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
    [Markup.button.callback('🌐 Админ-панель (веб)', 'menu:admin_dashboard')],
    [Markup.button.callback('👥 Участники', 'menu:admin_participants')],
    [Markup.button.callback('❓ Модерация вопросов', 'menu:admin_moderate_questions')],
    [Markup.button.callback('📊 Управление опросами', 'menu:admin_polls')],
    [Markup.button.callback('🖼️ Управление слайдами', 'menu:admin_slides')],
    [Markup.button.callback('📊 Отчёт организатора', 'menu:admin_report')],
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
    [Markup.button.callback('📊 Отчёт организатора', `report:conf:${conferenceCode}`)],
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

/**
 * Meeting management menu
 */
function getMeetingMenu(conferenceCode) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Запросить встречу', `meeting:request:${conferenceCode}`)],
    [Markup.button.callback('📋 Мои встречи', `meeting:list:${conferenceCode}`)],
    [Markup.button.callback('⏰ Доступные слоты', `meeting:slots:${conferenceCode}`)],
    [Markup.button.callback('◀️ Назад', 'menu:main')],
  ]);
}

/**
 * Meeting list menu
 */
function getMeetingListMenu(meetings, conferenceCode, userTelegramId) {
  const buttons = meetings.slice(0, 10).map((m) => {
    const isRequester = m.requester.telegramId === userTelegramId;
    const otherPerson = isRequester 
      ? `${m.recipient.firstName} ${m.recipient.lastName || ''}`.trim()
      : `${m.requester.firstName} ${m.requester.lastName || ''}`.trim();
    const statusEmoji = {
      pending: '⏳',
      accepted: '✅',
      rejected: '❌',
      cancelled: '🚫',
      completed: '✅',
    }[m.status] || '❓';
    return [Markup.button.callback(
      `${statusEmoji} ${otherPerson} - ${new Date(m.proposedTime).toLocaleString('ru-RU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      `meeting:details:${m._id}:${conferenceCode}`
    )];
  });
  buttons.push([Markup.button.callback('◀️ Назад', `meeting:menu:${conferenceCode}`)]);
  return Markup.inlineKeyboard(buttons);
}

/**
 * Meeting details menu
 */
function getMeetingDetailsMenu(meeting, conferenceCode, userTelegramId, chatUrl = null) {
  const buttons = [];
  const now = new Date();
  const meetingTime = new Date(meeting.proposedTime);
  const meetingEndTime = new Date(meetingTime.getTime() + meeting.durationMinutes * 60 * 1000);

  if (meeting.status === 'pending') {
    const isRecipient = meeting.recipient.telegramId === userTelegramId;
    if (isRecipient) {
      // User is recipient
      buttons.push([Markup.button.callback('✅ Принять', `meeting:accept:${meeting._id}`)]);
      buttons.push([Markup.button.callback('❌ Отклонить', `meeting:reject:${meeting._id}`)]);
    }
    buttons.push([Markup.button.callback('🚫 Отменить', `meeting:cancel:${meeting._id}`)]);
  } else if (meeting.status === 'accepted') {
    // Show chat button if meeting is active (now is between meeting start and end)
    if (chatUrl && now >= meetingTime && now < meetingEndTime) {
      buttons.push([Markup.button.url('💬 Открыть чат', chatUrl)]);
    }
    if (now >= meetingTime && now < meetingEndTime) {
      buttons.push([Markup.button.callback('✅ Отметить как завершённую', `meeting:complete:${meeting._id}:${conferenceCode}`)]);
    } else if (now < meetingTime) {
      buttons.push([Markup.button.callback('🚫 Отменить', `meeting:cancel:${meeting._id}`)]);
    }
  }
  buttons.push([Markup.button.callback('◀️ Назад', `meeting:list:${conferenceCode}`)]);
  return Markup.inlineKeyboard(buttons);
}

/**
 * Participant selection menu for meeting request
 */
function getMeetingParticipantMenu(participants, conferenceCode) {
  const buttons = participants.slice(0, 20).map((p) => {
    // Use only profile ID to keep callback_data under 64 bytes limit
    // Format: meeting:select:PROFILE_ID (conferenceCode will be retrieved from profile)
    // ObjectId is 24 chars, "meeting:select:" is 15 chars = 39 total (well under 64 bytes)
    const profileId = p._id.toString();
    const callbackData = `meeting:select:${profileId}`;
    
    // Use profile name (from onboarding) instead of Telegram name
    const profileName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Участник';
    const rolesText = p.roles && p.roles.length > 0 ? ` (${p.roles.join(', ')})` : '';
    
    return [
      Markup.button.callback(
        `${profileName}${rolesText}`,
        callbackData
      ),
    ];
  });
  buttons.push([Markup.button.callback('◀️ Назад', `meeting:menu:${conferenceCode}`)]);
  return Markup.inlineKeyboard(buttons);
}

/**
 * Meeting date selection menu with quick options
 */
function getMeetingDateMenu(conferenceCode) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const formatDate = (date) => {
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  
  return Markup.inlineKeyboard([
    [{ text: `📅 Сегодня (${formatDate(today)})`, callback_data: `meeting:date:${conferenceCode}:today` }],
    [{ text: `📅 Завтра (${formatDate(tomorrow)})`, callback_data: `meeting:date:${conferenceCode}:tomorrow` }],
    [{ text: `📅 Через неделю (${formatDate(nextWeek)})`, callback_data: `meeting:date:${conferenceCode}:nextweek` }],
    [{ text: '📝 Ввести дату вручную', callback_data: `meeting:date:${conferenceCode}:manual` }],
    [{ text: '◀️ Отмена', callback_data: `meeting:request:${conferenceCode}` }],
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
  getOrganizerDashboardUrl,
  getOrganizerAdminUrl,
  getMeetingMenu,
  getMeetingListMenu,
  getMeetingDetailsMenu,
  getMeetingParticipantMenu,
  getMeetingDateMenu,
};


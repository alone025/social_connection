const { Telegraf, Markup } = require('telegraf');
const {
  ensureUserFromTelegram,
  userIsMainAdmin,
  createConference,
  joinConference,
  listConferencesForUser,
  endConference,
  assignConferenceAdmin,
  revokeConferenceAdmin,
  updateConference,
  startConference,
  stopConference,
  deleteConference,
  assignSpeaker,
  removeSpeaker,
} = require('../services/conference.service');
const {
  askQuestion,
  listQuestionsForModeration,
  approveQuestion,
  rejectQuestion,
  answerQuestion,
  listQuestionsForSpeaker,
  listSpeakers,
} = require('../services/question.service');
const { setSlide, clearSlide } = require('../services/slide.service');
const {
  createPoll,
  voteInPoll,
  getPollsForConference,
  deactivatePoll,
  updatePoll,
  deletePoll,
  listPollsForManagement,
} = require('../services/poll.service');
const { validate, userProfileSchema } = require('../lib/validation');
const { upsertProfileForConference } = require('../services/profile.service');
const { searchProfiles } = require('../services/matching.service');
const {
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
  getMeetingMenu,
  getMeetingListMenu,
  getMeetingDetailsMenu,
  getMeetingParticipantMenu,
  getMeetingDateMenu,
} = require('./menus');

// In-memory state for various flows (conference selection, question input, etc.)
const userState = new Map();

/**
 * Clear all state for a user
 */
async function clearUserState(telegramId) {
  userState.delete(telegramId);
  // Clear onboarding state from database
  const { clearOnboardingState } = require('../services/onboarding.service');
  try {
    await clearOnboardingState(telegramId);
  } catch (err) {
    // Ignore errors if state doesn't exist
    if (err.message !== 'ONBOARDING_STATE_NOT_FOUND') {
      console.error('Error clearing onboarding state:', err);
    }
  }
}

let botInstance;

function getBotInstance() {
  return botInstance;
}

/**
 * Safely edit message text, ignoring "message is not modified" errors
 */
async function safeEditMessageText(ctx, text, extra = {}) {
  try {
    return await ctx.editMessageText(text, extra);
  } catch (err) {
    // Ignore "message is not modified" error - this happens when clicking the same menu item twice
    if (err.response && err.response.description && err.response.description.includes('message is not modified')) {
      return; // Silently ignore - message is already up to date
    }
    throw err; // Re-throw other errors
  }
}

function initBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN is not set, Telegram bot will not start');
    return;
  }

  const bot = new Telegraf(token);
  botInstance = bot;

  // ========== START COMMAND ==========
  bot.start(async (ctx) => {
    // Clear any existing state when user starts
    await clearUserState(ctx.from.id);
    
    const user = await ensureUserFromTelegram(ctx.from);
    const roles = await getUserRoles(ctx.from);

    let welcomeText = '👋 Добро пожаловать в конференционный нетворкинг-бот!\n\n';
    
    if (roles.isMainAdmin) {
      welcomeText += '👑 Вы главный администратор системы\n';
    }
    if (roles.isConferenceAdmin || roles.conferenceAdminFor.length > 0) {
      welcomeText += '⚙️ Вы администратор конференций\n';
    }
    if (roles.hasSpeakerRole) {
      welcomeText += '🎤 Вы спикер\n';
    }

    welcomeText += '\nВыберите действие:';

    await ctx.reply(welcomeText, await getMainMenu(ctx.from));
    await ctx.reply('Используйте кнопки ниже для быстрого доступа:', getReplyKeyboard());
  });

  // ========== CANCEL COMMAND ==========
  bot.command('cancel', async (ctx) => {
    await clearUserState(ctx.from.id);
    await ctx.reply('✅ Текущее действие отменено.', await getMainMenu(ctx.from));
  });

  // ========== CALLBACK QUERY HANDLERS (BUTTONS) ==========
  
  // Main menu
  bot.action('menu:main', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear state when returning to main menu
    let text = '🏠 Главное меню\n\nВыберите действие:';
    try {
      await ctx.editMessageText(text, await getMainMenu(ctx.from));
    } catch (err) {
      // Handle "message is not modified" error - this is not critical
      if (err.response && err.response.error_code === 400 && 
          err.response.description && err.response.description.includes('message is not modified')) {
        // Message is already up to date, just answer the callback query (already done above)
        return;
      }
      throw err; // Re-throw if it's a different error
    }
  });

  // User menu
  bot.action('menu:my_conferences', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id);
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      const conferences = await listConferencesForUser(user);

      if (!conferences.length) {
        return ctx.editMessageText(
          '📋 У вас пока нет доступных конференций.\n\nИспользуйте кнопку "➕ Присоединиться к конференции" для участия.',
          getUserMenu()
        );
      }

      const { formatConferencesListWithButtons } = require('../services/handler.service');
      const formatted = await formatConferencesListWithButtons(conferences, getSecondScreenUrl);
      await ctx.editMessageText(formatted.text, formatted.buttons);
    } catch (err) {
      const { handleHandlerError } = require('../services/handler.service');
      await handleHandlerError(ctx, err, getUserMenu());
    }
  });

  bot.action('menu:join_conference', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear ALL previous state (both userState and onboardingState)
    userState.set(ctx.from.id, { flow: 'join_conference' });
    await ctx.editMessageText(
      '➕ Присоединение к конференции\n\nВведите код конференции:',
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'menu:main' }]] } }
    );
  });

  bot.action('menu:view_profile', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id);
    try {
      const { getGlobalProfile } = require('../services/profile.service');
      const globalProfile = await getGlobalProfile(ctx.from.id);
      
      if (!globalProfile || !globalProfile.onboardingCompleted) {
        return ctx.editMessageText(
          '👤 Мой профиль\n\n❌ Профиль ещё не заполнен.\n\nИспользуйте кнопку "👤 Заполнить профиль" для создания профиля.',
          await getMainMenu(ctx.from)
        );
      }

      const lines = [
        '👤 МОЙ ПРОФИЛЬ\n',
        `👤 Имя: ${globalProfile.firstName || ''} ${globalProfile.lastName || ''}`.trim() || 'Не указано',
        globalProfile.username ? `📱 Username: @${globalProfile.username}` : '',
        '',
        globalProfile.interests && globalProfile.interests.length > 0
          ? `🎯 Интересы: ${globalProfile.interests.join(', ')}`
          : '🎯 Интересы: Не указано',
        '',
        globalProfile.offerings && globalProfile.offerings.length > 0
          ? `💼 Предлагаю: ${globalProfile.offerings.join(', ')}`
          : '💼 Предлагаю: Не указано',
        '',
        globalProfile.lookingFor && globalProfile.lookingFor.length > 0
          ? `🔍 Ищу: ${globalProfile.lookingFor.join(', ')}`
          : '🔍 Ищу: Не указано',
        '',
        globalProfile.roles && globalProfile.roles.length > 0
          ? `👥 Роли: ${globalProfile.roles.map(r => {
              const roleNames = { investor: '💰 Инвестор', participant: '👤 Участник', organizer: '📋 Организатор', speaker: '🎤 Спикер' };
              return roleNames[r] || r;
            }).join(', ')}`
          : '👥 Роли: Не указано',
      ];

      await ctx.editMessageText(
        lines.filter(Boolean).join('\n'),
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'menu:main' }]] } }
      );
    } catch (err) {
      console.error('Error in menu:view_profile', err);
      await ctx.editMessageText('❌ Ошибка при загрузке профиля.', await getMainMenu(ctx.from));
    }
  });

  bot.action('menu:onboarding', async (ctx) => {
    await ctx.answerCbQuery();
    userState.delete(ctx.from.id); // Clear userState only
    const { getGlobalProfile } = require('../services/profile.service');
    const globalProfile = await getGlobalProfile(ctx.from.id);
    
    // If user has completed profile, show update menu with buttons
    if (globalProfile && globalProfile.onboardingCompleted) {
      await ctx.editMessageText(
        '✏️ Обновление профиля\n\nВыберите, что хотите обновить:',
        Markup.inlineKeyboard([
          [{ text: '👤 Имя и фамилия', callback_data: 'profile:update:name' }],
          [{ text: '🎯 Интересы', callback_data: 'profile:update:interests' }],
          [{ text: '💼 Что предлагаю', callback_data: 'profile:update:offerings' }],
          [{ text: '🔍 Что ищу', callback_data: 'profile:update:lookingFor' }],
          [{ text: '👥 Роли', callback_data: 'profile:update:roles' }],
          [{ text: '📋 Заполнить весь профиль заново', callback_data: 'profile:update:full' }],
          [{ text: '◀️ Назад', callback_data: 'menu:main' }],
        ])
      );
      return;
    }
    
    // New user - show onboarding flow
    const { getOnboardingState, createOnboardingState, updateOnboardingState } = require('../services/onboarding.service');
    let onboarding = await getOnboardingState(ctx.from.id);
    
    // Create new state if doesn't exist or if already completed
    if (!onboarding || onboarding.completedAt) {
      if (onboarding && onboarding.completedAt) {
        // Reset existing completed state
        await updateOnboardingState(ctx.from.id, { step: 1, data: {}, completedAt: null });
        onboarding = await getOnboardingState(ctx.from.id);
      } else {
        // Create new state
        onboarding = await createOnboardingState(ctx.from.id);
      }
    }
    
    // Continue from where user left off or start from step 1
    const stepMessages = {
      1: 'Шаг 1/5: Введите ваше имя и фамилию (например: Иван Иванов):',
      2: 'Шаг 2/5: Напиши свои интересы через запятую (например: AI, Web3, Product).\n💡 Это поможет другим участникам найти тебя по интересам.\nЕсли не хочешь указывать — напиши "-".',
      3: 'Шаг 3/5: Что ты предлагаешь другим участникам? Напиши 1–3 пункта через запятую.\nНапример: консалтинг по маркетингу, инвестиции, партнёрства.\n💡 Это поможет людям понять, чем ты можешь быть полезен.\nЕсли хочешь пропустить — напиши "-".',
      4: 'Шаг 4/5: Что ты ищешь на конференции? Напиши 1–3 пункта через запятую.\nНапример: партнёры, ментор, инвестор.\n💡 Это поможет найти людей, которые могут помочь тебе.\nЕсли хочешь пропустить — напиши "-".',
      5: 'Шаг 5/5: Выбери свою роль на конференции.\n💡 Это поможет другим участникам найти тебя по роли.\n⚠️ Роль "Спикер" назначается только администратором конференции.',
    };
    
    const message = stepMessages[onboarding.step] || stepMessages[1];
    const welcomeText = onboarding.step === 1 
      ? '👤 Заполнение профиля\n\n📋 Это займёт всего 2-3 минуты. Мы поможем тебе найти интересных людей на конференции!\n\n'
      : '👤 Заполнение профиля\n\n✅ Продолжаем с того места, где вы остановились.\n\n';
    
    await ctx.reply(
      welcomeText + message,
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'menu:main' }]] } }
    );
  });

  // Profile update handlers
  bot.action(/^profile:update:(name|interests|offerings|lookingFor|roles|full)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const field = ctx.match[1];
    const { getGlobalProfile, updateGlobalProfile } = require('../services/profile.service');
    const globalProfile = await getGlobalProfile(ctx.from.id);
    
    if (!globalProfile || !globalProfile.onboardingCompleted) {
      return ctx.editMessageText('❌ Профиль не заполнен. Используйте "Заполнить профиль".', await getMainMenu(ctx.from));
    }
    
    await clearUserState(ctx.from.id);
    
    if (field === 'full') {
      // Full profile update - start onboarding from beginning
      const { getOnboardingState, createOnboardingState, updateOnboardingState } = require('../services/onboarding.service');
      
      let onboarding = await getOnboardingState(ctx.from.id);
      if (!onboarding) {
        // No state yet - create new
        onboarding = await createOnboardingState(ctx.from.id);
      } else {
        // Reset existing state
        await updateOnboardingState(ctx.from.id, { step: 1, data: {}, completedAt: null });
      }
      
      await ctx.editMessageText(
        '👤 Заполнение профиля\n\n📋 Это займёт всего 2-3 минуты. Мы поможем тебе найти интересных людей на конференции!\n\n' +
        'Шаг 1/5: Введите ваше имя и фамилию (например: Иван Иванов):',
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'menu:main' }]] } }
      );
      return;
    }
    
    // Single field update
    const fieldMessages = {
      name: '✏️ Обновление имени\n\nВведите ваше имя и фамилию (например: Иван Иванов):',
      interests: '✏️ Обновление интересов\n\nНапиши свои интересы через запятую (например: AI, Web3, Product).\nЕсли не хочешь указывать — напиши "-".',
      offerings: '✏️ Обновление предложений\n\nЧто ты предлагаешь другим участникам? Напиши 1–3 пункта через запятую.\nНапример: консалтинг по маркетингу, инвестиции, партнёрства.\nЕсли хочешь пропустить — напиши "-".',
      lookingFor: '✏️ Обновление поиска\n\nЧто ты ищешь на конференции? Напиши 1–3 пункта через запятую.\nНапример: партнёры, ментор, инвестор.\nЕсли хочешь пропустить — напиши "-".',
      roles: '✏️ Обновление ролей\n\nВыбери свою роль на конференции:',
    };
    
    userState.set(ctx.from.id, { flow: 'update_profile', field });
    
    if (field === 'roles') {
      await ctx.editMessageText(
        fieldMessages[field],
        Markup.inlineKeyboard([
          [{ text: '💰 Инвестор', callback_data: 'profile:role:investor' }],
          [{ text: '👤 Участник', callback_data: 'profile:role:participant' }],
          [{ text: '📋 Организатор', callback_data: 'profile:role:organizer' }],
          [{ text: '⏭️ Пропустить', callback_data: 'profile:role:skip' }],
          [{ text: '◀️ Отмена', callback_data: 'menu:main' }],
        ])
      );
    } else {
      await ctx.editMessageText(
        fieldMessages[field],
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'menu:main' }]] } }
      );
    }
  });

  // Handle role selection for profile update
  bot.action(/^profile:role:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const role = ctx.match[1];
    const { getGlobalProfile, updateGlobalProfile } = require('../services/profile.service');
    const globalProfile = await getGlobalProfile(ctx.from.id);
    
    if (!globalProfile) {
      return ctx.editMessageText('❌ Профиль не найден.', await getMainMenu(ctx.from));
    }
    
    const updatedRoles = [...(globalProfile.roles || [])];
    if (role !== 'skip') {
      if (!updatedRoles.includes(role)) {
        updatedRoles.push(role);
      }
    }
    
    try {
      await updateGlobalProfile(ctx.from.id, { roles: updatedRoles });
      await clearUserState(ctx.from.id);
      await ctx.editMessageText(
        '✅ Роли обновлены!',
        await getMainMenu(ctx.from)
      );
    } catch (err) {
      console.error('Error updating profile roles', err);
      await ctx.editMessageText('❌ Ошибка при обновлении ролей.', await getMainMenu(ctx.from));
    }
  });

  // Onboarding role selection handler
  bot.action(/^onboarding:role:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const role = ctx.match[1];
    const { getOnboardingState, updateOnboardingState, clearOnboardingState } = require('../services/onboarding.service');
    const { upsertGlobalProfile } = require('../services/profile.service');
    const onboarding = await getOnboardingState(ctx.from.id);
    
    if (!onboarding || onboarding.step !== 5) {
      return ctx.reply('❌ Неверный шаг онбординга. Начните заново.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'menu:main' }]] } });
    }

    const updatedData = { ...onboarding.data };
    if (role !== 'skip') {
      if (!updatedData.roles) {
        updatedData.roles = [];
      }
      if (!updatedData.roles.includes(role)) {
        updatedData.roles.push(role);
      }
    }

    try {
      // Mark onboarding as completed first (before clearing)
      await updateOnboardingState(ctx.from.id, { completedAt: new Date() });
      
      // Save to global profile (this will clear onboarding state internally)
      await upsertGlobalProfile({
        telegramId: String(ctx.from.id),
        data: updatedData,
      });

      userState.delete(ctx.from.id);

      await ctx.editMessageText(
        '✅ Профиль заполнен!\n\n' +
        'Теперь тебе будет проще находить подходящих людей для нетворкинга.\n\n' +
        '💡 При присоединении к конференции твой профиль будет автоматически использован.',
        await getMainMenu(ctx.from)
      );
    } catch (err) {
      console.error('Error in onboarding:role', err);
      let errorMsg = '❌ Ошибка при сохранении профиля.';
      if (err.message === 'ONBOARDING_STATE_NOT_FOUND') {
        // State was already cleared, but profile might be saved - check and show success
        const { getGlobalProfile } = require('../services/profile.service');
        const globalProfile = await getGlobalProfile(ctx.from.id);
        if (globalProfile && globalProfile.onboardingCompleted) {
          // Profile was saved successfully, just state was already cleared
          userState.delete(ctx.from.id);
          await ctx.editMessageText(
            '✅ Профиль заполнен!\n\n' +
            'Теперь тебе будет проще находить подходящих людей для нетворкинга.\n\n' +
            '💡 При присоединении к конференции твой профиль будет автоматически использован.',
            await getMainMenu(ctx.from)
          );
          return;
        }
        errorMsg = '❌ Состояние онбординга не найдено. Начните заполнение профиля заново.';
      }
      await ctx.editMessageText(errorMsg, await getMainMenu(ctx.from));
      await clearUserState(ctx.from.id);
    }
  });

  bot.action(/^onboarding:select_conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    // This handler is kept for backward compatibility but is no longer used
    // Onboarding now saves to global profile, not conference-specific profile
    await ctx.answerCbQuery('Этот шаг больше не используется. Профиль теперь глобальный.');
  });

  bot.action('menu:find_participants', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear ALL previous state
    const user = await ensureUserFromTelegram(ctx.from);
    const conferences = await listConferencesForUser(user);
    
    if (!conferences.length) {
      return ctx.editMessageText(
        '❌ Сначала присоединитесь к конференции.',
        getUserMenu()
      );
    }

    userState.set(ctx.from.id, { flow: 'find_participants', step: 'select_conference' });
    await ctx.editMessageText(
      '🔍 Поиск участников\n\nВыберите конференцию:',
      getConferenceSelectionMenu(conferences, 'find:conf')
    );
  });

  bot.action(/^find:conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    await clearUserState(ctx.from.id);
    // Show filter menu instead of asking for text input
    await ctx.editMessageText(
      `🔍 Поиск участников в конференции\n\nВыберите фильтр:`,
      getSearchFilterMenu(conferenceCode)
    );
  });

  // Search filter handlers
  bot.action(/^search:filter:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    const role = ctx.match[2] === 'all' ? null : ctx.match[2];
    
    try {
      const { profiles } = await searchProfiles({
        conferenceCode,
        role,
        text: null,
        limit: 20,
      });

      await clearUserState(ctx.from.id);

      if (!profiles.length) {
        return ctx.editMessageText(
          `❌ Участники не найдены.\n\nФильтр: ${role ? role : 'Все участники'}`,
          getSearchFilterMenu(conferenceCode)
        );
      }

      const { processSearchFilterResults } = require('../services/handler.service');
      const result = await processSearchFilterResults({
        profiles,
        conferenceCode,
        searcherTelegramId: ctx.from.id,
        getSearchFilterMenu,
      });

      await ctx.editMessageText(
        `🔍 Найдено участников: ${profiles.length}\n\nФильтр: ${role ? role : 'Все участники'}\n\n${result.text}`,
        result.menu
      );
    } catch (err) {
      const { handleHandlerError } = require('../services/handler.service');
      await handleHandlerError(ctx, err, getSearchFilterMenu(conferenceCode));
    }
  });

  bot.action(/^search:text:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    await clearUserState(ctx.from.id);
    userState.set(ctx.from.id, { flow: 'search_text', conferenceCode, step: 'enter_text' });
    await ctx.reply(
      `🔍 Поиск по тексту\n\nВведите текст для поиска (интересы, предложения, поиск):`,
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: `find:conf:${conferenceCode}` }]] } }
    );
  });

  bot.action('menu:ask_question', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear previous state
    const user = await ensureUserFromTelegram(ctx.from);
    const conferences = await listConferencesForUser(user);
    
    if (!conferences.length) {
      return ctx.editMessageText(
        '❌ Сначала присоединитесь к конференции.',
        getUserMenu()
      );
    }

    userState.set(ctx.from.id, { flow: 'ask_question', step: 'select_conference' });
    await ctx.editMessageText(
      '❓ Задать вопрос\n\nВыберите конференцию:',
      getConferenceSelectionMenu(conferences, 'ask:conf')
    );
  });

  bot.action(/^ask:conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    // Update state, but keep the flow (this is a continuation of ask_question)
    const currentState = userState.get(ctx.from.id);
    if (currentState && currentState.flow === 'ask_question') {
      userState.set(ctx.from.id, { flow: 'ask_question', conferenceCode, step: 'enter_question' });
    } else {
      await clearUserState(ctx.from.id);
      userState.set(ctx.from.id, { flow: 'ask_question', conferenceCode, step: 'enter_question' });
    }
    // Use reply instead of editMessageText for text input flows
    await ctx.reply(
      `❓ Задать вопрос в конференцию\n\nВведите ваш вопрос:`,
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'menu:ask_question' }]] } }
    );
  });

  bot.action('menu:polls', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear previous state
    const user = await ensureUserFromTelegram(ctx.from);
    const conferences = await listConferencesForUser(user);
    
    if (!conferences.length) {
      return ctx.editMessageText(
        '❌ Сначала присоединитесь к конференции.',
        getUserMenu()
      );
    }

    userState.set(ctx.from.id, { flow: 'polls', step: 'select_conference' });
    await ctx.editMessageText(
      '📊 Опросы\n\nВыберите конференцию:',
      getConferenceSelectionMenu(conferences, 'polls:conf')
    );
  });

  bot.action(/^polls:conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    try {
      // Get user's profile to filter out polls they've already voted in
      const user = await ensureUserFromTelegram(ctx.from);
      const { UserProfile } = require('../models/userProfile');
      const { getConferenceIdByCode } = require('../lib/conference-helper');
      const conferenceId = await getConferenceIdByCode(conferenceCode);
      const userProfile = await UserProfile.findOne({
        telegramId: user.telegramId,
        conference: conferenceId,
        isActive: true,
      });
      
      const { polls } = await getPollsForConference({ 
        conferenceCode,
        userProfileId: userProfile ? userProfile._id : null
      });
      
      if (!polls.length) {
        return ctx.editMessageText(
          '📊 Активных опросов для этой конференции нет, или вы уже проголосовали во всех опросах.',
          getUserMenu()
        );
      }

      const text = polls.map((p, idx) => {
        const optionsList = p.options.map((opt, optIdx) => `  ${optIdx}) ${opt.text} (${opt.voters.length} голосов)`).join('\n');
        return `${idx + 1}. ${p.question}\n${optionsList}`;
      }).join('\n\n');

      const buttons = polls.map((p) => [
        { text: `📊 ${p.question}`, callback_data: `vote:select:${p._id}` }
      ]);
      buttons.push([{ text: '◀️ Назад', callback_data: 'menu:polls' }]);

      await ctx.editMessageText(`📊 Активные опросы:\n\n${text}`, { reply_markup: { inline_keyboard: buttons } });
    } catch (err) {
      console.error('Error in polls:conf', err);
      await ctx.editMessageText('❌ Ошибка при получении опросов.', getUserMenu());
    }
  });

  bot.action(/^vote:select:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const pollId = ctx.match[1];
    try {
      const { Poll } = require('../models/poll');
      const poll = await Poll.findById(pollId);
      if (!poll || !poll.isActive) {
        return ctx.editMessageText('❌ Опрос не найден или завершён.', getUserMenu());
      }
      await ctx.editMessageText(
        `📊 ${poll.question}\n\nВыберите вариант:`,
        getPollVoteMenu(pollId, poll.options)
      );
    } catch (err) {
      console.error('Error in vote:select', err);
      await ctx.editMessageText('❌ Ошибка.', getUserMenu());
    }
  });

  // Handler for poll notification button (polls:vote:conferenceCode:pollId)
  bot.action(/^polls:vote:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    const pollId = ctx.match[2];
    try {
      const { Poll } = require('../models/poll');
      const poll = await Poll.findById(pollId);
      if (!poll || !poll.isActive) {
        return ctx.editMessageText('❌ Опрос не найден или завершён.', getUserMenu());
      }
      await ctx.editMessageText(
        `📊 ${poll.question}\n\nВыберите вариант:`,
        getPollVoteMenu(pollId, poll.options)
      );
    } catch (err) {
      console.error('Error in polls:vote', err);
      await ctx.editMessageText('❌ Ошибка.', getUserMenu());
    }
  });

  bot.action(/^vote:poll:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, pollId, optionId] = ctx.match;
    try {
      const { poll } = await voteInPoll({
        telegramUser: ctx.from,
        pollId,
        optionId: parseInt(optionId, 10),
      });

      const selectedOption = poll.options.find((opt) => opt.id === parseInt(optionId, 10));
      await ctx.editMessageText(
        `✅ Ваш голос учтён!\n\nВопрос: ${poll.question}\nВыбранный вариант: ${selectedOption?.text}\nГолосов за этот вариант: ${selectedOption?.voters.length}`,
        getUserMenu()
      );
    } catch (err) {
      const { handleHandlerError } = require('../services/handler.service');
      await handleHandlerError(ctx, err, getUserMenu());
    }
  });

  // Speaker menu
  bot.action('menu:speaker', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear state when navigating to menu
    await ctx.editMessageText('🎤 Меню спикера\n\nВыберите действие:', getSpeakerMenu());
  });


  // Conference Admin menu
  bot.action('menu:conference_admin', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear ALL state when navigating to menu
    await ctx.editMessageText('⚙️ Меню администратора конференции\n\nВыберите действие:', getConferenceAdminMenu());
  });

  bot.action('menu:admin_conferences', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await ensureUserFromTelegram(ctx.from);
    const conferences = await listConferencesForUser(user);
    
    if (!conferences.length) {
      return ctx.editMessageText('❌ У вас нет конференций для управления.', getConferenceAdminMenu());
    }

    const text = conferences
      .filter((c) => c && c.conferenceCode)
      .map((c) => 
        `• ${c.title}\n  Код: ${c.conferenceCode}\n  Статус: ${c.isEnded ? 'Завершена' : 'Активна'}`
      ).join('\n\n');

    const buttons = conferences
      .filter((c) => c && c.conferenceCode) // Filter out invalid conferences
      .map((c) => {
        const row = [Markup.button.callback(`⚙️ ${c.title}`, `admin:conf:${c.conferenceCode}`)];
        const secondScreenUrl = getSecondScreenUrl(c.conferenceCode);
        if (secondScreenUrl) {
          row.push(Markup.button.url('📺', secondScreenUrl));
        }
        return row;
      });
    buttons.push([Markup.button.callback('◀️ Назад', 'menu:conference_admin')]);

    await ctx.editMessageText(`📋 Ваши конференции:\n\n${text}\n\n📺 - открыть второй экран`, Markup.inlineKeyboard(buttons));
  });

  // Conference details handler
  bot.action(/^conf:details:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    try {
      const { Conference } = require('../models/conference');
      const conference = await Conference.findOne({ conferenceCode });
      if (!conference) {
        return ctx.editMessageText('❌ Конференция не найдена.', getUserMenu());
      }

      const details = [
        `📋 ${conference.title}`,
        `Код: ${conference.conferenceCode}`,
        `Статус: ${conference.isEnded ? 'Завершена' : conference.isActive ? 'Активна' : 'Остановлена'}`,
        conference.description ? `Описание: ${conference.description}` : '',
        conference.startsAt ? `Начало: ${conference.startsAt instanceof Date ? conference.startsAt.toLocaleString('ru-RU') : new Date(conference.startsAt).toLocaleString('ru-RU')}` : '',
        conference.endsAt ? `Конец: ${conference.endsAt instanceof Date ? conference.endsAt.toLocaleString('ru-RU') : new Date(conference.endsAt).toLocaleString('ru-RU')}` : '',
      ].filter(Boolean).join('\n');

      const buttons = [];
      const secondScreenUrl = getSecondScreenUrl(conferenceCode);
      if (secondScreenUrl) {
        buttons.push([Markup.button.url('📺 Открыть второй экран', secondScreenUrl)]);
      }
      buttons.push([Markup.button.callback('◀️ Назад', 'menu:my_conferences')]);

      await ctx.editMessageText(details, Markup.inlineKeyboard(buttons));
    } catch (err) {
      console.error('Error in conf:details', err);
      await ctx.editMessageText('❌ Ошибка.', getUserMenu());
    }
  });

  bot.action(/^admin:conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear state when returning to conference management
    const conferenceCode = ctx.match[1];
    const { Conference } = require('../models/conference');
    const conference = await Conference.findOne({ conferenceCode });
    if (!conference) {
      return ctx.editMessageText('❌ Конференция не найдена.', getConferenceAdminMenu());
    }
    await ctx.editMessageText(
      `⚙️ Управление конференцией\n\nНазвание: ${conference.title}\nКод: ${conferenceCode}\nСтатус: ${conference.isEnded ? 'Завершена' : conference.isActive ? 'Активна' : 'Остановлена'}\n\nВыберите действие:`,
      getConferenceManagementMenu(conferenceCode)
    );
  });

  bot.action(/^admin:polls:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id);
    const conferenceCode = ctx.match[1];
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      const { polls } = await listPollsForManagement({
        moderatorUser: user,
        conferenceCode,
      });

      const { formatPollsList } = require('../services/handler.service');
      const formatted = formatPollsList(polls, conferenceCode);

      if (!formatted.hasPolls) {
        return ctx.editMessageText(
          formatted.text,
          Markup.inlineKeyboard([
            [{ text: '➕ Создать опрос', callback_data: `admin:create_poll:${conferenceCode}` }],
            [{ text: '◀️ Назад', callback_data: 'menu:admin_polls' }],
          ])
        );
      }

      formatted.buttons.push([{ text: '➕ Создать опрос', callback_data: `admin:create_poll:${conferenceCode}` }]);
      formatted.buttons.push([{ text: '◀️ Назад', callback_data: 'menu:admin_polls' }]);

      await ctx.editMessageText(formatted.text, { reply_markup: { inline_keyboard: formatted.buttons } });
    } catch (err) {
      const { handleHandlerError } = require('../services/handler.service');
      await handleHandlerError(ctx, err, getConferenceAdminMenu());
    }
  });

  bot.action(/^admin:poll:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, pollId, conferenceCode] = ctx.match;
    try {
      const { Poll } = require('../models/poll');
      const poll = await Poll.findById(pollId);
      if (!poll) {
        return ctx.editMessageText('❌ Опрос не найден.', getConferenceAdminMenu());
      }
      
      const statusText = poll.isActive ? '✅ Активен' : '⏸️ Деактивирован';
      const optionsText = poll.options.map((opt, idx) => 
        `${idx + 1}. ${opt.text} (${opt.voters.length} голосов)`
      ).join('\n');
      
      await ctx.editMessageText(
        `📊 Управление опросом\n\n` +
        `❓ Вопрос: ${poll.question}\n` +
        `📊 Статус: ${statusText}\n\n` +
        `📝 Варианты ответов:\n${optionsText}\n\n` +
        `Выберите действие:`,
        getPollManagementMenu(pollId, conferenceCode)
      );
    } catch (err) {
      console.error('Error in admin:poll', err);
      const { handleHandlerError } = require('../services/handler.service');
      await handleHandlerError(ctx, err, getConferenceAdminMenu());
    }
  });

  bot.action(/^poll:deactivate:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const pollId = ctx.match[1];
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      const { poll } = await deactivatePoll({ moderatorUser: user, pollId });
      // Get conferenceCode from poll
      const { Conference } = require('../models/conference');
      const conference = await Conference.findById(poll.conference);
      const conferenceCode = conference ? conference.conferenceCode : null;
      
      if (conferenceCode) {
        await ctx.editMessageText(
          '⏸️ Опрос деактивирован.',
          { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: `admin:polls:${conferenceCode}` }]] } }
        );
      } else {
        await ctx.editMessageText('⏸️ Опрос деактивирован.', getConferenceAdminMenu());
      }
    } catch (err) {
      console.error('Error in poll:deactivate', err);
      await ctx.editMessageText('❌ Ошибка.', getConferenceAdminMenu());
    }
  });

  bot.action(/^admin:create_poll:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear ALL previous state before setting new one
    const conferenceCode = ctx.match[1];
    userState.set(ctx.from.id, { flow: 'create_poll', conferenceCode, step: 'enter_question' });
    // Use reply instead of editMessageText for text input flows
    await ctx.reply(
      '📊 Создание опроса\n\nВведите вопрос:',
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `admin:polls:${conferenceCode}` }]] } }
    );
  });

  bot.action(/^poll:edit:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear ALL previous state before setting new one
    const pollId = ctx.match[1];
    userState.set(ctx.from.id, { flow: 'edit_poll', pollId, step: 'enter_question' });
    // Use reply instead of editMessageText for text input flows
    await ctx.reply(
      '✏️ Редактирование опроса\n\nВведите новый вопрос (или "-" чтобы пропустить):',
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'menu:conference_admin' }]] } }
    );
  });

  bot.action(/^poll:deactivate:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const pollId = ctx.match[1];
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      const { poll } = await deactivatePoll({ moderatorUser: user, pollId });
      // Get conferenceCode from poll
      const { Conference } = require('../models/conference');
      const conference = await Conference.findById(poll.conference);
      const conferenceCode = conference ? conference.conferenceCode : null;
      
      if (conferenceCode) {
        await ctx.editMessageText(
          '⏸️ Опрос деактивирован.',
          { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: `admin:polls:${conferenceCode}` }]] } }
        );
      } else {
        await ctx.editMessageText('⏸️ Опрос деактивирован.', getConferenceAdminMenu());
      }
    } catch (err) {
      console.error('Error in poll:deactivate', err);
      await ctx.editMessageText('❌ Ошибка.', getConferenceAdminMenu());
    }
  });

  bot.action(/^poll:delete:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, pollId, conferenceCode] = ctx.match;
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      await deletePoll({ moderatorUser: user, pollId });
      await ctx.editMessageText(
        '🗑️ Опрос удалён.',
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: `admin:polls:${conferenceCode}` }]] } }
      );
    } catch (err) {
      console.error('Error in poll:delete', err);
      await ctx.editMessageText('❌ Ошибка.', getConferenceAdminMenu());
    }
  });

  bot.action('menu:admin_polls', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear ALL previous state
    const user = await ensureUserFromTelegram(ctx.from);
    const conferences = await listConferencesForUser(user);
    
    if (!conferences.length) {
      return ctx.editMessageText('❌ У вас нет конференций.', getConferenceAdminMenu());
    }

    await ctx.editMessageText(
      '📊 Управление опросами\n\nВыберите конференцию:',
      getConferenceSelectionMenu(conferences, 'admin:polls')
    );
  });

  bot.action('menu:admin_slides', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear ALL previous state
    const user = await ensureUserFromTelegram(ctx.from);
    const conferences = await listConferencesForUser(user);
    
    if (!conferences.length) {
      return ctx.editMessageText('❌ У вас нет конференций.', getConferenceAdminMenu());
    }

    await ctx.editMessageText(
      '🖼️ Управление слайдами\n\nВыберите конференцию:',
      getConferenceSelectionMenu(conferences, 'admin:slides')
    );
  });

  bot.action('menu:admin_moderate_questions', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear ALL previous state
    const user = await ensureUserFromTelegram(ctx.from);
    const conferences = await listConferencesForUser(user);
    
    if (!conferences.length) {
      return ctx.editMessageText('❌ У вас нет конференций.', getConferenceAdminMenu());
    }

    userState.set(ctx.from.id, { flow: 'moderate_questions', step: 'select_conference' });
    await ctx.editMessageText(
      '❓ Модерация вопросов\n\nВыберите конференцию:',
      getConferenceSelectionMenu(conferences, 'moderate:conf')
    );
  });

  bot.action(/^moderate:conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      const { questions } = await listQuestionsForModeration({
        moderatorUser: user,
        conferenceCode,
      });

      const { formatQuestionsList } = require('../services/handler.service');
      const formatted = formatQuestionsList(questions, conferenceCode);

      if (!formatted.hasQuestions) {
        return ctx.editMessageText(formatted.text, getConferenceManagementMenu(conferenceCode));
      }

      formatted.buttons.push([{ text: '◀️ Назад', callback_data: `admin:conf:${conferenceCode}` }]);
      await ctx.editMessageText(formatted.text, { reply_markup: { inline_keyboard: formatted.buttons } });
    } catch (err) {
      console.error('Error in moderate:conf', err);
      let errorMsg = '❌ Ошибка при загрузке вопросов.';
      if (err.message === 'ACCESS_DENIED') {
        errorMsg = '❌ У вас нет прав для модерации вопросов в этой конференции.\n\nВы должны быть администратором конференции.';
      } else if (err.message === 'CONFERENCE_NOT_FOUND') {
        errorMsg = '❌ Конференция не найдена.';
      }
      await ctx.editMessageText(errorMsg, getConferenceAdminMenu());
    }
  });

  // Handler for moderation button in conference management menu
  bot.action(/^admin:moderate:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      const { questions } = await listQuestionsForModeration({
        moderatorUser: user,
        conferenceCode,
      });

      const { formatQuestionsList } = require('../services/handler.service');
      const formatted = formatQuestionsList(questions, conferenceCode);

      if (!formatted.hasQuestions) {
        return ctx.editMessageText(formatted.text, getConferenceManagementMenu(conferenceCode));
      }

      formatted.buttons.push([{ text: '◀️ Назад', callback_data: `admin:conf:${conferenceCode}` }]);
      await ctx.editMessageText(formatted.text, { reply_markup: { inline_keyboard: formatted.buttons } });
    } catch (err) {
      console.error('Error in admin:moderate', err);
      let errorMsg = '❌ Ошибка при загрузке вопросов.';
      if (err.message === 'ACCESS_DENIED') {
        errorMsg = '❌ У вас нет прав для модерации вопросов в этой конференции.\n\nВы должны быть администратором конференции.';
      } else if (err.message === 'CONFERENCE_NOT_FOUND') {
        errorMsg = '❌ Конференция не найдена.';
      }
      await ctx.editMessageText(errorMsg, getConferenceManagementMenu(conferenceCode));
    }
  });

  bot.action(/^moderate:question:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, conferenceCode, questionId] = ctx.match;
    try {
      const { Question } = require('../models/question');
      const question = await Question.findById(questionId);
      if (!question) {
        return ctx.editMessageText('❌ Вопрос не найден.', getConferenceAdminMenu());
      }
      await ctx.editMessageText(
        `❓ Вопрос:\n\n"${question.text}"\n\nВыберите действие:`,
        getQuestionModerationMenu(questionId, conferenceCode)
      );
    } catch (err) {
      console.error('Error in moderate:question', err);
      await ctx.editMessageText('❌ Ошибка.', getConferenceAdminMenu());
    }
  });

  bot.action(/^moderate:approve:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, conferenceCode, questionId] = ctx.match;
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      const { question } = await approveQuestion({
        moderatorUser: user,
        conferenceCode,
        questionId,
      });
      await ctx.editMessageText(
        `✅ Вопрос одобрен и будет показан на втором экране:\n\n"${question.text}"`,
        getConferenceAdminMenu()
      );
    } catch (err) {
      console.error('Error in moderate:approve', err);
      await ctx.editMessageText('❌ Ошибка при одобрении вопроса.', getConferenceAdminMenu());
    }
  });

  bot.action(/^moderate:reject:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, conferenceCode, questionId] = ctx.match;
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      const { question } = await rejectQuestion({
        moderatorUser: user,
        conferenceCode,
        questionId,
      });
      await ctx.editMessageText(
        `❌ Вопрос отклонён:\n\n"${question.text}"`,
        getConferenceAdminMenu()
      );
    } catch (err) {
      console.error('Error in moderate:reject', err);
      await ctx.editMessageText('❌ Ошибка при отклонении вопроса.', getConferenceAdminMenu());
    }
  });

  bot.action(/^admin:slides:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id);
    const conferenceCode = ctx.match[1];
    try {
      const { Conference } = require('../models/conference');
      const conference = await Conference.findOne({ conferenceCode });
      
      if (!conference) {
        return ctx.editMessageText('❌ Конференция не найдена.', getConferenceAdminMenu());
      }

      let text = `🖼️ Управление слайдами\n\nКонференция: ${conference.title}\nКод: ${conferenceCode}\n\n`;
      
      if (conference.currentSlideUrl) {
        text += `📊 Текущий слайд:\n`;
        if (conference.currentSlideTitle) {
          text += `Название: ${conference.currentSlideTitle}\n`;
        }
        text += `URL: ${conference.currentSlideUrl}\n\n`;
      } else {
        text += `❌ Слайд не установлен.\n\n`;
      }

      const buttons = [
        [{ text: '➕ Установить/Изменить слайд', callback_data: `admin:set_slide:${conferenceCode}` }],
      ];
      
      if (conference.currentSlideUrl) {
        buttons.push([{ text: '🗑️ Убрать слайд', callback_data: `admin:clear_slide:${conferenceCode}` }]);
      }
      
      buttons.push([{ text: '◀️ Назад', callback_data: 'menu:admin_slides' }]);

      await ctx.editMessageText(text, { reply_markup: { inline_keyboard: buttons } });
    } catch (err) {
      console.error('Error in admin:slides', err);
      await ctx.editMessageText('❌ Ошибка.', getConferenceAdminMenu());
    }
  });

  // Set slide - enter URL
  bot.action(/^admin:set_slide:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear ALL previous state before setting new one
    const conferenceCode = ctx.match[1];
    userState.set(ctx.from.id, { flow: 'set_slide', conferenceCode, step: 'enter_url' });
    // Use reply instead of editMessageText for text input flows
    await ctx.reply(
      `🖼️ Установка слайда\n\nВведите URL слайда (изображение или веб-страница) и опционально название через пробел:\n\nПример: https://example.com/slide.png Название слайда`,
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `admin:slides:${conferenceCode}` }]] } }
    );
  });

  bot.action(/^admin:clear_slide:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      await clearSlide({ moderatorUser: user, conferenceCode });
      await ctx.editMessageText(
        '✅ Слайд убран со второго экрана.',
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: `admin:slides:${conferenceCode}` }]] } }
      );
    } catch (err) {
      console.error('Error in admin:clear_slide', err);
      await ctx.editMessageText('❌ Ошибка.', getConferenceAdminMenu());
    }
  });

  bot.action(/^admin:end:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    await ctx.editMessageText(
      `🔚 Завершить конференцию "${conferenceCode}"?\n\nПосле завершения участники не смогут присоединяться.`,
      getConfirmationMenu('admin:end_conf', conferenceCode)
    );
  });

  bot.action(/^admin:end_conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const fullMatch = ctx.match[1];
    const parts = fullMatch.split(':');
    const action = parts[0];
    const conferenceCode = parts.slice(1).join(':'); // Join back in case code contains colons
    
    if (action === 'yes') {
      try {
        const user = await ensureUserFromTelegram(ctx.from);
        const conference = await endConference({ code: conferenceCode, requestedByUser: user });
        await ctx.editMessageText(
          `✅ Конференция "${conference.title}" завершена.`,
          getConferenceAdminMenu()
        );
      } catch (err) {
        console.error('Error in admin:end_conf', err);
        await ctx.editMessageText('❌ Ошибка при завершении конференции.', getConferenceAdminMenu());
      }
    } else {
      await ctx.editMessageText('Отменено.', getConferenceAdminMenu());
    }
  });

  // Main Admin menu
  bot.action('menu:main_admin', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear state when navigating to menu
    await ctx.editMessageText('👑 Меню главного администратора\n\nВыберите действие:', getMainAdminMenu());
  });

  bot.action('menu:admin_create_conference', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear ALL previous state before setting new one
    userState.set(ctx.from.id, { flow: 'create_conference', step: 'enter_title' });
    // Use reply instead of editMessageText for text input flows
    await ctx.reply(
      '➕ Создание конференции\n\nВведите название конференции:',
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'menu:main_admin' }]] } }
    );
  });

  bot.action('menu:admin_manage_admins', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id);
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      if (!userIsMainAdmin(user)) {
        return ctx.editMessageText('❌ Доступ запрещён.', getMainAdminMenu());
      }

      const { Conference } = require('../models/conference');
      const conferences = await Conference.find({}).sort({ createdAt: -1 }).limit(50);
      
      if (!conferences.length) {
        return ctx.editMessageText(
          '👥 Управление администраторами\n\n❌ Нет конференций.',
          getMainAdminMenu()
        );
      }

      await ctx.editMessageText(
        '👥 Управление администраторами\n\nВыберите конференцию:',
        getConferenceSelectionMenu(conferences, 'admin:manage_admins:conf')
      );
    } catch (err) {
      console.error('Error in menu:admin_manage_admins', err);
      await ctx.editMessageText('❌ Ошибка.', getMainAdminMenu());
    }
  });

  // Show admins for a conference
  bot.action(/^admin:manage_admins:conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id);
    const conferenceCode = ctx.match[1];
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      if (!userIsMainAdmin(user)) {
        return ctx.editMessageText('❌ Доступ запрещён.', getMainAdminMenu());
      }

      const { Conference } = require('../models/conference');
      const { UserProfile } = require('../models/userProfile');
      const conference = await Conference.findOne({ conferenceCode });
      
      if (!conference) {
        return ctx.editMessageText('❌ Конференция не найдена.', getMainAdminMenu());
      }

      // Get admin profiles
      const adminProfiles = await UserProfile.find({
        _id: { $in: conference.admins },
      }).populate('conference');

      let text = `👥 Администраторы конференции "${conference.title}"\n\nКод: ${conferenceCode}\n\n`;
      
      if (adminProfiles.length === 0) {
        text += '❌ Нет администраторов.';
      } else {
        text += `📋 Администраторы (${adminProfiles.length}):\n\n`;
        for (const profile of adminProfiles) {
          const name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Без имени';
          const username = profile.username ? `@${profile.username}` : '';
          text += `• ${name} ${username}\n   ID: ${profile.telegramId}\n\n`;
        }
      }

      const buttons = [
        [{ text: '➕ Назначить администратора', callback_data: `admin:assign_admin:${conferenceCode}` }],
      ];
      
      if (adminProfiles.length > 0) {
        buttons.push([{ text: '➖ Снять администратора', callback_data: `admin:revoke_admin:${conferenceCode}` }]);
      }
      
      buttons.push([{ text: '◀️ Назад', callback_data: 'menu:admin_manage_admins' }]);

      await ctx.editMessageText(text, { reply_markup: { inline_keyboard: buttons } });
    } catch (err) {
      console.error('Error in admin:manage_admins:conf', err);
      await ctx.editMessageText('❌ Ошибка.', getMainAdminMenu());
    }
  });

  // Assign admin - enter telegram ID
  bot.action(/^admin:assign_admin:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id);
    const conferenceCode = ctx.match[1];
    userState.set(ctx.from.id, { flow: 'assign_admin', conferenceCode, step: 'enter_telegram_id' });
    await ctx.reply(
      `➕ Назначение администратора\n\nВведите Telegram ID пользователя (число):`,
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `admin:manage_admins:conf:${conferenceCode}` }]] } }
    );
  });

  // Revoke admin - select from list
  bot.action(/^admin:revoke_admin:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id);
    const conferenceCode = ctx.match[1];
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      if (!userIsMainAdmin(user)) {
        return ctx.editMessageText('❌ Доступ запрещён.', getMainAdminMenu());
      }

      const { Conference } = require('../models/conference');
      const { UserProfile } = require('../models/userProfile');
      const conference = await Conference.findOne({ conferenceCode });
      
      if (!conference) {
        return ctx.editMessageText('❌ Конференция не найдена.', getMainAdminMenu());
      }

      const adminProfiles = await UserProfile.find({
        _id: { $in: conference.admins },
      });

      if (adminProfiles.length === 0) {
        return ctx.editMessageText('❌ Нет администраторов для снятия.', getMainAdminMenu());
      }

      const buttons = adminProfiles.map((profile) => {
        const name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Без имени';
        return [{ 
          text: `➖ ${name} (${profile.telegramId})`, 
          callback_data: `admin:revoke_admin_confirm:${conferenceCode}:${profile.telegramId}` 
        }];
      });
      buttons.push([{ text: '◀️ Назад', callback_data: `admin:manage_admins:conf:${conferenceCode}` }]);

      await ctx.editMessageText(
        '➖ Снятие администратора\n\nВыберите администратора для снятия:',
        { reply_markup: { inline_keyboard: buttons } }
      );
    } catch (err) {
      console.error('Error in admin:revoke_admin', err);
      await ctx.editMessageText('❌ Ошибка.', getMainAdminMenu());
    }
  });

  // Confirm revoke admin
  bot.action(/^admin:revoke_admin_confirm:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, conferenceCode, targetTelegramId] = ctx.match;
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      if (!userIsMainAdmin(user)) {
        return ctx.editMessageText('❌ Доступ запрещён.', getMainAdminMenu());
      }

      await revokeConferenceAdmin({
        mainAdminUser: user,
        conferenceCode,
        targetTelegramId,
      });

      await ctx.editMessageText(
        `✅ Администратор (ID: ${targetTelegramId}) снят с конференции.`,
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: `admin:manage_admins:conf:${conferenceCode}` }]] } }
      );
    } catch (err) {
      console.error('Error in admin:revoke_admin_confirm', err);
      let errorMsg = '❌ Ошибка при снятии администратора.';
      if (err.message === 'TARGET_USER_NOT_ADMIN') {
        errorMsg = '❌ Пользователь не является администратором этой конференции.';
      } else if (err.message === 'CONFERENCE_NOT_FOUND') {
        errorMsg = '❌ Конференция не найдена.';
      }
      await ctx.editMessageText(errorMsg, getMainAdminMenu());
    }
  });

  bot.action('menu:admin_all_conferences', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      const conferences = await listConferencesForUser(user);
      
      if (!conferences.length) {
        return ctx.editMessageText('❌ Нет конференций в системе.', getMainAdminMenu());
      }

      const text = conferences
        .filter((c) => c && c.conferenceCode)
        .map((c) => 
          `• ${c.title}\n  Код: ${c.conferenceCode}\n  Статус: ${c.isEnded ? 'Завершена' : 'Активна'}`
        ).join('\n\n');

      await safeEditMessageText(ctx, `📋 Все конференции:\n\n${text}`, getMainAdminMenu());
    } catch (err) {
      console.error('Error in menu:admin_all_conferences', err);
      await safeEditMessageText(ctx, '❌ Ошибка.', getMainAdminMenu());
    }
  });

  bot.action('menu:admin_stats', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const { getOnboardingStatistics, formatOnboardingStatistics } = require('../services/onboarding.service');
      const stats = await getOnboardingStatistics();
      const formatted = formatOnboardingStatistics(stats);
      await ctx.editMessageText(formatted, getMainAdminMenu());
    } catch (err) {
      console.error('Error in menu:admin_stats', err);
      await ctx.editMessageText('❌ Ошибка при получении статистики.', getMainAdminMenu());
    }
  });

  // ========== CANCEL COMMAND ==========
  bot.command('cancel', async (ctx) => {
    await clearUserState(ctx.from.id);
    await ctx.reply('✅ Действие отменено.', await getMainMenu(ctx.from));
  });

  bot.hears(/^(отмена|cancel)$/i, async (ctx) => {
    await clearUserState(ctx.from.id);
    await ctx.reply('✅ Действие отменено.', await getMainMenu(ctx.from));
  });

  // ========== REPLY KEYBOARD HANDLERS ==========
  
  bot.hears('📋 Мои конференции', async (ctx) => {
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      const conferences = await listConferencesForUser(user);

      if (!conferences.length) {
        return ctx.reply(
          '📋 У вас пока нет доступных конференций.\n\nИспользуйте кнопку "➕ Присоединиться" для участия.',
          getReplyKeyboard()
        );
      }

      const lines = conferences
        .filter((c) => c && c.conferenceCode)
        .map((c) => {
          const startDate = c.startsAt instanceof Date ? c.startsAt.toLocaleString('ru-RU') : (c.startsAt ? new Date(c.startsAt).toLocaleString('ru-RU') : '');
          return `• ${c.title}\n  Код: ${c.conferenceCode}${startDate ? `\n  Старт: ${startDate}` : ''}`;
        });

      await ctx.reply(`📋 Ваши конференции:\n\n${lines.join('\n\n')}`, getReplyKeyboard());
    } catch (err) {
      console.error('Error in reply keyboard: Мои конференции', err);
      await ctx.reply('❌ Произошла ошибка.', getReplyKeyboard());
    }
  });

  bot.hears('➕ Присоединиться', async (ctx) => {
    await clearUserState(ctx.from.id); // Clear ALL previous state
    userState.set(ctx.from.id, { flow: 'join_conference' });
    await ctx.reply(
      '➕ Присоединение к конференции\n\nВведите код конференции:',
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'menu:main' }]] } }
    );
  });

  bot.hears('👤 Профиль', async (ctx) => {
    await clearUserState(ctx.from.id); // Clear ALL previous state
    const { createOnboardingState } = require('../services/onboarding.service');
    await createOnboardingState(ctx.from.id);
    await ctx.reply(
      '👤 Заполнение профиля\n\n' +
      '📋 Это займёт всего 2-3 минуты. Мы поможем тебе найти интересных людей на конференции!\n\n' +
      'Шаг 1/5: Введите ваше имя и фамилию (например: Иван Иванов):',
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'menu:main' }]] } }
    );
  });

  bot.hears('🔍 Найти участников', async (ctx) => {
    const user = await ensureUserFromTelegram(ctx.from);
    const conferences = await listConferencesForUser(user);
    
    if (!conferences.length) {
      return ctx.reply('❌ Сначала присоединитесь к конференции.', getReplyKeyboard());
    }

    userState.set(ctx.from.id, { flow: 'find_participants', step: 'select_conference' });
    await ctx.reply(
      '🔍 Поиск участников\n\nВыберите конференцию:',
      getConferenceSelectionMenu(conferences, 'find:conf')
    );
  });

  bot.hears('❓ Задать вопрос', async (ctx) => {
    const user = await ensureUserFromTelegram(ctx.from);
    const conferences = await listConferencesForUser(user);
    
    if (!conferences.length) {
      return ctx.reply('❌ Сначала присоединитесь к конференции.', getReplyKeyboard());
    }

    userState.set(ctx.from.id, { flow: 'ask_question', step: 'select_conference' });
    await ctx.reply(
      '❓ Задать вопрос\n\nВыберите конференцию:',
      getConferenceSelectionMenu(conferences, 'ask:conf')
    );
  });

  bot.hears('📊 Опросы', async (ctx) => {
    const user = await ensureUserFromTelegram(ctx.from);
    const conferences = await listConferencesForUser(user);
    
    if (!conferences.length) {
      return ctx.reply('❌ Сначала присоединитесь к конференции.', getReplyKeyboard());
    }

    userState.set(ctx.from.id, { flow: 'polls', step: 'select_conference' });
    await ctx.reply(
      '📊 Опросы\n\nВыберите конференцию:',
      getConferenceSelectionMenu(conferences, 'polls:conf')
    );
  });

  // ========== NEW FEATURES: CONFERENCE MANAGEMENT ==========
  
  bot.action(/^admin:edit_conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear ALL previous state before setting new one
    const conferenceCode = ctx.match[1];
    userState.set(ctx.from.id, { flow: 'edit_conference', conferenceCode, step: 'enter_title' });
    // Use reply instead of editMessageText for text input flows
    await ctx.reply(
      `✏️ Редактирование конференции\n\nВведите новое название (или "-" чтобы пропустить):`,
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `admin:conf:${conferenceCode}` }]] } }
    );
  });

  bot.action(/^admin:start_conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      const conference = await startConference({ conferenceCode, requestedByUser: user });
      await ctx.editMessageText(
        `✅ Конференция "${conference.title}" запущена.`,
        getConferenceManagementMenu(conferenceCode)
      );
    } catch (err) {
      console.error('Error in admin:start_conf', err);
      await ctx.editMessageText('❌ Ошибка при запуске конференции.', getConferenceAdminMenu());
    }
  });

  bot.action(/^admin:stop_conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      const conference = await stopConference({ conferenceCode, requestedByUser: user });
      await ctx.editMessageText(
        `⏸️ Конференция "${conference.title}" остановлена.`,
        getConferenceManagementMenu(conferenceCode)
      );
    } catch (err) {
      console.error('Error in admin:stop_conf', err);
      await ctx.editMessageText('❌ Ошибка при остановке конференции.', getConferenceAdminMenu());
    }
  });

  bot.action(/^admin:delete_conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    await ctx.editMessageText(
      `🗑️ Удалить конференцию "${conferenceCode}"?\n\nЭто действие нельзя отменить!`,
      getConfirmationMenu('admin:delete_conf_confirm', conferenceCode)
    );
  });

  bot.action(/^admin:delete_conf_confirm:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const fullMatch = ctx.match[1];
    const parts = fullMatch.split(':');
    const action = parts[0];
    const conferenceCode = parts.slice(1).join(':');
    
    if (action === 'yes') {
      try {
        const user = await ensureUserFromTelegram(ctx.from);
        await deleteConference({ conferenceCode, requestedByUser: user });
        await ctx.editMessageText(
          `✅ Конференция "${conferenceCode}" удалена.`,
          getConferenceAdminMenu()
        );
      } catch (err) {
        console.error('Error in admin:delete_conf_confirm', err);
        await ctx.editMessageText('❌ Ошибка при удалении конференции.', getConferenceAdminMenu());
      }
    } else {
      await ctx.editMessageText('Отменено.', getConferenceAdminMenu());
    }
  });

  // Update admin:conf to show management menu (duplicate handler - keeping for compatibility)
  // Note: This is a duplicate of the handler above, but we keep it for backward compatibility
  // The first handler at line 442 should handle this, but if this is called, clear state too
  bot.action(/^admin:conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear state when returning to conference management
    const conferenceCode = ctx.match[1];
    const { Conference } = require('../models/conference');
    const conference = await Conference.findOne({ conferenceCode });
    if (!conference) {
      return ctx.editMessageText('❌ Конференция не найдена.', getConferenceAdminMenu());
    }
    await ctx.editMessageText(
      `⚙️ Управление конференцией\n\nНазвание: ${conference.title}\nКод: ${conferenceCode}\nСтатус: ${conference.isEnded ? 'Завершена' : conference.isActive ? 'Активна' : 'Остановлена'}\n\nВыберите действие:`,
      getConferenceManagementMenu(conferenceCode)
    );
  });

  // ========== NEW FEATURES: SPEAKER MANAGEMENT ==========
  
  bot.action('menu:admin_participants', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await ensureUserFromTelegram(ctx.from);
    const conferences = await listConferencesForUser(user);
    
    if (!conferences.length) {
      return ctx.editMessageText('❌ У вас нет конференций.', getConferenceAdminMenu());
    }

    userState.set(ctx.from.id, { flow: 'manage_participants', step: 'select_conference' });
    await ctx.editMessageText(
      '👥 Управление участниками\n\nВыберите конференцию:',
      getConferenceSelectionMenu(conferences, 'participants:conf')
    );
  });

  bot.action(/^participants:conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    const { UserProfile } = require('../models/userProfile');
    const { Conference } = require('../models/conference');
    const conference = await Conference.findOne({ conferenceCode });
    if (!conference) {
      return ctx.editMessageText('❌ Конференция не найдена.', getConferenceAdminMenu());
    }

    const participants = await UserProfile.find({
      conference: conference._id,
      isActive: true,
    }).limit(50);

    if (!participants.length) {
      return ctx.editMessageText('❌ Нет участников в этой конференции.', getConferenceManagementMenu(conferenceCode));
    }

    await ctx.editMessageText(
      `👥 Участники конференции (${participants.length})\n\nВыберите действие:`,
      Markup.inlineKeyboard([
        [{ text: '🎤 Назначить спикера', callback_data: `speaker:assign:${conferenceCode}` }],
        [{ text: '🎤 Убрать роль спикера', callback_data: `speaker:remove:${conferenceCode}` }],
        [{ text: '◀️ Назад', callback_data: `admin:conf:${conferenceCode}` }],
      ])
    );
  });

  bot.action(/^speaker:assign:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    const { UserProfile } = require('../models/userProfile');
    const { Conference } = require('../models/conference');
    const conference = await Conference.findOne({ conferenceCode });
    if (!conference) {
      return ctx.editMessageText('❌ Конференция не найдена.', getConferenceAdminMenu());
    }

    const participants = await UserProfile.find({
      conference: conference._id,
      isActive: true,
    }).limit(50);

    await ctx.editMessageText(
      '🎤 Назначить спикера\n\nВыберите участника:',
      getParticipantSelectionMenu(participants, `speaker:assign_user:${conferenceCode}:`)
    );
  });

  bot.action(/^speaker:assign_user:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, conferenceCode, profileId] = ctx.match;
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      const { UserProfile } = require('../models/userProfile');
      const targetProfile = await UserProfile.findById(profileId);
      if (!targetProfile) {
        return ctx.editMessageText('❌ Профиль не найден.', getConferenceAdminMenu());
      }
      await assignSpeaker({
        conferenceCode,
        targetTelegramId: targetProfile.telegramId,
        requestedByUser: user,
      });
      await ctx.editMessageText(
        `✅ Пользователь ${targetProfile.firstName} ${targetProfile.lastName || ''} назначен спикером.`,
        getConferenceAdminMenu()
      );
    } catch (err) {
      console.error('Error in speaker:assign_user', err);
      await ctx.editMessageText('❌ Ошибка при назначении спикера.', getConferenceAdminMenu());
    }
  });

  bot.action(/^speaker:remove:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    const { UserProfile } = require('../models/userProfile');
    const { Conference } = require('../models/conference');
    const conference = await Conference.findOne({ conferenceCode });
    if (!conference) {
      return ctx.editMessageText('❌ Конференция не найдена.', getConferenceAdminMenu());
    }

    const speakers = await UserProfile.find({
      conference: conference._id,
      isActive: true,
      roles: 'speaker',
    }).limit(50);

    if (!speakers.length) {
      return ctx.editMessageText('❌ Нет спикеров в этой конференции.', getConferenceAdminMenu());
    }

    await ctx.editMessageText(
      '🎤 Убрать роль спикера\n\nВыберите спикера:',
      getParticipantSelectionMenu(speakers, `speaker:remove_user:${conferenceCode}:`)
    );
  });

  bot.action(/^speaker:remove_user:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, conferenceCode, profileId] = ctx.match;
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      const { UserProfile } = require('../models/userProfile');
      const targetProfile = await UserProfile.findById(profileId);
      if (!targetProfile) {
        return ctx.editMessageText('❌ Профиль не найден.', getConferenceAdminMenu());
      }
      await removeSpeaker({
        conferenceCode,
        targetTelegramId: targetProfile.telegramId,
        requestedByUser: user,
      });
      await ctx.editMessageText(
        `✅ Роль спикера убрана у ${targetProfile.firstName} ${targetProfile.lastName || ''}.`,
        getConferenceAdminMenu()
      );
    } catch (err) {
      console.error('Error in speaker:remove_user', err);
      await ctx.editMessageText('❌ Ошибка при удалении роли спикера.', getConferenceAdminMenu());
    }
  });

  // ========== NEW FEATURES: SPEAKER Q&A ==========
  
  bot.action('menu:speaker_questions', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear ALL previous state
    const user = await ensureUserFromTelegram(ctx.from);
    const conferences = await listConferencesForUser(user);
    
    if (!conferences.length) {
      return ctx.editMessageText('❌ У вас нет конференций.', getSpeakerMenu());
    }

    userState.set(ctx.from.id, { flow: 'speaker_questions', step: 'select_conference' });
    await ctx.editMessageText(
      '❓ Вопросы для спикера\n\nВыберите конференцию:',
      getConferenceSelectionMenu(conferences, 'speaker:questions:conf')
    );
  });

  bot.action(/^speaker:questions:conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      const { questions } = await listQuestionsForSpeaker({
        speakerUser: user,
        conferenceCode,
      });

      if (!questions.length) {
        return ctx.editMessageText(
          '✅ Нет вопросов для ответа.',
          getSpeakerMenu()
        );
      }

      await ctx.editMessageText(
        `❓ Вопросы для ответа (${questions.length})\n\nВыберите вопрос:`,
        getQuestionListMenu(questions, `speaker:answer:${conferenceCode}:`)
      );
    } catch (err) {
      console.error('Error in speaker:questions:conf', err);
      await ctx.editMessageText('❌ Ошибка.', getSpeakerMenu());
    }
  });

  bot.action(/^speaker:answer:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear ALL previous state before setting new one
    const [, conferenceCode, questionId] = ctx.match;
    userState.set(ctx.from.id, { flow: 'answer_question', conferenceCode, questionId, step: 'enter_answer' });
    // Use reply instead of editMessageText for text input flows
    await ctx.reply(
      '💬 Ответ на вопрос\n\nВведите ваш ответ:',
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `speaker:questions:conf:${conferenceCode}` }]] } }
    );
  });

  // ========== NEW FEATURES: SPEAKER POLL MANAGEMENT ==========
  
  bot.action('menu:speaker_polls', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear ALL previous state
    const user = await ensureUserFromTelegram(ctx.from);
    const conferences = await listConferencesForUser(user);
    
    if (!conferences.length) {
      return ctx.editMessageText('❌ У вас нет конференций.', getSpeakerMenu());
    }

    userState.set(ctx.from.id, { flow: 'speaker_polls', step: 'select_conference' });
    await ctx.editMessageText(
      '📊 Управление опросами\n\nВыберите конференцию:',
      getConferenceSelectionMenu(conferences, 'speaker:polls:conf')
    );
  });

  bot.action(/^speaker:polls:conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear state when navigating to polls list
    const conferenceCode = ctx.match[1];
    try {
      const user = await ensureUserFromTelegram(ctx.from);
      const { polls } = await listPollsForManagement({
        moderatorUser: user,
        conferenceCode,
      });

      if (!polls.length) {
        return ctx.editMessageText(
          '📊 Нет опросов. Создайте новый опрос.',
          Markup.inlineKeyboard([
            [{ text: '➕ Создать опрос', callback_data: `speaker:create_poll:${conferenceCode}` }],
            [{ text: '◀️ Назад', callback_data: 'menu:speaker_polls' }],
          ])
        );
      }

      const buttons = polls.map((p) => [
        { text: `${p.isActive ? '✅' : '⏸️'} ${p.question}`, callback_data: `speaker:poll:${p._id}:${conferenceCode}` }
      ]);
      buttons.push([{ text: '➕ Создать опрос', callback_data: `speaker:create_poll:${conferenceCode}` }]);
      buttons.push([{ text: '◀️ Назад', callback_data: 'menu:speaker_polls' }]);

      await ctx.editMessageText(
        `📊 Опросы (${polls.length})\n\nВыберите опрос для управления:`,
        { reply_markup: { inline_keyboard: buttons } }
      );
    } catch (err) {
      console.error('Error in speaker:polls:conf', err);
      await ctx.editMessageText('❌ Ошибка.', getSpeakerMenu());
    }
  });

  bot.action(/^speaker:poll:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, pollId, conferenceCode] = ctx.match;
    await ctx.editMessageText(
      `📊 Управление опросом\n\nВыберите действие:`,
      getPollManagementMenu(pollId, conferenceCode)
    );
  });

  bot.action(/^speaker:create_poll:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear ALL previous state before setting new one
    const conferenceCode = ctx.match[1];
    userState.set(ctx.from.id, { flow: 'create_poll', conferenceCode, step: 'enter_question' });
    // Use reply instead of editMessageText for text input flows
    await ctx.reply(
      '📊 Создание опроса\n\nВведите вопрос:',
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `speaker:polls:conf:${conferenceCode}` }]] } }
    );
  });

  // ========== NEW FEATURES: ASK QUESTION TO SPEAKER ==========
  
  bot.action(/^ask:conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    try {
      const { speakers } = await listSpeakers({ conferenceCode });
      if (speakers.length === 0) {
        // No speakers, ask general question
        await clearUserState(ctx.from.id); // Clear previous state
        userState.set(ctx.from.id, { flow: 'ask_question', conferenceCode, step: 'enter_question', targetSpeaker: null });
        // Use reply instead of editMessageText for text input flows
        await ctx.reply(
          `❓ Задать вопрос в конференцию\n\nВ этой конференции нет спикеров. Введите ваш вопрос:`,
          { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'menu:ask_question' }]] } }
        );
      } else {
        // Show speaker selection
        await ctx.editMessageText(
          '❓ Задать вопрос\n\nВыберите спикера (или "Для всех спикеров"):',
          getSpeakerSelectionMenu(speakers, `ask:speaker:${conferenceCode}:`)
        );
      }
    } catch (err) {
      console.error('Error in ask:conf', err);
      await ctx.editMessageText('❌ Ошибка.', getUserMenu());
    }
  });

  bot.action(/^ask:speaker:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id); // Clear ALL previous state before setting new one
    const [, conferenceCode, targetId] = ctx.match;
    const targetSpeaker = targetId === 'all' ? null : targetId;
    userState.set(ctx.from.id, { flow: 'ask_question', conferenceCode, step: 'enter_question', targetSpeaker });
    await ctx.editMessageText(
      `❓ Задать вопрос${targetSpeaker ? ' спикеру' : ' (для всех спикеров)'}\n\nВведите ваш вопрос:`,
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: 'menu:ask_question' }]] } }
    );
  });

  // ========== MEETINGS (1:1 TIME SLOTS) ==========
  
  bot.action('menu:meetings', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id);
    const user = await ensureUserFromTelegram(ctx.from);
    const conferences = await listConferencesForUser(user);
    
    if (!conferences.length) {
      return ctx.editMessageText('❌ Сначала присоединитесь к конференции.', getUserMenu());
    }

    await ctx.editMessageText(
      '🤝 Встречи 1:1\n\nВыберите конференцию:',
      getConferenceSelectionMenu(conferences, 'meeting:menu')
    );
  });

  bot.action(/^meeting:menu:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    await ctx.editMessageText(
      `🤝 Встречи 1:1\n\nКонференция: ${conferenceCode}\n\nВыберите действие:`,
      getMeetingMenu(conferenceCode)
    );
  });

  bot.action(/^meeting:request:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    try {
      const { searchProfiles } = require('../services/matching.service');
      const { profiles } = await searchProfiles({ conferenceCode, role: null, text: null, limit: 50 });
      const user = await ensureUserFromTelegram(ctx.from);
      const { UserProfile } = require('../models/userProfile');
      const { getConferenceIdByCode } = require('../lib/conference-helper');
      const conferenceId = await getConferenceIdByCode(conferenceCode);
      const myProfile = await UserProfile.findOne({ telegramId: user.telegramId, conference: conferenceId });
      
      // Filter out current user's profile if it exists
      let otherProfiles = profiles;
      if (myProfile) {
        otherProfiles = profiles.filter((p) => p._id.toString() !== myProfile._id.toString());
      }
      
      if (!otherProfiles.length) {
        return ctx.editMessageText('❌ Нет других участников для встречи.', getMeetingMenu(conferenceCode));
      }

      await ctx.editMessageText(
        '🤝 Запросить встречу\n\nВыберите участника:',
        getMeetingParticipantMenu(otherProfiles, conferenceCode)
      );
    } catch (err) {
      console.error('Error in meeting:request', err);
      await ctx.editMessageText('❌ Ошибка.', getUserMenu());
    }
  });

  // Handle new format: meeting:select:PROFILE_ID
  bot.action(/^meeting:select:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id);
    const recipientProfileId = ctx.match[1];
    
    try {
      // Get profile to retrieve conferenceCode
      const { UserProfile } = require('../models/userProfile');
      const profile = await UserProfile.findById(recipientProfileId).populate('conference', 'conferenceCode');
      
      if (!profile || !profile.conference) {
        return ctx.editMessageText('❌ Участник не найден.', await getMainMenu(ctx.from));
      }
      
      const conferenceCode = profile.conference.conferenceCode || profile.conference;
      userState.set(ctx.from.id, { flow: 'request_meeting', conferenceCode, recipientProfileId, step: 'enter_date' });
      await ctx.editMessageText(
        '🤝 Запрос встречи\n\n📅 Выберите дату встречи:',
        getMeetingDateMenu(conferenceCode)
      );
    } catch (err) {
      console.error('Error in meeting:select', err);
      await ctx.editMessageText('❌ Ошибка при выборе участника.', await getMainMenu(ctx.from));
    }
  });

  // Keep old format for backward compatibility
  bot.action(/^meeting:select_participant:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id);
    const [, conferenceCode, recipientProfileId] = ctx.match;
    userState.set(ctx.from.id, { flow: 'request_meeting', conferenceCode, recipientProfileId, step: 'enter_date' });
    await ctx.editMessageText(
      '🤝 Запрос встречи\n\n📅 Выберите дату встречи:',
      getMeetingDateMenu(conferenceCode)
    );
  });

  // Handle date selection for meetings
  bot.action(/^meeting:date:(.+):(today|tomorrow|nextweek|manual)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, conferenceCode, dateOption] = ctx.match;
    const state = userState.get(ctx.from.id);
    
    if (!state || state.flow !== 'request_meeting' || state.step !== 'enter_date') {
      return ctx.reply('❌ Неверное состояние. Начните заново.', await getMainMenu(ctx.from));
    }

    let selectedDate;
    if (dateOption === 'today') {
      selectedDate = new Date();
    } else if (dateOption === 'tomorrow') {
      selectedDate = new Date();
      selectedDate.setDate(selectedDate.getDate() + 1);
    } else if (dateOption === 'nextweek') {
      selectedDate = new Date();
      selectedDate.setDate(selectedDate.getDate() + 7);
    } else if (dateOption === 'manual') {
      userState.set(ctx.from.id, { ...state, step: 'enter_date_manual' });
      await ctx.editMessageText(
        '📅 Введите дату в формате ДД.ММ.ГГГГ или ДД.ММ\nНапример: 25.12.2024 или 25.12',
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `meeting:request:${conferenceCode}` }]] } }
      );
      return;
    }

    selectedDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      return ctx.editMessageText('❌ Нельзя выбрать прошедшую дату.', getMeetingDateMenu(conferenceCode));
    }

    userState.set(ctx.from.id, { ...state, selectedDate: selectedDate.toISOString(), step: 'enter_time' });
    await ctx.editMessageText(
      `✅ Дата выбрана: ${selectedDate.toLocaleDateString('ru-RU')}\n\n⏰ Введите время встречи в формате ЧЧ:ММ\nНапример: 14:30`,
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `meeting:request:${conferenceCode}` }]] } }
    );
  });

  bot.action(/^meeting:list:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    try {
      const { listMeetings } = require('../services/meeting.service');
      const { meetings } = await listMeetings({ telegramUser: ctx.from, conferenceCode });
      
      if (!meetings.length) {
        return ctx.editMessageText('📋 У вас нет встреч в этой конференции.', getMeetingMenu(conferenceCode));
      }

      const user = await ensureUserFromTelegram(ctx.from);
      await ctx.editMessageText(
        `📋 Мои встречи (${meetings.length})\n\nВыберите встречу:`,
        getMeetingListMenu(meetings, conferenceCode, user.telegramId)
      );
    } catch (err) {
      console.error('Error in meeting:list', err);
      let errorMsg = '❌ Ошибка.';
      if (err.message === 'NOT_IN_CONFERENCE') {
        errorMsg = '❌ Сначала присоединитесь к этой конференции через кнопку "➕ Присоединиться".';
      }
      await ctx.editMessageText(errorMsg, getUserMenu());
    }
  });

  bot.action(/^meeting:details:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, meetingId, conferenceCode] = ctx.match;
    try {
      const { Meeting } = require('../models/meeting');
      const meeting = await Meeting.findById(meetingId).populate('requester recipient');
      if (!meeting) {
        return ctx.editMessageText('❌ Встреча не найдена.', getMeetingMenu(conferenceCode));
      }

      const user = await ensureUserFromTelegram(ctx.from);
      const isRequester = meeting.requester.telegramId === user.telegramId;
      const isRecipient = meeting.recipient.telegramId === user.telegramId;
      const otherPerson = isRequester ? meeting.recipient : meeting.requester;
      
      const statusText = {
        pending: '⏳ Ожидает ответа',
        accepted: '✅ Принята',
        rejected: '❌ Отклонена',
        cancelled: '🚫 Отменена',
        completed: '✅ Завершена',
      }[meeting.status] || meeting.status;

      // Get chat URL if meeting is active
      let chatUrl = null;
      const now = new Date();
      const meetingTime = new Date(meeting.proposedTime);
      const meetingEndTime = new Date(meetingTime.getTime() + meeting.durationMinutes * 60 * 1000);
      
      if (meeting.status === 'accepted' && now >= meetingTime && now < meetingEndTime) {
        try {
          const { getOrCreateChatToken, getChatUrl } = require('../services/meetingChat.service');
          const tokenDoc = await getOrCreateChatToken({ meetingId: meeting._id });
          const baseUrl = process.env.BASE_URL || process.env.SERVER_URL || 'http://localhost:3000';
          chatUrl = getChatUrl({ meetingId: meeting._id.toString(), token: tokenDoc.token, baseUrl }) + `&telegramId=${user.telegramId}`;
        } catch (err) {
          console.error('Error getting chat token for meeting details:', err);
        }
      }

      const text = `🤝 Детали встречи\n\n` +
        `С кем: ${otherPerson.firstName} ${otherPerson.lastName || ''}\n` +
        `Время: ${new Date(meeting.proposedTime).toLocaleString('ru-RU')}\n` +
        `Длительность: ${meeting.durationMinutes} минут\n` +
        `Статус: ${statusText}\n` +
        (meeting.message ? `Сообщение: ${meeting.message}\n` : '');

      await ctx.editMessageText(text, getMeetingDetailsMenu(meeting, conferenceCode, user.telegramId, chatUrl));
    } catch (err) {
      console.error('Error in meeting:details', err);
      await ctx.editMessageText('❌ Ошибка.', getUserMenu());
    }
  });

  bot.action(/^meeting:accept:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const meetingId = ctx.match[1];
    try {
      const { acceptMeeting } = require('../services/meeting.service');
      const { meeting } = await acceptMeeting({ telegramUser: ctx.from, meetingId });
      const { Conference } = require('../models/conference');
      const conference = await Conference.findById(meeting.conference);
      await ctx.editMessageText(
        '✅ Встреча принята!',
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: `meeting:list:${conference.conferenceCode}` }]] } }
      );
    } catch (err) {
      console.error('Error in meeting:accept', err);
      let errorMsg = '❌ Ошибка при принятии встречи.';
      if (err.message === 'TIME_CONFLICT') {
        errorMsg = '❌ У вас уже есть встреча в это время.';
      }
      await ctx.editMessageText(errorMsg, getUserMenu());
    }
  });

  bot.action(/^meeting:reject:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const meetingId = ctx.match[1];
    try {
      const { rejectMeeting } = require('../services/meeting.service');
      const { meeting } = await rejectMeeting({ telegramUser: ctx.from, meetingId });
      const { Conference } = require('../models/conference');
      const conference = await Conference.findById(meeting.conference);
      await ctx.editMessageText(
        '❌ Встреча отклонена.',
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: `meeting:list:${conference.conferenceCode}` }]] } }
      );
    } catch (err) {
      console.error('Error in meeting:reject', err);
      await ctx.editMessageText('❌ Ошибка при отклонении встречи.', getUserMenu());
    }
  });

  bot.action(/^meeting:cancel:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const meetingId = ctx.match[1];
    try {
      const { cancelMeeting } = require('../services/meeting.service');
      const { meeting } = await cancelMeeting({ telegramUser: ctx.from, meetingId });
      const { Conference } = require('../models/conference');
      const conference = await Conference.findById(meeting.conference);
      await ctx.editMessageText(
        '🚫 Встреча отменена.',
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: `meeting:list:${conference.conferenceCode}` }]] } }
      );
    } catch (err) {
      console.error('Error in meeting:cancel', err);
      await ctx.editMessageText('❌ Ошибка при отмене встречи.', getUserMenu());
    }
  });

  bot.action(/^meeting:slots:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    try {
      const { getAvailableTimeSlots } = require('../services/meeting.service');
      // Get slots for today and tomorrow
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todaySlots = await getAvailableTimeSlots({ telegramUser: ctx.from, conferenceCode, date: today });
      const tomorrowSlots = await getAvailableTimeSlots({ telegramUser: ctx.from, conferenceCode, date: tomorrow });

      let text = '⏰ Доступные временные слоты\n\n';
      
      if (todaySlots.slots.length === 0 && tomorrowSlots.slots.length === 0) {
        text += '❌ Нет доступных слотов на сегодня и завтра.\n\n';
        text += `📅 У вас запланировано встреч:\n`;
        text += `Сегодня: ${todaySlots.meetings.length}\n`;
        text += `Завтра: ${tomorrowSlots.meetings.length}`;
      } else {
        if (todaySlots.slots.length > 0) {
          text += `📅 Сегодня (${today.toLocaleDateString('ru-RU')}):\n`;
          todaySlots.slots.slice(0, 10).forEach((slot) => {
            text += `  • ${slot.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}\n`;
          });
          if (todaySlots.slots.length > 10) {
            text += `  ... и ещё ${todaySlots.slots.length - 10} слотов\n`;
          }
          text += '\n';
        }

        if (tomorrowSlots.slots.length > 0) {
          text += `📅 Завтра (${tomorrow.toLocaleDateString('ru-RU')}):\n`;
          tomorrowSlots.slots.slice(0, 10).forEach((slot) => {
            text += `  • ${slot.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}\n`;
          });
          if (tomorrowSlots.slots.length > 10) {
            text += `  ... и ещё ${tomorrowSlots.slots.length - 10} слотов\n`;
          }
        }
      }

      await ctx.editMessageText(
        text,
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: `meeting:menu:${conferenceCode}` }]] } }
      );
    } catch (err) {
      console.error('Error in meeting:slots', err);
      let errorMsg = '❌ Ошибка при получении слотов.';
      if (err.message === 'NOT_IN_CONFERENCE') {
        errorMsg = '❌ Сначала присоединитесь к этой конференции через кнопку "➕ Присоединиться".';
      }
      await ctx.editMessageText(errorMsg, getUserMenu());
    }
  });

  bot.action(/^meeting:complete:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, meetingId, conferenceCode] = ctx.match;
    try {
      const { Meeting } = require('../models/meeting');
      const { UserProfile } = require('../models/userProfile');
      const meeting = await Meeting.findById(meetingId).populate('requester recipient');
      if (!meeting) {
        return ctx.editMessageText('❌ Встреча не найдена.', getMeetingMenu(conferenceCode));
      }

      const user = await ensureUserFromTelegram(ctx.from);
      const isRequester = meeting.requester.telegramId === user.telegramId;
      const isRecipient = meeting.recipient.telegramId === user.telegramId;

      if (!isRequester && !isRecipient) {
        return ctx.editMessageText('❌ Вы не участник этой встречи.', getMeetingMenu(conferenceCode));
      }

      if (meeting.status !== 'accepted') {
        return ctx.editMessageText('❌ Можно отметить только принятые встречи.', getMeetingMenu(conferenceCode));
      }

      meeting.status = 'completed';
      meeting.updatedAt = new Date();
      await meeting.save();

      await ctx.editMessageText(
        '✅ Встреча отмечена как завершённая!',
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: `meeting:list:${conferenceCode}` }]] } }
      );
    } catch (err) {
      console.error('Error in meeting:complete', err);
      await ctx.editMessageText('❌ Ошибка при отметке встречи.', getUserMenu());
    }
  });

  // ========== ORGANIZER REPORTS ==========
  
  bot.action('menu:admin_dashboard', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id);
    const user = await ensureUserFromTelegram(ctx.from);
    const conferences = await listConferencesForUser(user);
    
    if (!conferences.length) {
      return await safeEditMessageText(ctx, '❌ У вас нет конференций.', getConferenceAdminMenu());
    }

    const { getOrganizerAdminUrl, getOrganizerDashboardUrl } = require('./menus');
    const buttons = [];
    const baseUrl = process.env.BASE_URL || process.env.SERVER_URL || 'http://localhost:3000';
    
    // Generate buttons and text with URLs
    let text = '🌐 Админ-панель (веб)\n\nВыберите конференцию:\n\n';
    
    for (const conf of conferences.filter(c => c && c.conferenceCode)) {
      const adminUrl = getOrganizerAdminUrl(conf.conferenceCode, ctx.from.id);
      const reportUrl = getOrganizerDashboardUrl(conf.conferenceCode, ctx.from.id);
      if (adminUrl) {
        buttons.push([Markup.button.url(`🔧 ${conf.title} (Управление)`, adminUrl)]);
        if (reportUrl) {
          buttons.push([Markup.button.url(`📊 ${conf.title} (Отчёты)`, reportUrl)]);
        }
        text += `• ${conf.title}\n  Код: ${conf.conferenceCode}\n`;
        // if (adminUrl) text += `  🔧 Управление: ${adminUrl}\n`;
        // if (reportUrl) text += `  📊 Отчёты: ${reportUrl}\n`;
        text += '\n';
      } else {
        console.warn(`Failed to generate admin URL for conference ${conf.conferenceCode}, user ${ctx.from.id}`);
        text += `• ${conf.title}\n  Код: ${conf.conferenceCode}\n  ❌ Не удалось сгенерировать ссылку\n\n`;
      }
    }
    
    text += '💡 Используйте кнопки выше для открытия.\n\n';
    buttons.push([Markup.button.callback('◀️ Назад', 'menu:conference_admin')]);
    
    await safeEditMessageText(ctx, text, Markup.inlineKeyboard(buttons));
  });

  bot.action('menu:admin_report', async (ctx) => {
    await ctx.answerCbQuery();
    await clearUserState(ctx.from.id);
    const user = await ensureUserFromTelegram(ctx.from);
    const conferences = await listConferencesForUser(user);
    
    if (!conferences.length) {
      return ctx.editMessageText('❌ У вас нет конференций.', getConferenceAdminMenu());
    }

    await ctx.editMessageText(
      '📊 Отчёт организатора\n\nВыберите конференцию:',
      getConferenceSelectionMenu(conferences, 'report:conf')
    );
  });

  bot.action(/^report:conf:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const conferenceCode = ctx.match[1];
    try {
      const { generateOrganizerReport, formatReportAsText } = require('../services/report.service');
      const { getOrganizerDashboardUrl } = require('./menus');
      const report = await generateOrganizerReport({ telegramUser: ctx.from, conferenceCode });
      const text = formatReportAsText(report);
      
      // Create buttons with dashboard link
      const buttons = [];
      const dashboardUrl = getOrganizerDashboardUrl(conferenceCode, ctx.from.id);
      if (dashboardUrl) {
        buttons.push([Markup.button.url('📊 Открыть Dashboard', dashboardUrl)]);
      }
      buttons.push([Markup.button.callback('◀️ Назад', 'menu:admin_report')]);
      
      try {
        await ctx.editMessageText(
          text,
          { reply_markup: { inline_keyboard: buttons } }
        );
      } catch (editErr) {
        // Handle "message is not modified" error - this is not critical
        if (editErr.response && editErr.response.error_code === 400 && 
            editErr.response.description && editErr.response.description.includes('message is not modified')) {
          // Message is already up to date, just answer the callback query
          return;
        }
        throw editErr; // Re-throw if it's a different error
      }
    } catch (err) {
      console.error('Error in report:conf', err);
      const { handleHandlerError } = require('../services/handler.service');
      await handleHandlerError(ctx, err, getConferenceAdminMenu());
    }
  });

  // ========== TEXT HANDLERS (for flows) ==========
  
  bot.on('text', async (ctx) => {
    // Skip commands
    if (ctx.message.text.startsWith('/')) {
      return;
    }

    const text = ctx.message.text.trim();

    // Cancel flows - check this first
    if (text.toLowerCase() === 'отмена' || text.toLowerCase() === 'cancel' || text.toLowerCase() === '/cancel') {
      await clearUserState(ctx.from.id);
      await ctx.reply('✅ Текущее действие отменено.', await getMainMenu(ctx.from));
      return;
    }

    // Check if user has any active state
    // Priority: userState first (more recent actions), then onboardingState from DB
    const state = userState.get(ctx.from.id);
    const { getOnboardingState } = require('../services/onboarding.service');
    let onboarding = await getOnboardingState(ctx.from.id);
    // Only consider active onboarding (not completed)
    if (onboarding && onboarding.completedAt) {
      onboarding = null;
    }

    // If no state, ignore the text (user might be trying to use a command)
    if (!state && !onboarding) {
      // User sent text but has no active flow - suggest using menu
      await ctx.reply(
        'ℹ️ Выберите действие из меню или используйте команду /start для начала.',
        await getMainMenu(ctx.from)
      );
      return;
    }

    // IMPORTANT: Process userState flows FIRST (they have priority)
    // Only process onboarding if there's no active userState flow
    
    // Onboarding flow - only if no userState is active
    if (onboarding && !state) {
      try {
        const { processOnboardingStep } = require('../services/handler.service');
        const result = await processOnboardingStep({
          step: onboarding.step,
          text,
          onboardingData: onboarding.data,
          telegramUser: ctx.from,
        });

        if (!result.shouldContinue) {
          if (result.response) {
            await ctx.reply(result.response);
          }
          if (result.clearState) {
            await clearUserState(ctx.from.id);
          }
          return;
        }

        // Update onboarding state in database
        const { updateOnboardingState } = require('../services/onboarding.service');
        await updateOnboardingState(ctx.from.id, {
          step: result.nextStep,
          data: result.data,
        });

        if (result.response) {
          if (typeof result.response === 'string') {
            await ctx.reply(result.response);
          } else {
            await ctx.reply(result.response.text, result.response.menu);
          }
        }
      } catch (err) {
        console.error('Error in onboarding flow', err);
        const { formatErrorMessage } = require('../services/handler.service');
        let errorMsg = formatErrorMessage(err);
        if (err.message && err.message.includes('Invalid type')) {
          errorMsg = '❌ Неверный формат данных. Пожалуйста, следуйте инструкциям.';
        }
        await ctx.reply(errorMsg, { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'menu:main' }]] } });
      }
      return;
    }

    // Join conference flow
    if (state && state.flow === 'join_conference') {
      try {
        const { conference } = await joinConference({
          telegramUser: ctx.from,
          code: text,
        });
        await clearUserState(ctx.from.id);
        await ctx.reply(
          `✅ Вы присоединились к конференции "${conference.title}"!\n\nКод: ${conference.conferenceCode}`,
          await getMainMenu(ctx.from)
        );
      } catch (err) {
        console.error('Error in join_conference flow', err);
        let errorMsg = '❌ Не удалось присоединиться.';
        if (err.message === 'CONFERENCE_NOT_FOUND') {
          errorMsg = '❌ Конференция не найдена или завершена.';
        }
        await ctx.reply(errorMsg, { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'menu:main' }]] } });
      }
      return;
    }

    // Text search flow (for search_text)
    if (state && state.flow === 'search_text' && state.step === 'enter_text') {
      try {
        const searchText = text.trim();

        const { profiles } = await searchProfiles({
          conferenceCode: state.conferenceCode,
          role: null,
          text: searchText,
          limit: 20,
        });

        await clearUserState(ctx.from.id);

        if (!profiles.length) {
          return ctx.reply(
            `❌ Участники не найдены по запросу "${searchText}".`,
            { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад к фильтрам', callback_data: `find:conf:${state.conferenceCode}` }]] } }
          );
        }

        const { processTextSearchResults } = require('../services/handler.service');
        const result = await processTextSearchResults({
          profiles,
          searchText,
          conferenceCode: state.conferenceCode,
          searcherTelegramId: ctx.from.id,
          getSearchFilterMenu: () => ({ reply_markup: { inline_keyboard: [[{ text: '◀️ Назад к фильтрам', callback_data: `find:conf:${state.conferenceCode}` }]] } }),
        });

        await ctx.reply(result.text, result.menu);
      } catch (err) {
        const { handleHandlerError } = require('../services/handler.service');
        await handleHandlerError(ctx, err);
      }
      return;
    }

    // Ask question flow
    if (state && state.flow === 'ask_question' && state.step === 'enter_question') {
      try {
        const { conference } = await askQuestion({
          telegramUser: ctx.from,
          conferenceCode: state.conferenceCode,
          text,
          targetSpeakerProfileId: state.targetSpeaker || null,
        });
        await clearUserState(ctx.from.id);
        const targetText = state.targetSpeaker ? ' спикеру' : '';
        await ctx.reply(
          `✅ Ваш вопрос${targetText} отправлен модераторам конференции "${conference.title}".`,
          await getMainMenu(ctx.from)
        );
      } catch (err) {
        console.error('Error in ask_question flow', err);
        let errorMsg = '❌ Не удалось отправить вопрос.';
        if (err.message === 'NOT_IN_CONFERENCE') {
          errorMsg = '❌ Сначала присоединитесь к этой конференции через кнопку "➕ Присоединиться".';
        } else if (err.message && err.message.startsWith('VALIDATION_ERROR:')) {
          errorMsg = `❌ ${err.message.replace('VALIDATION_ERROR: ', '')}`;
        }
        await ctx.reply(errorMsg, { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'menu:main' }]] } });
      }
      return;
    }

    // Answer question flow (speaker)
    if (state && state.flow === 'answer_question' && state.step === 'enter_answer') {
      try {
        const user = await ensureUserFromTelegram(ctx.from);
        const { question } = await answerQuestion({
          speakerUser: user,
          conferenceCode: state.conferenceCode,
          questionId: state.questionId,
          answerText: text,
        });
        await clearUserState(ctx.from.id);
        await ctx.reply(
          `✅ Ваш ответ на вопрос сохранён:\n\n"${question.text}"\n\nОтвет: ${question.answer}`,
          await getMainMenu(ctx.from)
        );
      } catch (err) {
        console.error('Error in answer_question flow', err);
        let errorMsg = '❌ Не удалось сохранить ответ.';
        if (err.message === 'NOT_SPEAKER') {
          errorMsg = '❌ У вас нет роли спикера в этой конференции.';
        } else if (err.message === 'QUESTION_NOT_FOR_YOU') {
          errorMsg = '❌ Этот вопрос не для вас.';
        }
        await ctx.reply(errorMsg);
      }
      return;
    }

    // Edit conference flow
    if (state && state.flow === 'edit_conference' && state.step === 'enter_title') {
      try {
        const title = text.trim() !== '-' ? text.trim() : null;
        userState.set(ctx.from.id, { ...state, title, step: 'enter_description' });
        await ctx.reply(
          'Введите описание конференции (или "-" чтобы пропустить):',
          { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `admin:conf:${state.conferenceCode}` }]] } }
        );
        return;
      } catch (err) {
        console.error('Error in edit_conference flow', err);
        await ctx.reply('❌ Ошибка.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'menu:main' }]] } });
      }
      return;
    }

    if (state && state.flow === 'edit_conference' && state.step === 'enter_description') {
      try {
        const user = await ensureUserFromTelegram(ctx.from);
        const payload = {};
        if (state.title) payload.title = state.title;
        if (text.trim() !== '-') {
          payload.description = text.trim();
        }
        const conference = await updateConference({
          conferenceCode: state.conferenceCode,
          requestedByUser: user,
          payload,
        });
        await clearUserState(ctx.from.id);
        await ctx.reply(
          `✅ Конференция "${conference.title}" обновлена.`,
          await getMainMenu(ctx.from)
        );
      } catch (err) {
        console.error('Error in edit_conference flow', err);
        await ctx.reply('❌ Ошибка при обновлении конференции.');
      }
      return;
    }

    // Create poll flow (speaker/admin)
    if (state && state.flow === 'create_poll' && state.step === 'enter_question') {
      try {
        userState.set(ctx.from.id, { ...state, question: text, step: 'enter_options' });
        const cancelCallback = state.conferenceCode ? 
          `admin:polls:${state.conferenceCode}` : 
          `speaker:polls:conf:${state.conferenceCode}`;
        await ctx.reply(
          'Введите варианты ответов через запятую (например: Да, Нет, Не знаю):',
          { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: cancelCallback }]] } }
        );
        return;
      } catch (err) {
        console.error('Error in create_poll flow', err);
        await ctx.reply('❌ Ошибка.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'menu:main' }]] } });
      }
      return;
    }

    if (state && state.flow === 'create_poll' && state.step === 'enter_options') {
      try {
        const user = await ensureUserFromTelegram(ctx.from);
        const options = text.split(',').map((s) => s.trim()).filter(Boolean);
        if (options.length < 2) {
          await ctx.reply('❌ Нужно минимум 2 варианта ответа.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: cancelCallback }]] } });
          return;
        }
        if (options.length > 10) {
          await ctx.reply('❌ Максимум 10 вариантов ответа.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: cancelCallback }]] } });
          return;
        }
        const { poll } = await createPoll({
          moderatorUser: user,
          conferenceCode: state.conferenceCode,
          payload: {
            question: state.question,
            options: options.map((text) => ({ text })),
          },
        });
        await clearUserState(ctx.from.id);
        await ctx.reply(
          `✅ Опрос создан:\n\n${poll.question}\n\nВарианты: ${options.join(', ')}`,
          await getMainMenu(ctx.from)
        );
      } catch (err) {
        console.error('Error in create_poll flow', err);
        let errorMsg = '❌ Ошибка при создании опроса.';
        if (err.message && err.message.startsWith('VALIDATION_ERROR:')) {
          errorMsg = `❌ ${err.message.replace('VALIDATION_ERROR: ', '')}`;
        }
        await ctx.reply(errorMsg, { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `ask:conf:${state.conferenceCode}` }]] } });
      }
      return;
    }

    // Edit poll flow
    if (state && state.flow === 'edit_poll' && state.step === 'enter_question') {
      try {
        const user = await ensureUserFromTelegram(ctx.from);
        const payload = {};
        if (text.trim() !== '-') {
          payload.question = text.trim();
        }
        const { Poll } = require('../models/poll');
        const poll = await Poll.findById(joinState.pollId);
        if (!poll) {
          return ctx.reply('❌ Опрос не найден.');
        }
        const { Conference } = require('../models/conference');
        const conference = await Conference.findById(poll.conference);
        await updatePoll({
          moderatorUser: user,
          pollId: joinState.pollId,
          payload,
        });
        await clearUserState(ctx.from.id);
        await ctx.reply(
          `✅ Опрос обновлён.`,
          await getMainMenu(ctx.from)
        );
      } catch (err) {
        console.error('Error in edit_poll flow', err);
        const cancelCallback = state.conferenceCode ? 
          `admin:polls:${state.conferenceCode}` : 
          `speaker:polls:conf:${state.conferenceCode}`;
        await ctx.reply('❌ Ошибка при обновлении опроса.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: cancelCallback }]] } });
      }
      return;
    }

    // Assign admin flow
    if (state && state.flow === 'assign_admin' && state.step === 'enter_telegram_id') {
      try {
        const user = await ensureUserFromTelegram(ctx.from);
        if (!userIsMainAdmin(user)) {
          await ctx.reply('❌ Доступ запрещён.');
          await clearUserState(ctx.from.id);
          return;
        }

        const telegramId = text.trim();
        if (!/^\d+$/.test(telegramId)) {
          await ctx.reply('❌ Неверный формат Telegram ID. Введите число.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `admin:manage_admins:conf:${state.conferenceCode}` }]] } });
          return;
        }

        await assignConferenceAdmin({
          mainAdminUser: user,
          conferenceCode: state.conferenceCode,
          targetTelegramId: telegramId,
        });

        await clearUserState(ctx.from.id);
        await ctx.reply(
          `✅ Пользователь (ID: ${telegramId}) назначен администратором конференции.`,
          { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: `admin:manage_admins:conf:${state.conferenceCode}` }]] } }
        );
      } catch (err) {
        console.error('Error in assign_admin flow', err);
        let errorMsg = '❌ Ошибка при назначении администратора.';
        if (err.message === 'TARGET_USER_NOT_FOUND') {
          errorMsg = '❌ Пользователь с таким Telegram ID не найден. Пользователь должен сначала использовать бота.';
        } else if (err.message === 'CONFERENCE_NOT_FOUND') {
          errorMsg = '❌ Конференция не найдена.';
        } else if (err.message === 'ACCESS_DENIED') {
          errorMsg = '❌ Доступ запрещён.';
        }
        await ctx.reply(errorMsg, { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `admin:manage_admins:conf:${state.conferenceCode}` }]] } });
      }
      return;
    }

    // Set slide flow
    if (state && state.flow === 'set_slide' && state.step === 'enter_url') {
      try {
        const user = await ensureUserFromTelegram(ctx.from);
        const parts = text.split(' ').filter(Boolean);
        const url = parts[0];
        const title = parts.slice(1).join(' ') || '';
        
        await setSlide({
          moderatorUser: user,
          conferenceCode: state.conferenceCode,
          url,
          title,
        });
        await clearUserState(ctx.from.id);
        await ctx.reply(
          `✅ Слайд обновлён для конференции. Он появится на втором экране.`,
          { reply_markup: { inline_keyboard: [[{ text: '◀️ Назад', callback_data: `admin:slides:${state.conferenceCode}` }]] } }
        );
      } catch (err) {
        console.error('Error in set_slide flow', err);
        await ctx.reply('❌ Ошибка при установке слайда.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `admin:slides:${state.conferenceCode}` }]] } });
      }
      return;
    }

    // Request meeting flow - enter date manually
    if (state && state.flow === 'request_meeting' && state.step === 'enter_date_manual') {
      try {
        // Parse date: DD.MM.YYYY or DD.MM (assumes current year)
        let match = text.trim().match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/);
        if (!match) {
          await ctx.reply('❌ Неверный формат даты. Используйте: ДД.ММ.ГГГГ или ДД.ММ\nНапример: 25.12.2024 или 25.12', { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `meeting:request:${state.conferenceCode}` }]] } });
          return;
        }

        const [, day, month, year] = match;
        const currentYear = new Date().getFullYear();
        const selectedYear = year ? parseInt(year) : currentYear;
        const selectedDate = new Date(selectedYear, parseInt(month) - 1, parseInt(day));
        
        if (isNaN(selectedDate.getTime())) {
          await ctx.reply('❌ Неверная дата.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `meeting:request:${state.conferenceCode}` }]] } });
          return;
        }

        selectedDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
          await ctx.reply('❌ Нельзя выбрать прошедшую дату.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `meeting:request:${state.conferenceCode}` }]] } });
          return;
        }

        userState.set(ctx.from.id, { ...state, selectedDate: selectedDate.toISOString(), step: 'enter_time' });
        await ctx.reply(
          `✅ Дата выбрана: ${selectedDate.toLocaleDateString('ru-RU')}\n\n⏰ Введите время встречи в формате ЧЧ:ММ\nНапример: 14:30`,
          { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `meeting:request:${state.conferenceCode}` }]] } }
        );
        return;
      } catch (err) {
        console.error('Error in enter_date_manual flow', err);
        await ctx.reply('❌ Ошибка при обработке даты.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `meeting:request:${state.conferenceCode}` }]] } });
        return;
      }
    }

    // Request meeting flow - enter time (after date was selected)
    if (state && state.flow === 'request_meeting' && state.step === 'enter_time' && state.selectedDate) {
      try {
        // Parse time: HH:MM
        const match = text.trim().match(/^(\d{1,2}):(\d{2})$/);
        if (!match) {
          await ctx.reply('❌ Неверный формат времени. Используйте: ЧЧ:ММ\nНапример: 14:30', { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `meeting:request:${state.conferenceCode}` }]] } });
          return;
        }

        const [, hour, minute] = match;
        const hourNum = parseInt(hour);
        const minuteNum = parseInt(minute);
        
        if (hourNum < 0 || hourNum > 23 || minuteNum < 0 || minuteNum > 59) {
          await ctx.reply('❌ Неверное время. Часы: 0-23, минуты: 0-59.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `meeting:request:${state.conferenceCode}` }]] } });
          return;
        }

        // Parse the selected date (stored as ISO string)
        // Important: When we parse an ISO string, it's interpreted as UTC
        // But we want to interpret user input as local server time
        // So we need to extract the date components and create a new Date in local timezone
        const baseDate = new Date(state.selectedDate);
        
        // Get date components in local timezone to avoid UTC interpretation issues
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();
        const day = baseDate.getDate();
        
        // Create a new Date in local timezone with the specified date and time
        // This ensures the time is interpreted as local server time, not UTC
        const proposedTime = new Date(year, month, day, hourNum, minuteNum, 0, 0);
        
        // Log for debugging (can be removed in production)
        const serverTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
        console.log(`[Meeting Time] User input: ${hourNum}:${minuteNum.toString().padStart(2, '0')}, Server TZ: ${serverTZ}, Local: ${proposedTime.toLocaleString('ru-RU', { timeZone: serverTZ })}, UTC: ${proposedTime.toISOString()}`);

        if (isNaN(proposedTime.getTime())) {
          await ctx.reply('❌ Неверная дата или время.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `meeting:request:${state.conferenceCode}` }]] } });
          return;
        }

        const { requestMeeting } = require('../services/meeting.service');
        const { meeting } = await requestMeeting({
          telegramUser: ctx.from,
          conferenceCode: state.conferenceCode,
          recipientProfileId: state.recipientProfileId,
          proposedTime,
          durationMinutes: 30,
        });

        await clearUserState(ctx.from.id);
        await ctx.reply(
          `✅ Запрос на встречу отправлен!\n\nВремя: ${proposedTime.toLocaleString('ru-RU')}\nДлительность: 30 минут`,
          await getMainMenu(ctx.from)
        );
      } catch (err) {
        console.error('Error in request_meeting flow', err);
        let errorMsg = '❌ Ошибка при создании запроса на встречу.';
        if (err.message === 'TIME_CONFLICT') {
          errorMsg = '❌ У вас или у получателя уже есть встреча в это время.';
        } else if (err.message === 'INVALID_TIME_PAST') {
          errorMsg = '❌ Нельзя запланировать встречу в прошлом.';
        } else if (err.message === 'RECIPIENT_NOT_FOUND') {
          errorMsg = '❌ Получатель не найден.';
        }
        await ctx.reply(errorMsg, { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: `meeting:request:${state.conferenceCode}` }]] } });
      }
      return;
    }

    // Update profile flow
    if (state && state.flow === 'update_profile') {
      try {
        const { getGlobalProfile, updateGlobalProfile } = require('../services/profile.service');
        const field = state.field;
        let updates = {};
        
        if (field === 'name') {
          const parts = text.trim().split(/\s+/);
          if (parts.length < 1) {
            await ctx.reply('❌ Пожалуйста, введите хотя бы имя.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'menu:main' }]] } });
            return;
          }
          const firstName = parts[0];
          const lastName = parts.slice(1).join(' ') || '';
          updates = { firstName, lastName };
        } else if (field === 'interests') {
          let interests = [];
          if (text.trim() !== '-' && text.trim() !== '') {
            interests = text.split(',').map((s) => s.trim()).filter(Boolean);
          }
          updates = { interests };
        } else if (field === 'offerings') {
          let offerings = [];
          if (text.trim() !== '-' && text.trim() !== '') {
            offerings = text.split(',').map((s) => s.trim()).filter(Boolean);
          }
          updates = { offerings };
        } else if (field === 'lookingFor') {
          let lookingFor = [];
          if (text.trim() !== '-' && text.trim() !== '') {
            lookingFor = text.split(',').map((s) => s.trim()).filter(Boolean);
          }
          updates = { lookingFor };
        }
        
        await updateGlobalProfile(ctx.from.id, updates);
        await clearUserState(ctx.from.id);
        await ctx.reply(
          `✅ Профиль обновлён!`,
          await getMainMenu(ctx.from)
        );
      } catch (err) {
        console.error('Error in update_profile flow', err);
        const { formatErrorMessage } = require('../services/handler.service');
        const errorMsg = formatErrorMessage(err);
        await ctx.reply(`❌ ${errorMsg}`, { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'menu:main' }]] } });
      }
      return;
    }

    // Create conference flow
    if (state && state.flow === 'create_conference' && state.step === 'enter_title') {
      try {
        const user = await ensureUserFromTelegram(ctx.from);
        const conference = await createConference({
          createdByUser: user,
          payload: { title: text, description: '' },
        });
        await clearUserState(ctx.from.id);
        await ctx.reply(
          `✅ Конференция создана!\n\nНазвание: ${conference.title}\nКод: ${conference.conferenceCode}`,
          await getMainMenu(ctx.from)
        );
      } catch (err) {
        console.error('Error in create_conference flow', err);
        await ctx.reply('❌ Ошибка при создании конференции.', { reply_markup: { inline_keyboard: [[{ text: '◀️ Отмена', callback_data: 'menu:main_admin' }]] } });
      }
      return;
    }

    // If we reach here, user has state but text doesn't match any flow
    // This shouldn't happen, but let's handle it gracefully
    await ctx.reply(
      'ℹ️ Не удалось обработать ваш запрос. Состояние сброшено.\n\nИспользуйте меню для выбора действия.',
      await getMainMenu(ctx.from)
    );
    await clearUserState(ctx.from.id);
  });

  bot.launch().then(() => {
    console.log('Telegram bot started with button-based UI');
  });

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

function getBotInstance() {
  return botInstance;
}

module.exports = {
  initBot,
  getBotInstance,
};

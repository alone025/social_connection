const { Telegraf } = require('telegraf');

let botInstance;

function initBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN is not set, Telegram bot will not start');
    return;
  }

  const bot = new Telegraf(token);
  botInstance = bot;

  bot.start((ctx) => {
    ctx.reply('👋 Добро пожаловать на конференционный нетворкинг-бот! Профиль и матчинги будут добавлены позже.');
  });

  bot.command('ping', (ctx) => ctx.reply('pong'));

  bot.launch().then(() => {
    console.log('Telegram bot started');
  });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

function getBot() {
  return botInstance;
}

module.exports = {
  initBot,
  getBot,
};



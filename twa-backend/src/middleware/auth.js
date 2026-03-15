const crypto = require('crypto');

/**
 * Verify Telegram Web App initData signature.
 * Returns the parsed user object if valid, throws otherwise.
 */
function verifyInitData(initData, botToken) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (calculatedHash !== hash) throw new Error('Invalid initData signature');

  const userStr = urlParams.get('user');
  if (!userStr) throw new Error('No user in initData');
  return JSON.parse(userStr);
}

/**
 * Express middleware that validates the TWA initData or uses X-Telegram-Id in development.
 */
function authMiddleware(req, res, next) {
  // Development bypass: allow X-Telegram-Id header directly
  if (process.env.NODE_ENV === 'development') {
    const devId = req.headers['x-telegram-id'];
    if (devId) {
      req.user = { id: devId, telegramId: devId };
      return next();
    }
  }

  const initData = req.headers['x-telegram-init-data'];
  if (!initData) {
    return res.status(401).json({ error: 'Missing authentication header' });
  }

  try {
    const tgUser = verifyInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
    req.user = { ...tgUser, telegramId: String(tgUser.id) };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid Telegram auth: ' + err.message });
  }
}

module.exports = { authMiddleware, verifyInitData };

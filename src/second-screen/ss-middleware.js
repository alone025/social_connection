function requireSecondScreenKey(req, res, next) {
  const configuredKey = process.env.SECOND_SCREEN_API_KEY;

  if (!configuredKey) {
    console.warn('SECOND_SCREEN_API_KEY is not configured. Second screen protection is effectively disabled.');
    return res.status(500).json({ error: 'Second screen API key is not configured' });
  }

  // Check both header (for API clients) and query param (for web pages)
  const key = req.header('X-SECOND-SCREEN-KEY') || req.query.key;

  if (!key || key !== configuredKey) {
    return res.status(401).json({ error: 'Invalid second screen key' });
  }

  next();
}

module.exports = {
  requireSecondScreenKey,
};



const express = require('express');
const { handleAuth, getDashboardData, handleUpdateProfile, getParticipants } = require('./handlers');

const router = express.Router();

/**
 * Middleware to verify TWA user (simple version for now)
 */
function twaAuthMiddleware(req, res, next) {
  // In a real app, this would check a JWT or verify initData
  // For now, we expect X-Telegram-Id header (in dev) or validated req.body.user from auth
  const telegramId = req.headers['x-telegram-id'];
  if (!telegramId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = { telegramId };
  next();
}

// Public route for authentication
router.post('/auth', handleAuth);

// Protected routes
router.get('/dashboard', twaAuthMiddleware, getDashboardData);
router.post('/profile', twaAuthMiddleware, handleUpdateProfile);
router.get('/participants', twaAuthMiddleware, getParticipants);

module.exports = {
  twaApiRouter: router,
};

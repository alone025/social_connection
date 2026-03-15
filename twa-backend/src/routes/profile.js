const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

/**
 * GET /profile
 * Returns the current user's full profile.
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ profile: user });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /profile
 * Create or update the user's global profile.
 * Body: all profile fields
 */
router.post('/', authMiddleware, async (req, res) => {
  const allowedFields = [
    'firstName', 'lastName', 'bio', 'about', 'lookingFor',
    'company', 'position', 'country', 'region', 'city',
    'email', 'phone', 'telegram', 'whatsapp',
    'interests', 'avatarUrl', 'onboardingCompleted',
  ];

  const updateData = {};
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) updateData[key] = req.body[key];
  }

  try {
    const user = await User.findOneAndUpdate(
      { telegramId: req.user.telegramId },
      { $set: updateData },
      { new: true }
    );
    res.json({ success: true, profile: user });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

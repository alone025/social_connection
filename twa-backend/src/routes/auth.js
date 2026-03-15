const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const Conference = require('../models/Conference');
const Participant = require('../models/Participant');
const { verifyInitData } = require('../middleware/auth');

/**
 * POST /auth
 * Body: { initData }
 * Returns: { user, profile, conferences }
 */
router.post('/', async (req, res) => {
  const { initData } = req.body;
  if (!initData) return res.status(400).json({ error: 'initData is required' });

  let tgUser;
  try {
    // In development with no real bot token, accept any initData
    if (process.env.NODE_ENV === 'development' && !process.env.TELEGRAM_BOT_TOKEN) {
      tgUser = JSON.parse(new URLSearchParams(initData).get('user') || '{}');
      if (!tgUser.id) tgUser = { id: '12345', first_name: 'Dev', last_name: 'User', username: 'dev_user' };
    } else {
      tgUser = verifyInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
    }
  } catch (err) {
    return res.status(401).json({ error: 'Invalid Telegram auth: ' + err.message });
  }

  try {
    // Upsert user from Telegram identity
    const user = await User.findOneAndUpdate(
      { telegramId: String(tgUser.id) },
      {
        $set: {
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          username: tgUser.username,
        },
        $setOnInsert: { telegramId: String(tgUser.id) },
      },
      { upsert: true, new: true }
    );

    // Find conferences the user participates in
    const participations = await Participant.find({ user: user._id })
      .populate('conference')
      .sort({ createdAt: -1 });

    const conferences = participations.map(p => {
      const conf = p.conference;
      const accessPhase = conf.getAccessPhase(user);
      return {
        id: conf._id,
        code: conf.code,
        name: conf.name,
        description: conf.description,
        startsAt: conf.startsAt,
        endsAt: conf.endsAt,
        isActive: conf.isActive,
        accessPhase,
      };
    });

    res.json({
      user: {
        id: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      },
      profile: {
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        bio: user.bio,
        about: user.about,
        lookingFor: user.lookingFor,
        company: user.company,
        position: user.position,
        country: user.country,
        region: user.region,
        city: user.city,
        email: user.email,
        phone: user.phone,
        telegram: user.telegram,
        whatsapp: user.whatsapp,
        interests: user.interests,
        avatarUrl: user.avatarUrl,
        onboardingCompleted: user.onboardingCompleted,
        isIncomplete: !user.onboardingCompleted,
      },
      conferences,
    });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

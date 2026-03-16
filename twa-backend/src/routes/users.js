const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

/**
 * GET /api/users
 * Returns a list of users who have completed onboarding.
 * Used for global networking when not in a conference.
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search } = req.query;
    
    let query = { 
      onboardingCompleted: true,
      telegramId: { $ne: req.user.telegramId } // Don't show self
    };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { position: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } },
        { interests: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const users = await User.find(query).limit(50).sort({ updatedAt: -1 });
    
    const mapped = users.map(u => ({
      id: u._id,
      userId: u.telegramId,
      displayName: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
      role: u.position || 'Member',
      company: u.company,
      bio: u.bio,
      interests: u.interests,
      avatarUrl: u.avatarUrl,
      isRestricted: false // Global search shows public info
    }));

    res.json({ users: mapped });
  } catch (err) {
    console.error('Get users search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

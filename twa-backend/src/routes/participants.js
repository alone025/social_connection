const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Participant = require('../models/Participant');
const Conference = require('../models/Conference');
const { authMiddleware } = require('../middleware/auth');

/**
 * GET /participants?conferenceCode=X
 * Returns participants for the conference with access-based filtering.
 */
router.get('/', authMiddleware, async (req, res) => {
  const { conferenceCode } = req.query;
  if (!conferenceCode) return res.status(400).json({ error: 'conferenceCode is required' });

  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    const conf = await Conference.findOne({ code: conferenceCode.toUpperCase() });
    if (!conf) return res.status(404).json({ error: 'Conference not found' });

    const accessPhase = conf.getAccessPhase(user);
    const isRestricted = accessPhase === 'payment_required';

    const participants = await Participant.find({
      conference: conf._id,
      isVisible: true,
    }).populate('user', 'firstName lastName username interests avatarUrl');

    const mapped = participants.map(p => {
      const u = p.user;
      if (isRestricted) {
        // Mask names and hide contact info
        return {
          id: p._id,
          displayName: u?.firstName ? `${u.firstName} ***` : 'Участник ***',
          role: p.role,
          isRestricted: true,
        };
      }
      return {
        id: p._id,
        userId: u?.telegramId,
        displayName: p.displayName || `${u?.firstName || ''} ${u?.lastName || ''}`.trim(),
        role: p.role,
        company: p.company,
        bio: p.bio,
        interests: p.interests?.length ? p.interests : u?.interests,
        avatarUrl: p.avatarUrl || u?.avatarUrl,
        isRestricted: false,
      };
    });

    res.json({ participants: mapped, accessPhase });
  } catch (err) {
    console.error('Get participants error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

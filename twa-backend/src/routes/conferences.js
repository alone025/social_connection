const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Conference = require('../models/Conference');
const Participant = require('../models/Participant');
const { authMiddleware } = require('../middleware/auth');
const crypto = require('crypto');

async function generateUniqueCode() {
  let code;
  let exists = true;
  while (exists) {
    code = crypto.randomBytes(3).toString('hex').toUpperCase();
    const found = await Conference.findOne({ code });
    if (!found) exists = false;
  }
  return code;
}

/**
 * GET /conferences
 * Returns all conferences the user is a participant of.
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });

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
        myRole: p.role,
        location: conf.location,
        day: conf.day,
        duration: conf.duration,
        repeat: conf.repeat,
        coverImage: conf.coverImage,
        tags: conf.tags,
        maxParticipants: conf.maxParticipants,
      };
    });

    res.json({ conferences });
  } catch (err) {
    console.error('Get conferences error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /
 * Body: { name, description, location, startsAt, endsAt, tags, maxParticipants, duration, repeat, day }
 * Creates a new conference.
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // SaaS Limits Check
    const activeConferencesCount = await Conference.countDocuments({ organizer: user._id, isActive: true });
    
    const LIMITS = {
      free: { maxActiveConferences: 1, maxParticipants: 50 },
      paid: { maxActiveConferences: 10, maxParticipants: 500 }
    };

    const userTier = user.hasPaidAccess ? 'paid' : 'free';
    const tierLimits = LIMITS[userTier];

    if (activeConferencesCount >= tierLimits.maxActiveConferences) {
      return res.status(403).json({ 
        error: `Limit reached. ${userTier} users can only have ${tierLimits.maxActiveConferences} active conference(s).` 
      });
    }

    const { 
      name, description, location, startsAt, endsAt, 
      tags, maxParticipants, duration, repeat, day 
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    const code = await generateUniqueCode();

    const conference = new Conference({
      code,
      name,
      description,
      location,
      startsAt,
      endsAt,
      tags,
      maxParticipants: Math.min(maxParticipants || tierLimits.maxParticipants, tierLimits.maxParticipants),
      duration,
      repeat,
      day,
      organizer: user._id
    });

    await conference.save();

    // Automatically join as organizer
    await Participant.create({
      user: user._id,
      conference: conference._id,
      role: 'organizer',
      displayName: `${user.firstName} ${user.lastName || ''}`.trim()
    });

    res.status(201).json({ success: true, conference });
  } catch (err) {
    console.error('Create conference error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /conferences/join
 * Body: { conferenceCode }
 * Joins an existing conference by code. Creates a Participant record.
 */
router.post('/join', authMiddleware, async (req, res) => {
  const { conferenceCode } = req.body;
  if (!conferenceCode) return res.status(400).json({ error: 'conferenceCode is required' });

  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const conf = await Conference.findOne({ code: conferenceCode.trim().toUpperCase() });
    if (!conf) return res.status(404).json({ error: 'Conference not found' });

    // Upsert participant
    const participant = await Participant.findOneAndUpdate(
      { user: user._id, conference: conf._id },
      { $setOnInsert: { user: user._id, conference: conf._id, displayName: `${user.firstName} ${user.lastName || ''}`.trim() } },
      { upsert: true, new: true }
    );

    const accessPhase = conf.getAccessPhase(user);

    res.json({
      success: true,
      conference: {
        id: conf._id,
        code: conf.code,
        name: conf.name,
        startsAt: conf.startsAt,
        endsAt: conf.endsAt,
        isActive: conf.isActive,
        accessPhase,
      },
    });
  } catch (err) {
    console.error('Join conference error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /conferences/:code
 * Get details of one conference.
 */
router.get('/:code', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    const conf = await Conference.findOne({ code: req.params.code.toUpperCase() })
      .populate('organizer', 'firstName lastName avatarUrl position company');
    
    if (!conf) return res.status(404).json({ error: 'Conference not found' });

    const accessPhase = conf.getAccessPhase(user);
    res.json({ conference: { ...conf.toObject(), accessPhase } });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');
const Conference = require('../models/Conference');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { authMiddleware } = require('../middleware/auth');

/**
 * GET /polls?conferenceCode=X
 */
router.get('/', authMiddleware, async (req, res) => {
  const { conferenceCode } = req.query;
  if (!conferenceCode) return res.status(400).json({ error: 'conferenceCode is required' });

  try {
    const conf = await Conference.findOne({ code: conferenceCode.toUpperCase() });
    if (!conf) return res.status(404).json({ error: 'Conference not found' });

    const polls = await Poll.find({ conference: conf._id }).sort({ createdAt: -1 });
    const user = await User.findOne({ telegramId: req.user.telegramId });

    const mapped = polls.map(p => {
      const totalVotes = p.options.reduce((s, o) => s + o.voters.length, 0);
      const options = p.options.map(o => ({
        id: o._id,
        text: o.text,
        votes: o.voters.length,
        percent: totalVotes > 0 ? Math.round(o.voters.length / totalVotes * 100) : 0,
        hasVoted: o.voters.some(v => v.toString() === user._id.toString()),
      }));
      return {
        id: p._id,
        question: p.question,
        isActive: p.isActive,
        totalVotes,
        options,
      };
    });

    res.json({ polls: mapped });
  } catch (err) {
    console.error('Get polls error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /polls/:pollId/vote
 * Body: { optionId }
 */
router.post('/:pollId/vote', authMiddleware, async (req, res) => {
  const { optionId } = req.body;
  if (!optionId) return res.status(400).json({ error: 'optionId is required' });

  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    const poll = await Poll.findById(req.params.pollId);
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    if (!poll.isActive) return res.status(400).json({ error: 'Poll is closed' });

    // Remove existing vote from all options (one vote per poll)
    for (const opt of poll.options) {
      opt.voters = opt.voters.filter(v => v.toString() !== user._id.toString());
    }

    // Add vote to selected option
    const target = poll.options.id(optionId);
    if (!target) return res.status(404).json({ error: 'Option not found' });
    target.voters.push(user._id);

    await poll.save();

    // Return updated totals
    const totalVotes = poll.options.reduce((s, o) => s + o.voters.length, 0);
    const options = poll.options.map(o => ({
      id: o._id,
      text: o.text,
      votes: o.voters.length,
      percent: totalVotes > 0 ? Math.round(o.voters.length / totalVotes * 100) : 0,
    }));

    res.json({ success: true, options, totalVotes });
  } catch (err) {
    console.error('Vote error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

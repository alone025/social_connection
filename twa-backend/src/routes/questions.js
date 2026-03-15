const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Conference = require('../models/Conference');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

/**
 * GET /questions?conferenceCode=X
 * Returns approved questions + the user's own pending questions.
 */
router.get('/', authMiddleware, async (req, res) => {
  const { conferenceCode } = req.query;
  if (!conferenceCode) return res.status(400).json({ error: 'conferenceCode is required' });

  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    const conf = await Conference.findOne({ code: conferenceCode.toUpperCase() });
    if (!conf) return res.status(404).json({ error: 'Conference not found' });

    const questions = await Question.find({
      conference: conf._id,
      $or: [
        { status: 'approved' },
        { askedBy: user._id }, // Include user's own questions regardless of status
      ],
    })
      .populate('askedBy', 'firstName lastName username')
      .sort({ votes: -1, createdAt: -1 });

    const mapped = questions.map(q => ({
      id: q._id,
      text: q.text,
      status: q.status,
      authorFirstName: q.askedBy?.firstName,
      authorName: `${q.askedBy?.firstName || ''} ${q.askedBy?.lastName || ''}`.trim(),
      isMyQuestion: q.askedBy?._id.toString() === user._id.toString(),
      upvotes: q.votes.length,
      hasUpvoted: q.votes.some(v => v.toString() === user._id.toString()),
      createdAt: q.createdAt,
    }));

    res.json({ questions: mapped });
  } catch (err) {
    console.error('Get questions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /questions
 * Body: { conferenceCode, text }
 */
router.post('/', authMiddleware, async (req, res) => {
  const { conferenceCode, text } = req.body;
  if (!conferenceCode || !text?.trim()) {
    return res.status(400).json({ error: 'conferenceCode and text are required' });
  }

  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    const conf = await Conference.findOne({ code: conferenceCode.toUpperCase() });
    if (!conf) return res.status(404).json({ error: 'Conference not found' });

    const question = await Question.create({
      conference: conf._id,
      askedBy: user._id,
      text: text.trim(),
      status: 'pending', // Goes through moderation
    });

    res.status(201).json({ success: true, question: { id: question._id, status: question.status } });
  } catch (err) {
    console.error('Ask question error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /questions/:id/upvote
 * Toggle upvote on a question.
 */
router.post('/:id/upvote', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const alreadyVoted = question.votes.some(v => v.toString() === user._id.toString());
    if (alreadyVoted) {
      question.votes = question.votes.filter(v => v.toString() !== user._id.toString());
    } else {
      question.votes.push(user._id);
    }
    await question.save();

    res.json({ success: true, upvotes: question.votes.length, hasUpvoted: !alreadyVoted });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

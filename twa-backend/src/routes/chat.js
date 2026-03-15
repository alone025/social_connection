const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const ChatRequest = require('../models/ChatRequest');
const User = require('../models/User');
const Conference = require('../models/Conference');
const { authMiddleware } = require('../middleware/auth');

/**
 * GET /chat/list?conferenceCode=X
 * Returns all accepted chat conversations for this user.
 * If conferenceCode is provided, scopes to that conference.
 */
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const me = await User.findOne({ telegramId: req.user.telegramId });

    const requestFilter = { status: 'accepted', $or: [{ from: me._id }, { to: me._id }] };
    if (req.query.conferenceCode) {
      const conf = await Conference.findOne({ code: req.query.conferenceCode.toUpperCase() });
      if (conf) requestFilter.conference = conf._id;
    }

    const accepted = await ChatRequest.find(requestFilter)
      .populate('from', 'firstName lastName username telegramId avatarUrl')
      .populate('to', 'firstName lastName username telegramId avatarUrl')
      .populate('conference', 'name code')
      .sort({ updatedAt: -1 });

    const chats = await Promise.all(accepted.map(async (req) => {
      const other = req.from._id.toString() === me._id.toString() ? req.to : req.from;

      // Get last message
      const lastMsg = await Message.findOne({
        $or: [
          { from: me._id, to: other._id },
          { from: other._id, to: me._id },
        ],
        conference: req.conference._id,
      }).sort({ createdAt: -1 });

      const unreadCount = await Message.countDocuments({
        from: other._id,
        to: me._id,
        conference: req.conference._id,
        isRead: false,
      });

      return {
        chatRequestId: req._id,
        conferenceCode: req.conference.code,
        conferenceName: req.conference.name,
        other: {
          id: other.telegramId,
          name: `${other.firstName} ${other.lastName || ''}`.trim(),
          username: other.username,
          avatarUrl: other.avatarUrl,
        },
        lastMessage: lastMsg ? { text: lastMsg.text, time: lastMsg.createdAt } : null,
        unreadCount,
      };
    }));

    res.json({ chats });
  } catch (err) {
    console.error('Get chats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /chat/messages?withTelegramId=X&conferenceCode=Y
 * Returns all messages between me and another user in a conference.
 */
router.get('/messages', authMiddleware, async (req, res) => {
  const { withTelegramId, conferenceCode } = req.query;
  if (!withTelegramId || !conferenceCode) {
    return res.status(400).json({ error: 'withTelegramId and conferenceCode are required' });
  }

  try {
    const me = await User.findOne({ telegramId: req.user.telegramId });
    const them = await User.findOne({ telegramId: withTelegramId });
    if (!them) return res.status(404).json({ error: 'User not found' });

    const conf = await Conference.findOne({ code: conferenceCode.toUpperCase() });
    if (!conf) return res.status(404).json({ error: 'Conference not found' });

    // Ensure they have an accepted chat request
    const hasAccess = await ChatRequest.findOne({
      conference: conf._id,
      status: 'accepted',
      $or: [
        { from: me._id, to: them._id },
        { from: them._id, to: me._id },
      ],
    });
    if (!hasAccess) return res.status(403).json({ error: 'No active chat session' });

    const messages = await Message.find({
      conference: conf._id,
      $or: [
        { from: me._id, to: them._id },
        { from: them._id, to: me._id },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(200);

    // Mark messages as read
    await Message.updateMany(
      { from: them._id, to: me._id, conference: conf._id, isRead: false },
      { $set: { isRead: true } }
    );

    const mapped = messages.map(m => ({
      id: m._id,
      text: m.text,
      fromSelf: m.from.toString() === me._id.toString(),
      time: m.createdAt,
    }));

    res.json({ messages: mapped });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /chat/message
 * Body: { toTelegramId, conferenceCode, text }
 */
router.post('/message', authMiddleware, async (req, res) => {
  const { toTelegramId, conferenceCode, text } = req.body;
  if (!toTelegramId || !conferenceCode || !text?.trim()) {
    return res.status(400).json({ error: 'toTelegramId, conferenceCode, and text are required' });
  }

  try {
    const me = await User.findOne({ telegramId: req.user.telegramId });
    const them = await User.findOne({ telegramId: toTelegramId });
    if (!them) return res.status(404).json({ error: 'Recipient not found' });

    const conf = await Conference.findOne({ code: conferenceCode.toUpperCase() });
    if (!conf) return res.status(404).json({ error: 'Conference not found' });

    // Verify accepted chat session
    const session = await ChatRequest.findOne({
      conference: conf._id,
      status: 'accepted',
      $or: [
        { from: me._id, to: them._id },
        { from: them._id, to: me._id },
      ],
    });
    if (!session) return res.status(403).json({ error: 'No active chat session' });

    const message = await Message.create({
      conference: conf._id,
      from: me._id,
      to: them._id,
      text: text.trim(),
    });

    res.status(201).json({ success: true, message: { id: message._id, time: message.createdAt } });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

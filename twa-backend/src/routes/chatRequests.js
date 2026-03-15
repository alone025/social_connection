const express = require('express');
const router = express.Router();
const ChatRequest = require('../models/ChatRequest');
const Conference = require('../models/Conference');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { authMiddleware } = require('../middleware/auth');

/**
 * POST /chat-requests/send
 * Body: { toTelegramId, conferenceCode, message? }
 * Send a chat request to another participant.
 */
router.post('/send', authMiddleware, async (req, res) => {
  const { toTelegramId, conferenceCode, message } = req.body;
  if (!toTelegramId || !conferenceCode) {
    return res.status(400).json({ error: 'toTelegramId and conferenceCode are required' });
  }

  try {
    const me = await User.findOne({ telegramId: req.user.telegramId });
    const them = await User.findOne({ telegramId: String(toTelegramId) });
    if (!them) return res.status(404).json({ error: 'User not found' });
    if (me._id.toString() === them._id.toString()) {
      return res.status(400).json({ error: 'Cannot send a request to yourself' });
    }

    const conf = await Conference.findOne({ code: conferenceCode.toUpperCase() });
    if (!conf) return res.status(404).json({ error: 'Conference not found' });

    // Check if request already exists
    const existing = await ChatRequest.findOne({
      conference: conf._id,
      $or: [
        { from: me._id, to: them._id },
        { from: them._id, to: me._id },
      ],
    });

    if (existing) {
      return res.status(409).json({
        error: 'Chat request already exists',
        status: existing.status,
        id: existing._id,
      });
    }

    const chatRequest = await ChatRequest.create({
      conference: conf._id,
      from: me._id,
      to: them._id,
      message: message?.trim(),
    });

    // Create a notification for the recipient
    await Notification.create({
      user: them._id,
      type: 'chat_request',
      title: 'Новый запрос на чат',
      body: `${me.firstName} ${me.lastName || ''} хочет начать с вами чат в конференции «${conf.name}»`.trim(),
      data: { chatRequestId: chatRequest._id, conferenceCode: conf.code },
    });

    res.status(201).json({ success: true, chatRequestId: chatRequest._id, status: 'pending' });
  } catch (err) {
    console.error('Send chat request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /chat-requests
 * Returns all chat requests for the current user (incoming + outgoing).
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const me = await User.findOne({ telegramId: req.user.telegramId });

    const requests = await ChatRequest.find({ $or: [{ from: me._id }, { to: me._id }] })
      .populate('from', 'firstName lastName username telegramId avatarUrl')
      .populate('to', 'firstName lastName username telegramId avatarUrl')
      .populate('conference', 'name code')
      .sort({ updatedAt: -1 });

    const mapped = requests.map(r => ({
      id: r._id,
      isMine: r.from._id.toString() === me._id.toString(),
      status: r.status,
      message: r.message,
      conference: { name: r.conference.name, code: r.conference.code },
      from: { name: `${r.from.firstName} ${r.from.lastName || ''}`.trim(), telegramId: r.from.telegramId, avatarUrl: r.from.avatarUrl },
      to: { name: `${r.to.firstName} ${r.to.lastName || ''}`.trim(), telegramId: r.to.telegramId, avatarUrl: r.to.avatarUrl },
      createdAt: r.createdAt,
    }));

    res.json({ requests: mapped });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /chat-requests/:id/accept
 */
router.post('/:id/accept', authMiddleware, async (req, res) => {
  try {
    const me = await User.findOne({ telegramId: req.user.telegramId });
    const chatRequest = await ChatRequest.findById(req.params.id)
      .populate('conference', 'name code')
      .populate('from', 'firstName lastName');

    if (!chatRequest) return res.status(404).json({ error: 'Request not found' });
    if (chatRequest.to.toString() !== me._id.toString()) {
      return res.status(403).json({ error: 'Not your request to accept' });
    }

    chatRequest.status = 'accepted';
    await chatRequest.save();

    // Notify the requester
    await Notification.create({
      user: chatRequest.from,
      type: 'request_accepted',
      title: 'Запрос принят!',
      body: `${me.firstName} принял ваш запрос на чат в «${chatRequest.conference.name}»`,
      data: { chatRequestId: chatRequest._id, conferenceCode: chatRequest.conference.code },
    });

    res.json({ success: true, status: 'accepted' });
  } catch (err) {
    console.error('Accept request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /chat-requests/:id/reject
 */
router.post('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const me = await User.findOne({ telegramId: req.user.telegramId });
    const chatRequest = await ChatRequest.findById(req.params.id).populate('from');
    if (!chatRequest) return res.status(404).json({ error: 'Request not found' });
    if (chatRequest.to.toString() !== me._id.toString()) {
      return res.status(403).json({ error: 'Not your request to reject' });
    }

    chatRequest.status = 'rejected';
    await chatRequest.save();

    await Notification.create({
      user: chatRequest.from._id,
      type: 'request_rejected',
      title: 'Запрос отклонён',
      body: `${me.firstName} отклонил ваш запрос на чат`,
      data: { chatRequestId: chatRequest._id },
    });

    res.json({ success: true, status: 'rejected' });
  } catch (err) {
    console.error('Reject request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

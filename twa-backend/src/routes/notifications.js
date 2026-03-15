const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

/**
 * GET /notifications
 * Returns the user's notifications, newest first.
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    const notifications = await Notification.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({ user: user._id, isRead: false });

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /notifications/:id/read
 * Mark a single notification as read.
 */
router.post('/:id/read', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user: user._id },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /notifications/read-all
 * Mark all notifications as read.
 */
router.post('/read-all', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    await Notification.updateMany({ user: user._id, isRead: false }, { $set: { isRead: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

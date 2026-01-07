const { validateChatToken, sendChatMessage } = require('../services/meetingChat.service');

function initMeetingChatSocket(io) {
  const meetingChatNamespace = io.of('/meeting-chat');

  meetingChatNamespace.use(async (socket, next) => {
    const { token } = socket.handshake.auth || {};
    
    if (!token) {
      return next(new Error('Token is required'));
    }

    try {
      const { meeting } = await validateChatToken({ token });
      socket.meetingId = meeting._id.toString();
      socket.token = token;
      next();
    } catch (err) {
      if (err.message === 'INVALID_TOKEN' || err.message === 'TOKEN_EXPIRED') {
        return next(new Error(err.message));
      }
      return next(new Error('Authentication failed'));
    }
  });

  meetingChatNamespace.on('connection', (socket) => {
    const room = `meeting-${socket.meetingId}`;
    socket.join(room);

    socket.on('send-message', async ({ text, telegramId }, callback) => {
      try {
        if (!text || !text.trim()) {
          return callback({ error: 'Message text is required' });
        }

        if (!telegramId) {
          return callback({ error: 'Telegram ID is required' });
        }

        // Create telegram user object from telegramId
        const telegramUser = { id: parseInt(telegramId, 10) };

        const { message } = await sendChatMessage({
          token: socket.token,
          telegramUser,
          text,
        });

        // Broadcast to all participants in the room
        meetingChatNamespace.to(room).emit('new-message', {
          id: message._id,
          text: message.text,
          sender: {
            id: message.sender._id,
            firstName: message.sender.firstName,
            lastName: message.sender.lastName,
            username: message.sender.username,
          },
          createdAt: message.createdAt,
        });

        callback({ success: true, messageId: message._id });
      } catch (err) {
        console.error('Error in send-message socket handler', err);
        callback({ error: err.message || 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      // Cleanup if needed
    });
  });
}

module.exports = {
  initMeetingChatSocket,
};

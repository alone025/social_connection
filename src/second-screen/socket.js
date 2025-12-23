const { Conference } = require('../models/conference');

function initSecondScreenSocket(io) {
  io.on('connection', (socket) => {
    // Expect auth data at connection time
    const { secondScreenKey } = socket.handshake.auth || {};

    const configuredKey = process.env.SECOND_SCREEN_API_KEY;
    if (!configuredKey || secondScreenKey !== configuredKey) {
      console.warn('Socket connection rejected due to invalid second screen key');
      socket.emit('error', 'Invalid second screen key');
      socket.disconnect(true);
      return;
    }

    socket.on('join-conference', async ({ code }) => {
      try {
        if (!code) {
          socket.emit('error', 'Conference code is required');
          return;
        }

        const conference = await Conference.findOne({ conferenceCode: code });
        if (!conference) {
          socket.emit('error', 'Conference not found');
          return;
        }

        const room = `conference-${conference._id.toString()}`;
        socket.join(room);
        socket.emit('joined-conference', { room, conferenceId: conference._id });
      } catch (err) {
        console.error('Error in join-conference socket handler', err);
        socket.emit('error', 'Internal server error');
      }
    });
  });
}

module.exports = {
  initSecondScreenSocket,
};



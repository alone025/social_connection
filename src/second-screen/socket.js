const { Conference } = require('../models/conference');
const { getConferenceIdByCode } = require('../lib/conference-helper');

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

        // Convert conferenceCode to conferenceId (ObjectId) for consistent usage
        const conferenceId = await getConferenceIdByCode(code);

        // Use conferenceId (ObjectId) for room naming
        const room = `conference-${conferenceId.toString()}`;
        socket.join(room);
        socket.emit('joined-conference', { room, conferenceId });
      } catch (err) {
        if (err.message === 'CONFERENCE_NOT_FOUND') {
          socket.emit('error', 'Conference not found');
          return;
        }
        console.error('Error in join-conference socket handler', err);
        socket.emit('error', 'Internal server error');
      }
    });
  });
}

module.exports = {
  initSecondScreenSocket,
};



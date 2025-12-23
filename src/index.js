require('dotenv').config();

const http = require('http');
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const { Server } = require('socket.io');

const { initBot } = require('./telegram/bot');
const { connectMongo } = require('./lib/mongo');
const { secondScreenRouter } = require('./second-screen/routes');
const { initSecondScreenSocket } = require('./second-screen/socket');
const { requireSecondScreenKey } = require('./second-screen/ss-middleware');

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  await connectMongo();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
  });

  // Protect all second-screen REST API endpoints
  app.use('/conference', requireSecondScreenKey, secondScreenRouter);

  const server = http.createServer(app);

  // Socket.IO
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  initSecondScreenSocket(io);

  // Telegram bot
  initBot();

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});



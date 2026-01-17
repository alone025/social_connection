// Load environment variables
// Support environment-specific files: .env.development, .env.staging, .env.production
const nodeEnv = process.env.NODE_ENV || 'development';
require('dotenv').config({ path: `.env.${nodeEnv}` });
require('dotenv').config(); // Fallback to .env if env-specific file doesn't exist

const http = require('http');
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const { Server } = require('socket.io');

const { validateEnvironment } = require('./lib/env-validation');

/**
 * Schedule job to check for meetings that are starting and notify participants
 */
function startMeetingNotificationScheduler() {
  const { notifyMeetingStarting } = require('./services/meeting.service');
  const { Meeting } = require('./models/meeting');

  // Check every minute for meetings that are starting
  setInterval(async () => {
    try {
      // Get current time - Date objects in JavaScript are always in UTC internally
      // MongoDB stores dates in UTC, and Date.getTime() returns milliseconds since epoch (UTC)
      // So comparisons using getTime() are timezone-independent
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);
      const oneMinuteFromNow = new Date(now.getTime() + 1 * 60 * 1000);

      // Find meetings that are starting now (within 1 minute window to avoid duplicates)
      // MongoDB stores dates in UTC, so proposedTime is in UTC
      const startingMeetings = await Meeting.find({
        status: 'accepted',
        proposedTime: {
          $gte: oneMinuteAgo,
          $lte: oneMinuteFromNow,
        },
        // Add a flag to track if notification was sent (optional - for now we rely on time window)
      })
        .populate('requester', 'firstName lastName telegramId')
        .populate('recipient', 'firstName lastName telegramId');

      for (const meeting of startingMeetings) {
        // Notify if meeting time is within 1 minute of now (just started or about to start)
        // getTime() returns milliseconds since epoch (UTC), so comparison is timezone-independent
        const timeUntilMeeting = meeting.proposedTime.getTime() - now.getTime();
        const serverTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
        console.log(`[Meeting Scheduler] Meeting time: ${meeting.proposedTime.toISOString()} (${meeting.proposedTime.toLocaleString('ru-RU', { timeZone: serverTZ })}), Now: ${now.toISOString()} (${now.toLocaleString('ru-RU', { timeZone: serverTZ })}), Diff: ${Math.round(timeUntilMeeting / 1000 / 60)} minutes`);
        if (Math.abs(timeUntilMeeting) <= 1 * 60 * 1000) {
          await notifyMeetingStarting({ meeting });
        }
      }
    } catch (err) {
      console.error('Error in meeting notification scheduler:', err);
    }
  }, 60 * 1000); // Check every minute

  console.log('✅ Meeting notification scheduler started');
}
const { initBot } = require('./telegram/bot');
const { connectMongo } = require('./lib/mongo');
const { secondScreenRouter } = require('./second-screen/routes');
const { initSecondScreenSocket } = require('./second-screen/socket');
const { requireSecondScreenKey } = require('./second-screen/ss-middleware');
const { secondScreenPageRouter } = require('./second-screen/page');
const { initMeetingChatSocket } = require('./meeting-chat/socket');
const { meetingChatPageRouter } = require('./meeting-chat/page');
const { organizerDashboardPageRouter } = require('./organizer-dashboard/page');
const { organizerAdminPageRouter } = require('./organizer-dashboard/admin');
const { organizerApiRouter } = require('./organizer-dashboard/api');
const { setIO } = require('./lib/realtime');

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  // Validate environment variables before starting
  validateEnvironment();

  await connectMongo();

  // Ensure default tariff plans exist
  const { ensureDefaultTariffPlans } = require('./services/limit.service');
  await ensureDefaultTariffPlans();

  // Start meeting notification scheduler
  startMeetingNotificationScheduler();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
  });

  // Second screen HTML (protected via ?key=...)
  app.use(secondScreenPageRouter);

  // Meeting chat HTML (protected via ?token=...)
  app.use(meetingChatPageRouter);

  // Organizer dashboard HTML - Reports only (protected via ?key=...&telegramId=...)
  app.use(organizerDashboardPageRouter);

  // Organizer admin panel HTML - Management interface (protected via ?key=...&telegramId=...)
  app.use(organizerAdminPageRouter);

  // Organizer dashboard API (protected via ?key=...&telegramId=...)
  app.use('/organizer-api', organizerApiRouter);

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
  initMeetingChatSocket(io);
  setIO(io);

  // Telegram bot
  initBot();

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  }); 

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use!`);
      console.error(`   Please stop the process using port ${PORT} or change PORT in .env`);
      console.error(`   On Windows, you can find and kill the process with:`);
      console.error(`   netstat -ano | findstr :${PORT}`);
      console.error(`   taskkill /F /PID <PID>\n`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});



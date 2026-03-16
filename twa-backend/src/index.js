require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { connectDB } = require('./config/db');

// Route handlers
const authRoutes = require('./routes/auth');
const conferenceRoutes = require('./routes/conferences');
const participantRoutes = require('./routes/participants');
const profileRoutes = require('./routes/profile');
const pollRoutes = require('./routes/polls');
const questionRoutes = require('./routes/questions');
const chatRoutes = require('./routes/chat');
const chatRequestRoutes = require('./routes/chatRequests');
const notificationRoutes = require('./routes/notifications');
const paymentRoutes = require('./routes/payment');
const userRoutes = require('./routes/users');

const PORT = 4000; // Match vite.config.js proxy target

async function bootstrap() {
  await connectDB();

  const app = express();

  // ── Middleware ──────────────────────────────────────────────────────────────
  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));

  app.use((req, res, next) => {
    console.log(`[DEBUG] Incoming: ${req.method} ${req.url} (Original: ${req.originalUrl})`);
    next();
  });

  // ── Health check ───────────────────────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.json({ ok: true, env: process.env.NODE_ENV || 'development', ts: new Date() });
  });

  // ── API Routes ─────────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  
  // Explicit test to see if we can reach this path at all
  app.post('/api/conferences/test', (req, res) => res.json({ ok: true, msg: 'Test successful' }));

  app.use('/api/conferences', (req, res, next) => {
    console.log(`[ROUTE MATCH] ${req.method} ${req.originalUrl} -> ${req.url}`);
    next();
  }, conferenceRoutes);
  app.use('/api/participants', participantRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/polls', pollRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/chat-requests', chatRequestRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/payment', paymentRoutes);
  app.use('/api/users', userRoutes);

  // ── 404 fallback ───────────────────────────────────────────────────────────
  app.use((req, res) => {
    console.log(`[404] ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
  });

  // ── Global error handler ───────────────────────────────────────────────────
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Unexpected server error' });
  });

  app.listen(PORT, () => {
    console.log(`\n🚀 TWA Backend running on http://localhost:${PORT}`);
    console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Health: http://localhost:${PORT}/health\n`);
    console.log('Available routes:');
    console.log('  POST /api/auth');
    console.log('  GET  /api/conferences');
    console.log('  POST /api/conferences/join');
    console.log('  GET  /api/participants?conferenceCode=X');
    console.log('  GET  /api/profile');
    console.log('  POST /api/profile');
    console.log('  GET  /api/polls?conferenceCode=X');
    console.log('  POST /api/polls/:pollId/vote');
    console.log('  GET  /api/questions?conferenceCode=X');
    console.log('  POST /api/questions');
    console.log('  POST /api/questions/:id/upvote');
    console.log('  GET  /api/chat/list');
    console.log('  GET  /api/chat/messages?withTelegramId=X&conferenceCode=Y');
    console.log('  POST /api/chat/message');
    console.log('  GET  /api/chat-requests');
    console.log('  POST /api/chat-requests/send');
    console.log('  POST /api/chat-requests/:id/accept');
    console.log('  POST /api/chat-requests/:id/reject');
    console.log('  GET  /api/notifications');
    console.log('  POST /api/notifications/:id/read');
    console.log('  POST /api/notifications/read-all');
    console.log('  POST /api/payment/initiate');
    console.log('  POST /api/payment/callback');
    console.log('  GET  /api/payment/status');
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

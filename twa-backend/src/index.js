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

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  await connectDB();

  const app = express();

  // ── Middleware ──────────────────────────────────────────────────────────────
  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));

  // ── Health check ───────────────────────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.json({ ok: true, env: process.env.NODE_ENV || 'development', ts: new Date() });
  });

  // ── API Routes ─────────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);            // POST /api/auth
  app.use('/api/conferences', conferenceRoutes); // GET, POST /api/conferences
  app.use('/api/participants', participantRoutes); // GET /api/participants
  app.use('/api/profile', profileRoutes);      // GET, POST /api/profile
  app.use('/api/polls', pollRoutes);           // GET, POST /api/polls
  app.use('/api/questions', questionRoutes);   // GET, POST /api/questions
  app.use('/api/chat', chatRoutes);            // GET, POST /api/chat/*
  app.use('/api/chat-requests', chatRequestRoutes); // POST /api/chat-requests/*
  app.use('/api/notifications', notificationRoutes); // GET, POST /api/notifications
  app.use('/api/payment', paymentRoutes);      // POST /api/payment/*

  // ── 404 fallback ───────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
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

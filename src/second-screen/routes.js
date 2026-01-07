const express = require('express');
const { Poll } = require('../models/poll');
const { Question } = require('../models/question');
const { Conference } = require('../models/conference');
const { getConferenceIdByCode } = require('../lib/conference-helper');

const router = express.Router();

// GET /conference/:code/polls
// Note: code is for UX only, internally we use conferenceId (ObjectId)
router.get('/:code/polls', async (req, res) => {
  try {
    const { code } = req.params;
    // Convert conferenceCode to conferenceId (ObjectId) for consistent DB queries
    const conferenceId = await getConferenceIdByCode(code);

    // Use conferenceId (ObjectId) for all database queries
    const polls = await Poll.find({
      conference: conferenceId,
      isActive: true,
    });

    res.json({ items: polls });
  } catch (err) {
    if (err.message === 'CONFERENCE_NOT_FOUND') {
      return res.status(404).json({ error: 'Conference not found' });
    }
    console.error('Error in /conference/:code/polls', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /conference/:code/questions
// Note: code is for UX only, internally we use conferenceId (ObjectId)
router.get('/:code/questions', async (req, res) => {
  try {
    const { code } = req.params;
    // Convert conferenceCode to conferenceId (ObjectId) for consistent DB queries
    const conferenceId = await getConferenceIdByCode(code);

    // Use conferenceId (ObjectId) for all database queries
    const questions = await Question.find({
      conference: conferenceId,
      status: 'approved',
    }).sort({ createdAt: 1 });

    res.json({ items: questions });
  } catch (err) {
    if (err.message === 'CONFERENCE_NOT_FOUND') {
      return res.status(404).json({ error: 'Conference not found' });
    }
    console.error('Error in /conference/:code/questions', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /conference/:code/stats
// Note: code is for UX only, internally we use conferenceId (ObjectId)
router.get('/:code/stats', async (req, res) => {
  try {
    const { code } = req.params;
    // Get conference for display data, but use conferenceId for queries
    const conference = await Conference.findOne({ conferenceCode: code }).select('_id conferenceCode title currentSlideUrl currentSlideTitle');
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }

    const conferenceId = conference._id;

    // Use conferenceId (ObjectId) for all database queries
    const pollCount = await Poll.countDocuments({ conference: conferenceId });
    const questionCount = await Question.countDocuments({ conference: conferenceId });

    res.json({
      conference: {
        id: conferenceId,
        code: conference.conferenceCode,
        title: conference.title,
        currentSlideUrl: conference.currentSlideUrl || null,
        currentSlideTitle: conference.currentSlideTitle || null,
      },
      stats: {
        polls: pollCount,
        questions: questionCount,
      },
    });
  } catch (err) {
    console.error('Error in /conference/:code/stats', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = {
  secondScreenRouter: router,
};



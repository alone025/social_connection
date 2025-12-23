const express = require('express');
const { Poll } = require('../models/poll');
const { Question } = require('../models/question');
const { Conference } = require('../models/conference');

const router = express.Router();

// GET /conference/:code/polls
router.get('/:code/polls', async (req, res) => {
  try {
    const { code } = req.params;
    const conference = await Conference.findOne({ conferenceCode: code });
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }

    const polls = await Poll.find({
      conference: conference._id,
      isActive: true,
    });

    res.json({ items: polls });
  } catch (err) {
    console.error('Error in /conference/:code/polls', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /conference/:code/questions
router.get('/:code/questions', async (req, res) => {
  try {
    const { code } = req.params;
    const conference = await Conference.findOne({ conferenceCode: code });
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }

    const questions = await Question.find({
      conference: conference._id,
    });

    res.json({ items: questions });
  } catch (err) {
    console.error('Error in /conference/:code/questions', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /conference/:code/stats
router.get('/:code/stats', async (req, res) => {
  try {
    const { code } = req.params;
    const conference = await Conference.findOne({ conferenceCode: code });
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }

    // Simple placeholder stats. Can be extended later.
    const pollCount = await Poll.countDocuments({ conference: conference._id });
    const questionCount = await Question.countDocuments({ conference: conference._id });

    res.json({
      conference: {
        id: conference._id,
        code: conference.conferenceCode,
        title: conference.title,
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



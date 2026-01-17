const express = require('express');
const { Conference } = require('../models/conference');
const { UserProfile } = require('../models/userProfile');
const { Poll } = require('../models/poll');
const { Question } = require('../models/question');
const { Meeting } = require('../models/meeting');
const { ensureUserFromTelegram, userIsMainAdmin, isConferenceAdminFor, updateConference, startConference, stopConference, createConference, listConferencesForUser, endConference } = require('../services/conference.service');
const { setSlide, clearSlide } = require('../services/slide.service');
const { getConferenceIdByCode } = require('../lib/conference-helper');
const { requireSecondScreenKey } = require('../second-screen/ss-middleware');

const router = express.Router();

// Helper middleware to get user without conference requirement
async function requireUser(req, res, next) {
  try {
    const telegramId = req.query.telegramId || req.body.telegramId;
    
    if (!telegramId) {
      return res.status(400).json({ error: 'Telegram ID is required' });
    }

    const user = await ensureUserFromTelegram({ id: parseInt(telegramId) });
    req.user = user;
    next();
  } catch (err) {
    console.error('Error in requireUser:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Middleware to check admin access for a conference
async function requireConferenceAdmin(req, res, next) {
  try {
    const { code } = req.params;
    const telegramId = req.query.telegramId || req.body.telegramId;
    
    if (!telegramId) {
      return res.status(400).json({ error: 'Telegram ID is required' });
    }

    const user = await ensureUserFromTelegram({ id: parseInt(telegramId) });
    const conference = await Conference.findOne({ conferenceCode: code });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }

    const isMainAdmin = userIsMainAdmin(user);
    const isAdmin = await isConferenceAdminFor({ user, conference });
    
    if (!isMainAdmin && !isAdmin) {
      return res.status(403).json({ error: 'Access denied. You must be a conference administrator.' });
    }

    req.user = user;
    req.conference = conference;
    next();
  } catch (err) {
    console.error('Error in requireConferenceAdmin:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// All routes require second screen key
router.use(requireSecondScreenKey);

// Routes that don't require conference code (user-level operations)
router.use('/user', requireUser);

// GET /organizer-api/user/conferences - List all conferences for user
router.get('/user/conferences', async (req, res) => {
  try {
    const conferences = await listConferencesForUser(req.user);
    
    res.json({
      items: conferences.map(c => ({
        id: c._id.toString(), // Convert ObjectId to string
        code: c.conferenceCode,
        title: c.title,
        description: c.description,
        access: c.access,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        isActive: c.isActive,
        isEnded: c.isEnded,
        createdAt: c.createdAt,
      })),
      total: conferences.length,
    });
  } catch (err) {
    console.error('Error in GET /user/conferences:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /organizer-api/user/conferences - Create new conference
router.post('/user/conferences', async (req, res) => {
  try {
    const { title, description, access, startsAt, endsAt } = req.body;
    
    const conference = await createConference({
      createdByUser: req.user,
      payload: { title, description, access, startsAt, endsAt },
    });

    // Auto-assign creator as admin
    const UserProfile = require('../models/userProfile');
    let profile = await UserProfile.findOne({
      telegramId: req.user.telegramId,
      conference: conference._id,
    });

    if (!profile) {
      profile = new UserProfile({
        telegramId: req.user.telegramId,
        conference: conference._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        username: req.user.username,
        isActive: true,
        roles: ['organizer'],
      });
      await profile.save();
    }

    conference.admins.push(profile._id);
    await conference.save();

    res.status(201).json({
      id: conference._id,
      code: conference.conferenceCode,
      title: conference.title,
      description: conference.description,
      access: conference.access,
      startsAt: conference.startsAt,
      endsAt: conference.endsAt,
    });
  } catch (err) {
    if (err.message === 'LIMIT_EXCEEDED') {
      return res.status(403).json({ 
        error: 'Limit exceeded',
        details: err.details,
      });
    }
    console.error('Error in POST /user/conferences:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Routes that require conference code and admin access
router.use('/:code', requireConferenceAdmin);

// GET /organizer-api/:code/conference - Get conference details
router.get('/:code/conference', async (req, res) => {
  try {
    const { conference } = req;
    const { getConferenceSubscription, getLimits } = require('../services/limit.service');
    
    // Get subscription and limits
    const subscription = await getConferenceSubscription(conference._id);
    const limits = await getLimits(null, conference._id);
    
    res.json({
      id: conference._id,
      code: conference.conferenceCode,
      title: conference.title,
      description: conference.description,
      access: conference.access,
      startsAt: conference.startsAt,
      endsAt: conference.endsAt,
      isActive: conference.isActive,
      isEnded: conference.isEnded,
      admins: conference.admins,
      currentSlideUrl: conference.currentSlideUrl,
      currentSlideTitle: conference.currentSlideTitle,
      subscription: subscription ? {
        id: subscription._id,
        planName: subscription.tariffPlan?.name || subscription.tariffPlan?.displayName,
        planId: subscription.tariffPlan?._id,
        status: subscription.status,
        endsAt: subscription.endsAt,
      } : null,
      limits,
    });
  } catch (err) {
    console.error('Error in GET /conference:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /organizer-api/:code/conference - Update conference settings
router.put('/:code/conference', async (req, res) => {
  try {
    const { code } = req.params;
    const updated = await updateConference({
      conferenceCode: code,
      requestedByUser: req.user,
      payload: req.body,
    });
    res.json({
      id: updated._id,
      code: updated.conferenceCode,
      title: updated.title,
      description: updated.description,
      access: updated.access,
      startsAt: updated.startsAt,
      endsAt: updated.endsAt,
      isActive: updated.isActive,
      isEnded: updated.isEnded,
    });
  } catch (err) {
    if (err.message === 'CONFERENCE_NOT_FOUND') {
      return res.status(404).json({ error: 'Conference not found' });
    }
    if (err.message === 'ACCESS_DENIED') {
      return res.status(403).json({ error: 'Access denied' });
    }
    console.error('Error in PUT /conference:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /organizer-api/:code/conference/start - Start conference
router.post('/:code/conference/start', async (req, res) => {
  try {
    const { code } = req.params;
    const updated = await startConference({
      conferenceCode: code,
      requestedByUser: req.user,
    });
    res.json({ success: true, conference: updated });
  } catch (err) {
    if (err.message === 'CONFERENCE_NOT_FOUND') {
      return res.status(404).json({ error: 'Conference not found' });
    }
    if (err.message === 'ACCESS_DENIED') {
      return res.status(403).json({ error: 'Access denied' });
    }
    console.error('Error in POST /conference/start:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /organizer-api/:code/conference/stop - Stop conference
router.post('/:code/conference/stop', async (req, res) => {
  try {
    const { code } = req.params;
    const updated = await stopConference({
      conferenceCode: code,
      requestedByUser: req.user,
    });
    res.json({ success: true, conference: updated });
  } catch (err) {
    if (err.message === 'CONFERENCE_NOT_FOUND') {
      return res.status(404).json({ error: 'Conference not found' });
    }
    if (err.message === 'ACCESS_DENIED') {
      return res.status(403).json({ error: 'Access denied' });
    }
    console.error('Error in POST /conference/stop:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /organizer-api/:code/conference/end - End/archive conference
router.post('/:code/conference/end', async (req, res) => {
  try {
    const { code } = req.params;
    const updated = await endConference({
      code,
      requestedByUser: req.user,
    });
    res.json({ success: true, conference: updated });
  } catch (err) {
    if (err.message === 'CONFERENCE_NOT_FOUND') {
      return res.status(404).json({ error: 'Conference not found' });
    }
    if (err.message === 'ACCESS_DENIED') {
      return res.status(403).json({ error: 'Access denied' });
    }
    console.error('Error in POST /conference/end:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /organizer-api/:code/conference/code - Update conference code
router.put('/:code/conference/code', async (req, res) => {
  try {
    const { code } = req.params;
    const { newCode } = req.body;

    if (!newCode || !/^[a-z0-9-]+$/.test(newCode)) {
      return res.status(400).json({ error: 'Invalid conference code format. Use lowercase letters, numbers, and hyphens only.' });
    }

    const conference = req.conference;
    
    // Check if new code is already taken
    const existing = await Conference.findOne({ conferenceCode: newCode });
    if (existing && existing._id.toString() !== conference._id.toString()) {
      return res.status(409).json({ error: 'Conference code already exists' });
    }

    conference.conferenceCode = newCode;
    await conference.save();

    res.json({
      id: conference._id,
      code: conference.conferenceCode,
    });
  } catch (err) {
    console.error('Error in PUT /conference/code:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /organizer-api/:code/slides - Get current slide
router.get('/:code/slides', async (req, res) => {
  try {
    const { conference } = req;
    res.json({
      url: conference.currentSlideUrl || null,
      title: conference.currentSlideTitle || null,
    });
  } catch (err) {
    console.error('Error in GET /slides:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /organizer-api/:code/slides - Set slide
router.post('/:code/slides', async (req, res) => {
  try {
    const { code } = req.params;
    const { url, title } = req.body;

    const updated = await setSlide({
      moderatorUser: req.user,
      conferenceCode: code,
      url,
      title,
    });

    res.json({
      url: updated.currentSlideUrl,
      title: updated.currentSlideTitle,
    });
  } catch (err) {
    if (err.message === 'CONFERENCE_NOT_FOUND') {
      return res.status(404).json({ error: 'Conference not found' });
    }
    if (err.message === 'ACCESS_DENIED') {
      return res.status(403).json({ error: 'Access denied' });
    }
    console.error('Error in POST /slides:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /organizer-api/:code/slides - Clear slide
router.delete('/:code/slides', async (req, res) => {
  try {
    const { code } = req.params;

    await clearSlide({
      moderatorUser: req.user,
      conferenceCode: code,
    });

    res.json({ success: true });
  } catch (err) {
    if (err.message === 'CONFERENCE_NOT_FOUND') {
      return res.status(404).json({ error: 'Conference not found' });
    }
    if (err.message === 'ACCESS_DENIED') {
      return res.status(403).json({ error: 'Access denied' });
    }
    console.error('Error in DELETE /slides:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /organizer-api/:code/participants - List all participants with filters
router.get('/:code/participants', async (req, res) => {
  try {
    const { conference } = req;
    const conferenceId = conference._id;
    const { role, isActive, onboardingCompleted, search } = req.query;
    
    // Build query
    const query = { conference: conferenceId };
    
    if (role) {
      query.roles = role;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (onboardingCompleted !== undefined) {
      query.onboardingCompleted = onboardingCompleted === 'true';
    }
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { telegramId: { $regex: search, $options: 'i' } },
      ];
    }
    
    const participants = await UserProfile.find(query)
      .sort({ createdAt: -1 })
      .select('_id telegramId firstName lastName username photoUrl roles isActive onboardingCompleted interests offerings lookingFor createdAt');

    res.json({
      items: participants.map(p => ({
        id: p._id.toString(), // Convert ObjectId to string
        telegramId: p.telegramId,
        firstName: p.firstName,
        lastName: p.lastName,
        username: p.username,
        photoUrl: p.photoUrl,
        roles: p.roles || [],
        isActive: p.isActive,
        onboardingCompleted: p.onboardingCompleted,
        interests: p.interests || [],
        offerings: p.offerings || [],
        lookingFor: p.lookingFor || [],
        createdAt: p.createdAt,
      })),
      total: participants.length,
    });
  } catch (err) {
    console.error('Error in GET /participants:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /organizer-api/:code/participants/:profileId - Update participant
router.put('/:code/participants/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;
    const { roles, isActive, firstName, lastName, interests, offerings, lookingFor } = req.body;

    const profile = await UserProfile.findById(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    // Verify profile belongs to this conference
    if (profile.conference.toString() !== req.conference._id.toString()) {
      return res.status(403).json({ error: 'Participant does not belong to this conference' });
    }

    if (roles !== undefined) {
      profile.roles = roles;
    }
    if (isActive !== undefined) {
      profile.isActive = isActive;
    }
    if (firstName !== undefined) {
      profile.firstName = firstName;
    }
    if (lastName !== undefined) {
      profile.lastName = lastName;
    }
    if (interests !== undefined) {
      profile.interests = interests;
    }
    if (offerings !== undefined) {
      profile.offerings = offerings;
    }
    if (lookingFor !== undefined) {
      profile.lookingFor = lookingFor;
    }

    await profile.save();

    res.json({
      id: profile._id,
      telegramId: profile.telegramId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      roles: profile.roles,
      isActive: profile.isActive,
      interests: profile.interests,
      offerings: profile.offerings,
      lookingFor: profile.lookingFor,
    });
  } catch (err) {
    console.error('Error in PUT /participants/:profileId:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /organizer-api/:code/polls - List all polls
router.get('/:code/polls', async (req, res) => {
  try {
    const { conference } = req;
    const conferenceId = conference._id;
    
    const polls = await Poll.find({ conference: conferenceId })
      .sort({ createdAt: -1 })
      .populate('options.voters', 'firstName lastName telegramId');

    res.json({
      items: polls.map(p => ({
        id: p._id.toString(), // Convert ObjectId to string
        question: p.question,
        options: p.options.map(opt => ({
          id: opt.id,
          text: opt.text,
          voteCount: opt.voters ? opt.voters.length : 0,
        })),
        isActive: p.isActive,
        createdAt: p.createdAt,
        totalVotes: p.options.reduce((sum, opt) => sum + (opt.voters ? opt.voters.length : 0), 0),
      })),
      total: polls.length,
    });
  } catch (err) {
    console.error('Error in GET /polls:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /organizer-api/:code/polls - Create poll
router.post('/:code/polls', async (req, res) => {
  try {
    const { conference } = req;
    const conferenceId = conference._id;
    const { question, options } = req.body;

    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'Question and at least 2 options are required' });
    }

    // Check if polls feature is enabled
    const { isFeatureEnabled, canCreatePoll } = require('../services/limit.service');
    const pollsEnabled = await isFeatureEnabled('pollsEnabled', conferenceId);
    
    if (!pollsEnabled) {
      return res.status(403).json({ 
        error: 'Polls feature is not available on your current plan. Please upgrade to enable this feature.' 
      });
    }
    
    // Check poll limit
    const limitCheck = await canCreatePoll(conferenceId);
    if (!limitCheck.allowed) {
      return res.status(403).json({ 
        error: `Poll limit exceeded. Maximum ${limitCheck.limit} polls allowed (current: ${limitCheck.current})` 
      });
    }

    const poll = new Poll({
      conference: conferenceId,
      question,
      options: options.map((text, index) => ({
        id: index + 1,
        text,
        voters: [],
      })),
      isActive: true,
    });

    await poll.save();

    res.status(201).json({
      id: poll._id,
      question: poll.question,
      options: poll.options,
      isActive: poll.isActive,
      createdAt: poll.createdAt,
    });
  } catch (err) {
    console.error('Error in POST /polls:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /organizer-api/:code/polls/:pollId - Update poll
router.put('/:code/polls/:pollId', async (req, res) => {
  try {
    const { pollId } = req.params;
    const { question, options, isActive } = req.body;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (poll.conference.toString() !== req.conference._id.toString()) {
      return res.status(403).json({ error: 'Poll does not belong to this conference' });
    }

    if (question !== undefined) poll.question = question;
    if (options !== undefined && Array.isArray(options)) {
      poll.options = options.map((text, index) => ({
        id: index + 1,
        text,
        voters: poll.options[index]?.voters || [],
      }));
    }
    if (isActive !== undefined) poll.isActive = isActive;

    await poll.save();

    res.json({
      id: poll._id,
      question: poll.question,
      options: poll.options,
      isActive: poll.isActive,
    });
  } catch (err) {
    console.error('Error in PUT /polls/:pollId:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /organizer-api/:code/polls/:pollId - Delete poll
router.delete('/:code/polls/:pollId', async (req, res) => {
  try {
    const { pollId } = req.params;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (poll.conference.toString() !== req.conference._id.toString()) {
      return res.status(403).json({ error: 'Poll does not belong to this conference' });
    }

    await Poll.deleteOne({ _id: poll._id });
    res.json({ success: true });
  } catch (err) {
    console.error('Error in DELETE /polls/:pollId:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /organizer-api/:code/questions - List all questions
router.get('/:code/questions', async (req, res) => {
  try {
    const { conference } = req;
    const conferenceId = conference._id;
    const { status } = req.query;
    
    const query = { conference: conferenceId };
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

    const questions = await Question.find(query)
      .populate('author', 'firstName lastName telegramId')
      .populate('targetSpeaker', 'firstName lastName telegramId')
      .sort({ createdAt: -1 });

    res.json({
      items: questions.map(q => ({
        id: q._id.toString(), // Convert ObjectId to string
        text: q.text,
        status: q.status,
        author: q.author ? {
          id: q.author._id.toString(), // Convert ObjectId to string
          firstName: q.author.firstName,
          lastName: q.author.lastName,
          telegramId: q.author.telegramId,
        } : null,
        targetSpeaker: q.targetSpeaker ? {
          id: q.targetSpeaker._id.toString(), // Convert ObjectId to string
          firstName: q.targetSpeaker.firstName,
          lastName: q.targetSpeaker.lastName,
        } : null,
        isAnswered: q.isAnswered,
        answer: q.answer,
        upvoters: q.upvoters || [],
        createdAt: q.createdAt,
      })),
      total: questions.length,
    });
  } catch (err) {
    console.error('Error in GET /questions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /organizer-api/:code/questions/:questionId - Moderate question (approve/reject) or mark as answered
router.put('/:code/questions/:questionId', async (req, res) => {
  try {
    const { questionId } = req.params;
    const { status, isAnswered } = req.body;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.conference.toString() !== req.conference._id.toString()) {
      return res.status(403).json({ error: 'Question does not belong to this conference' });
    }

    // Update status if provided
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      question.status = status;
    }

    // Update isAnswered if provided
    if (isAnswered !== undefined) {
      question.isAnswered = isAnswered === true;
    }

    await question.save();

    await question.populate('author', 'firstName lastName telegramId');
    await question.populate('targetSpeaker', 'firstName lastName telegramId');

    res.json({
      id: question._id.toString(),
      text: question.text,
      status: question.status,
      isAnswered: question.isAnswered,
      author: question.author ? {
        id: question.author._id.toString(),
        firstName: question.author.firstName,
        lastName: question.author.lastName,
        telegramId: question.author.telegramId,
      } : null,
      targetSpeaker: question.targetSpeaker ? {
        id: question.targetSpeaker._id.toString(),
        firstName: question.targetSpeaker.firstName,
        lastName: question.targetSpeaker.lastName,
      } : null,
    });
  } catch (err) {
    console.error('Error in PUT /questions/:questionId:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /organizer-api/:code/meetings - List all meetings
router.get('/:code/meetings', async (req, res) => {
  try {
    const { conference } = req;
    const conferenceId = conference._id;
    const { status } = req.query;
    
    const query = { conference: conferenceId };
    if (status && ['pending', 'accepted', 'rejected', 'cancelled', 'completed'].includes(status)) {
      query.status = status;
    }

    const meetings = await Meeting.find(query)
      .populate('requester', 'firstName lastName telegramId')
      .populate('recipient', 'firstName lastName telegramId')
      .sort({ createdAt: -1 });

    res.json({
      items: meetings.map(m => ({
        id: m._id.toString(),
        requester: m.requester ? {
          firstName: m.requester.firstName,
          lastName: m.requester.lastName,
          telegramId: m.requester.telegramId,
        } : null,
        recipient: m.recipient ? {
          firstName: m.recipient.firstName,
          lastName: m.recipient.lastName,
          telegramId: m.recipient.telegramId,
        } : null,
        proposedTime: m.proposedTime,
        durationMinutes: m.durationMinutes,
        status: m.status,
        message: m.message,
        createdAt: m.createdAt,
      })),
      total: meetings.length,
    });
  } catch (err) {
    console.error('Error in GET /meetings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /organizer-api/:code/meetings/:meetingId - Update meeting status
router.put('/:code/meetings/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'accepted', 'rejected', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required' });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (meeting.conference.toString() !== req.conference._id.toString()) {
      return res.status(403).json({ error: 'Meeting does not belong to this conference' });
    }

    meeting.status = status;
    await meeting.save();

    await meeting.populate('requester recipient');

    res.json({
      id: meeting._id.toString(),
      requester: meeting.requester ? {
        firstName: meeting.requester.firstName,
        lastName: meeting.requester.lastName,
        telegramId: meeting.requester.telegramId,
      } : null,
      recipient: meeting.recipient ? {
        firstName: meeting.recipient.firstName,
        lastName: meeting.recipient.lastName,
        telegramId: meeting.recipient.telegramId,
      } : null,
      proposedTime: meeting.proposedTime,
      durationMinutes: meeting.durationMinutes,
      status: meeting.status,
      message: meeting.message,
    });
  } catch (err) {
    console.error('Error in PUT /meetings/:meetingId:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /organizer-api/:code/export/:type - Export data as CSV
router.get('/:code/export/:type', async (req, res) => {
  try {
    const { conference } = req;
    const { type } = req.params;
    const conferenceId = conference._id;
    
    // Check if CSV export is enabled
    const { isFeatureEnabled } = require('../services/limit.service');
    const csvEnabled = await isFeatureEnabled('exportCsvEnabled', conferenceId);
    
    if (!csvEnabled) {
      return res.status(403).json({ 
        error: 'CSV export is not available on your current plan. Please upgrade to enable this feature.' 
      });
    }

    let csv = '';
    let filename = '';

    switch (type) {
      case 'participants': {
        const participants = await UserProfile.find({ conference: conferenceId })
          .sort({ createdAt: -1 });
        
        filename = `participants-${conference.conferenceCode}-${Date.now()}.csv`;
        csv = 'Telegram ID,First Name,Last Name,Username,Roles,Active,Onboarding Completed,Created At\n';
        
        participants.forEach(p => {
          const roles = (p.roles || []).join(';');
          const row = [
            p.telegramId || '',
            p.firstName || '',
            p.lastName || '',
            p.username || '',
            roles,
            p.isActive ? 'Yes' : 'No',
            p.onboardingCompleted ? 'Yes' : 'No',
            p.createdAt.toISOString(),
          ];
          csv += row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',') + '\n';
        });
        break;
      }

      case 'questions': {
        const questions = await Question.find({ conference: conferenceId })
          .populate('author', 'firstName lastName telegramId')
          .populate('targetSpeaker', 'firstName lastName')
          .sort({ createdAt: -1 });
        
        filename = `questions-${conference.conferenceCode}-${Date.now()}.csv`;
        csv = 'ID,Text,Status,Author Telegram ID,Author Name,Target Speaker,Answered,Created At\n';
        
        questions.forEach(q => {
          const authorName = q.author ? `${q.author.firstName || ''} ${q.author.lastName || ''}`.trim() : '';
          const targetSpeaker = q.targetSpeaker ? `${q.targetSpeaker.firstName || ''} ${q.targetSpeaker.lastName || ''}`.trim() : '';
          const row = [
            q._id,
            q.text,
            q.status,
            q.author ? q.author.telegramId : '',
            authorName,
            targetSpeaker,
            q.isAnswered ? 'Yes' : 'No',
            q.createdAt.toISOString(),
          ];
          csv += row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',') + '\n';
        });
        break;
      }

      case 'polls': {
        const polls = await Poll.find({ conference: conferenceId })
          .sort({ createdAt: -1 });
        
        filename = `polls-${conference.conferenceCode}-${Date.now()}.csv`;
        csv = 'ID,Question,Options,Total Votes,Active,Created At\n';
        
        polls.forEach(p => {
          const options = p.options.map(opt => `${opt.text} (${opt.voters.length} votes)`).join('; ');
          const totalVotes = p.options.reduce((sum, opt) => sum + (opt.voters ? opt.voters.length : 0), 0);
          const row = [
            p._id,
            p.question,
            options,
            totalVotes,
            p.isActive ? 'Yes' : 'No',
            p.createdAt.toISOString(),
          ];
          csv += row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',') + '\n';
        });
        break;
      }

      case 'meetings': {
        const meetings = await Meeting.find({ conference: conferenceId })
          .populate('requester', 'firstName lastName telegramId')
          .populate('recipient', 'firstName lastName telegramId')
          .sort({ createdAt: -1 });
        
        filename = `meetings-${conference.conferenceCode}-${Date.now()}.csv`;
        csv = 'ID,Requester Telegram ID,Requester Name,Recipient Telegram ID,Recipient Name,Status,Proposed Time,Created At\n';
        
        meetings.forEach(m => {
          const requesterName = m.requester ? `${m.requester.firstName || ''} ${m.requester.lastName || ''}`.trim() : '';
          const recipientName = m.recipient ? `${m.recipient.firstName || ''} ${m.recipient.lastName || ''}`.trim() : '';
          const row = [
            m._id,
            m.requester ? m.requester.telegramId : '',
            requesterName,
            m.recipient ? m.recipient.telegramId : '',
            recipientName,
            m.status,
            m.proposedTime ? m.proposedTime.toISOString() : '',
            m.createdAt.toISOString(),
          ];
          csv += row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',') + '\n';
        });
        break;
      }

      default:
        return res.status(400).json({ error: 'Invalid export type. Use: participants, questions, polls, or meetings' });
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // Add BOM for Excel UTF-8 support
  } catch (err) {
    console.error('Error in GET /export/:type:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /organizer-api/:code/tariffs - List available tariff plans
router.get('/:code/tariffs', async (req, res) => {
  try {
    const { TariffPlan } = require('../models/tariffPlan');
    const plans = await TariffPlan.find({ isActive: true }).sort({ pricePerMonth: 1 });
    
    res.json({
      items: plans.map(p => ({
        id: p._id.toString(),
        name: p.name,
        displayName: p.displayName,
        description: p.description,
        pricePerMonth: p.pricePerMonth,
        currency: p.currency,
        limits: p.limits,
        isDefault: p.isDefault,
      })),
      total: plans.length,
    });
  } catch (err) {
    console.error('Error in GET /tariffs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /organizer-api/:code/subscription - Assign or update subscription for conference
router.put('/:code/subscription', async (req, res) => {
  try {
    const { conference } = req;
    const { tariffPlanId, status, endsAt } = req.body;
    
    if (!tariffPlanId) {
      return res.status(400).json({ error: 'tariffPlanId is required' });
    }
    
    const { Subscription } = require('../models/subscription');
    const { TariffPlan } = require('../models/tariffPlan');
    
    // Verify tariff plan exists
    const tariffPlan = await TariffPlan.findById(tariffPlanId);
    if (!tariffPlan) {
      return res.status(404).json({ error: 'Tariff plan not found' });
    }
    
    // Find or create subscription
    let subscription = await Subscription.findOne({ conferenceId: conference._id });
    
    if (subscription) {
      // Update existing subscription
      subscription.tariffPlan = tariffPlanId;
      if (status !== undefined) subscription.status = status;
      if (endsAt !== undefined) subscription.endsAt = endsAt ? new Date(endsAt) : null;
      await subscription.save();
    } else {
      // Create new subscription
      subscription = new Subscription({
        conferenceId: conference._id,
        tariffPlan: tariffPlanId,
        status: status || 'active',
        startsAt: new Date(),
        endsAt: endsAt ? new Date(endsAt) : null,
      });
      await subscription.save();
    }
    
    await subscription.populate('tariffPlan');
    
    res.json({
      id: subscription._id.toString(),
      planName: subscription.tariffPlan.displayName,
      planId: subscription.tariffPlan._id.toString(),
      status: subscription.status,
      startsAt: subscription.startsAt,
      endsAt: subscription.endsAt,
    });
  } catch (err) {
    console.error('Error in PUT /subscription:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = {
  organizerApiRouter: router,
};

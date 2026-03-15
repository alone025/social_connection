const crypto = require('crypto');
const { ensureUserFromTelegram } = require('../services/conference.service');
const { getGlobalProfile, updateGlobalProfile } = require('../services/profile.service');
const { listConferencesForUser, getConferenceById } = require('../services/conference.service');
const { getAccessPhase, filterProfileByAccess, ACCESS_PHASES } = require('../services/access.service');
const { UserProfile } = require('../models/userProfile');
const { Conference } = require('../models/conference');

/**
 * Verify Telegram Web App initData
 * @param {string} initData - Raw initData from Telegram.WebApp
 * @param {string} botToken - Telegram Bot Token
 * @returns {Object|null} - User data if valid, null otherwise
 */
function verifyInitData(initData, botToken) {
  if (!initData) return null;

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  const dataCheckString = Array.from(urlParams.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (calculatedHash !== hash) return null;

  try {
    const userStr = urlParams.get('user');
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
}

/**
 * Handle TWA Authentication
 */
async function handleAuth(req, res) {
  const { initData } = req.body;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  const tgUser = verifyInitData(initData, botToken);
  if (!tgUser) {
    return res.status(401).json({ error: 'Invalid authentication data' });
  }

  try {
    const user = await ensureUserFromTelegram(tgUser);
    const profile = await getGlobalProfile(user.telegramId);

    res.json({
      user: {
        id: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      },
      profile: profile || { 
        firstName: user.firstName, 
        lastName: user.lastName, 
        username: user.username,
        onboardingCompleted: false,
        isIncomplete: true // Flag for TWA to show confirmation
      },
      token: 'mock-session-token', 
    });
  } catch (err) {
    console.error('TWA Auth Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get User Dashboard Data
 */
async function getDashboardData(req, res) {
  const { telegramId } = req.user;

  try {
    const user = await ensureUserFromTelegram({ id: telegramId });
    const conferences = await listConferencesForUser(user);
    
    // Get access phase for each conference
    const enrichedConferences = await Promise.all(conferences.map(async (c) => {
      const userProfile = await UserProfile.findOne({ telegramId: user.telegramId, conference: c._id });
      const accessPhase = getAccessPhase(c, userProfile);
      
      return {
        id: c._id,
        code: c.conferenceCode,
        title: c.title,
        status: c.isEnded ? 'ended' : 'active',
        endsAt: c.endsAt,
        accessPhase,
      };
    }));

    res.json({
      conferences: enrichedConferences,
    });
  } catch (err) {
    console.error('Dashboard Data Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Update User Profile
 */
async function handleUpdateProfile(req, res) {
  const { telegramId } = req.user;
  const updateData = req.body;

  try {
    await updateGlobalProfile(telegramId, updateData);
    res.json({ success: true });
  } catch (err) {
    console.error('Profile Update Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get Participants with Access Filtering
 */
async function getParticipants(req, res) {
  const { telegramId } = req.user;
  const { conferenceCode } = req.query;

  try {
    const conf = await Conference.findOne({ conferenceCode });
    if (!conf) return res.status(404).json({ error: 'Conference not found' });

    const userProfile = await UserProfile.findOne({ telegramId, conference: conf._id });
    if (!userProfile) return res.status(403).json({ error: 'Not a member of this conference' });

    const accessPhase = getAccessPhase(conf, userProfile);
    
    // Find all active profiles in conference
    const allProfiles = await UserProfile.find({ 
      conference: conf._id, 
      isActive: true, 
      onboardingCompleted: true,
      telegramId: { $ne: telegramId } // Hide self
    });

    const filteredProfiles = allProfiles.map(p => filterProfileByAccess(p, accessPhase));

    res.json({
      profiles: filteredProfiles,
      accessPhase,
    });
  } catch (err) {
    console.error('Get Participants Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  handleAuth,
  getDashboardData,
  handleUpdateProfile,
  getParticipants,
};

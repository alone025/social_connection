const { Conference } = require('../models/conference');
const { User } = require('../models/user');
const { UserProfile } = require('../models/userProfile');

function parseMainAdminIdsFromEnv() {
  const raw = process.env.MAIN_ADMIN_TELEGRAM_IDS || '';
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

async function ensureUserFromTelegram(telegramUser) {
  if (!telegramUser || !telegramUser.id) {
    throw new Error('Invalid Telegram user object');
  }

  const telegramId = String(telegramUser.id);

  let user = await User.findOne({ telegramId });
  if (!user) {
    user = new User({
      telegramId,
      username: telegramUser.username,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
    });
  } else {
    // Keep basic fields in sync
    user.username = telegramUser.username;
    user.firstName = telegramUser.first_name;
    user.lastName = telegramUser.last_name;
  }

  // Mark as main_admin if present in env
  const mainAdminIds = parseMainAdminIdsFromEnv();
  if (mainAdminIds.includes(telegramId)) {
    user.globalRole = 'main_admin';
  }

  await user.save();
  return user;
}

function userIsMainAdmin(user) {
  if (!user) return false;
  if (user.globalRole === 'main_admin') return true;
  const mainAdminIds = parseMainAdminIdsFromEnv();
  return mainAdminIds.includes(user.telegramId);
}

function generateConferenceCode(title) {
  const base =
    (title || 'conf')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 16) || 'conf';
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

async function createConference({ createdByUser, payload }) {
  const { validate, conferenceSchema } = require('../lib/validation');
  const { canCreateConference } = require('./limit.service');
  
  // Check limits
  const user = await ensureUserFromTelegram(createdByUser);
  const limitCheck = await canCreateConference(user._id);
  if (!limitCheck.allowed) {
    const err = new Error('LIMIT_EXCEEDED');
    err.details = {
      limit: limitCheck.limit,
      current: limitCheck.current,
      resource: 'conferences',
    };
    throw err;
  }
  
  // Validate input data
  const validated = validate(payload, conferenceSchema);
  const { title, description, access, startsAt, endsAt } = validated;

  const code = generateConferenceCode(title);

  const conference = new Conference({
    title,
    description,
    access: access || 'public',
    startsAt: startsAt ? new Date(startsAt) : undefined,
    endsAt: endsAt ? new Date(endsAt) : undefined,
    conferenceCode: code,
  });

  await conference.save();

  // Optionally auto-create profile + admin membership later
  return conference;
}

async function joinConference({ telegramUser, code }) {
  const user = await ensureUserFromTelegram(telegramUser);
  const { canAddParticipant } = require('./limit.service');

  const conference = await Conference.findOne({
    conferenceCode: code,
    isEnded: false,
  });

  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  if (conference.access === 'private') {
    // TODO: add access-code checking
    // For now just disallow joining private conferences without extra logic
    throw new Error('CONFERENCE_PRIVATE');
  }

  // Check participant limit (only if user is not already a participant)
  const existingProfile = await UserProfile.findOne({
    telegramId: String(telegramUser.id),
    conference: conference._id,
  });

  if (!existingProfile) {
    const limitCheck = await canAddParticipant(conference._id);
    if (!limitCheck.allowed) {
      const err = new Error('LIMIT_EXCEEDED');
      err.details = {
        limit: limitCheck.limit,
        current: limitCheck.current,
        resource: 'participants',
      };
      throw err;
    }
  }

  // Try to copy from global profile first
  const { copyGlobalProfileToConference } = require('./profile.service');
  let profile = await copyGlobalProfileToConference({
    telegramId: String(telegramUser.id),
    conferenceId: conference._id,
  });

  // If no global profile exists, create a new conference profile
  if (!profile) {
    profile = await UserProfile.findOne({
      telegramId: String(telegramUser.id),
      conference: conference._id,
    });

    if (!profile) {
      profile = new UserProfile({
        telegramId: String(telegramUser.id),
        conference: conference._id,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        username: telegramUser.username,
        isActive: true,
        onboardingCompleted: false, // Will be set when user completes global onboarding
      });
    }
  }

  profile.isActive = true;
  // Ensure onboardingCompleted is set if global profile exists and is completed
  const { getGlobalProfile } = require('./profile.service');
  const globalProfile = await getGlobalProfile(String(telegramUser.id));
  if (globalProfile && globalProfile.onboardingCompleted) {
    profile.onboardingCompleted = true;
  }
  await profile.save();

  return { conference, profile, user };
}

async function listConferencesForUser(user) {
  if (!user) return [];

  if (userIsMainAdmin(user)) {
    return Conference.find({}).sort({ startsAt: 1 });
  }

  // Conferences where user has a profile (joined)
  const profiles = await UserProfile.find({ telegramId: user.telegramId });
  const conferenceIds = profiles.map((p) => p.conference);

  return Conference.find({
    _id: { $in: conferenceIds },
    isEnded: false,
  }).sort({ startsAt: 1 });
}

async function endConference({ code, requestedByUser }) {
  const conference = await Conference.findOne({ conferenceCode: code });
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  // Permission check: main admin or conference admin for this conference
  if (!userIsMainAdmin(requestedByUser)) {
    const adminProfiles = await UserProfile.find({
      telegramId: requestedByUser.telegramId,
      conference: conference._id,
    });

    const adminProfileIds = adminProfiles.map((p) => p._id.toString());
    const isConferenceAdmin =
      adminProfileIds.length > 0 &&
      conference.admins.some((id) => adminProfileIds.includes(id.toString()));

    if (!isConferenceAdmin) {
      const err = new Error('ACCESS_DENIED');
      throw err;
    }
  }

  conference.isActive = false;
  conference.isEnded = true;
  await conference.save();

  return conference;
}

async function assignConferenceAdmin({ mainAdminUser, conferenceCode, targetTelegramId }) {
  if (!userIsMainAdmin(mainAdminUser)) {
    const err = new Error('ACCESS_DENIED');
    throw err;
  }

  const conference = await Conference.findOne({ conferenceCode });
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  // Ensure target user exists
  let targetUser = await User.findOne({ telegramId: targetTelegramId });
  if (!targetUser) {
    throw new Error('TARGET_USER_NOT_FOUND');
  }

  // Mark as conference_admin globally (if not main_admin)
  if (targetUser.globalRole !== 'main_admin') {
    targetUser.globalRole = 'conference_admin';
    await targetUser.save();
  }

  // Ensure profile for this conference
  let profile = await UserProfile.findOne({
    telegramId: targetTelegramId,
    conference: conference._id,
  });

  if (!profile) {
    profile = new UserProfile({
      telegramId: targetTelegramId,
      conference: conference._id,
      isActive: true,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      username: targetUser.username,
    });
    await profile.save();
  }

  const profileIdStr = profile._id.toString();
  const adminIds = conference.admins.map((id) => id.toString());
  if (!adminIds.includes(profileIdStr)) {
    conference.admins.push(profile._id);
    await conference.save();
  }

  return { conference, profile, targetUser };
}

async function revokeConferenceAdmin({ mainAdminUser, conferenceCode, targetTelegramId }) {
  if (!userIsMainAdmin(mainAdminUser)) {
    const err = new Error('ACCESS_DENIED');
    throw err;
  }

  const conference = await Conference.findOne({ conferenceCode });
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  const profiles = await UserProfile.find({
    telegramId: targetTelegramId,
    conference: conference._id,
  });

  if (!profiles.length) {
    throw new Error('TARGET_USER_NOT_ADMIN');
  }

  const profileIdsStr = profiles.map((p) => p._id.toString());
  conference.admins = conference.admins.filter(
    (id) => !profileIdsStr.includes(id.toString())
  );
  await conference.save();

  // Optionally downgrade globalRole if user is no longer admin of any conference
  const targetUser = await User.findOne({ telegramId: targetTelegramId });
  if (targetUser && targetUser.globalRole === 'conference_admin') {
    const otherAdminConfs = await Conference.countDocuments({
      admins: { $in: profiles.map((p) => p._id) },
    });
    if (!otherAdminConfs) {
      targetUser.globalRole = 'user';
      await targetUser.save();
    }
  }

  return { conference };
}

/**
 * Check if user is conference admin for a specific conference
 */
async function isConferenceAdminFor({ user, conference }) {
  if (userIsMainAdmin(user)) return true;
  
  const adminProfiles = await UserProfile.find({
    telegramId: user.telegramId,
    conference: conference._id,
  });

  const adminProfileIds = adminProfiles.map((p) => p._id.toString());
  return (
    adminProfileIds.length > 0 &&
    conference.admins.some((id) => adminProfileIds.includes(id.toString()))
  );
}

/**
 * Update conference (main admin can edit any, conference admin can edit their own)
 */
async function updateConference({ conferenceCode, requestedByUser, payload }) {
  const { validate, conferenceSchema } = require('../lib/validation');
  
  const conference = await Conference.findOne({ conferenceCode });
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  // Permission check
  if (!userIsMainAdmin(requestedByUser)) {
    const isAdmin = await isConferenceAdminFor({ user: requestedByUser, conference });
    if (!isAdmin) {
      throw new Error('ACCESS_DENIED');
    }
  }

  // Validate and update
  const validated = validate(payload, conferenceSchema);
  if (validated.title) conference.title = validated.title;
  if (validated.description !== undefined) conference.description = validated.description;
  if (validated.access) conference.access = validated.access;
  if (validated.startsAt !== undefined) conference.startsAt = validated.startsAt ? new Date(validated.startsAt) : undefined;
  if (validated.endsAt !== undefined) conference.endsAt = validated.endsAt ? new Date(validated.endsAt) : undefined;

  await conference.save();
  return conference;
}

/**
 * Start conference (set isActive = true, isEnded = false)
 */
async function startConference({ conferenceCode, requestedByUser }) {
  const conference = await Conference.findOne({ conferenceCode });
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  // Permission check
  if (!userIsMainAdmin(requestedByUser)) {
    const isAdmin = await isConferenceAdminFor({ user: requestedByUser, conference });
    if (!isAdmin) {
      throw new Error('ACCESS_DENIED');
    }
  }

  conference.isActive = true;
  conference.isEnded = false;
  await conference.save();
  return conference;
}

/**
 * Stop conference (set isActive = false, but keep isEnded = false for restart)
 */
async function stopConference({ conferenceCode, requestedByUser }) {
  const conference = await Conference.findOne({ conferenceCode });
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  // Permission check
  if (!userIsMainAdmin(requestedByUser)) {
    const isAdmin = await isConferenceAdminFor({ user: requestedByUser, conference });
    if (!isAdmin) {
      throw new Error('ACCESS_DENIED');
    }
  }

  conference.isActive = false;
  await conference.save();
  return conference;
}

/**
 * Delete conference (main admin can delete any, conference admin can delete their own)
 */
async function deleteConference({ conferenceCode, requestedByUser }) {
  const conference = await Conference.findOne({ conferenceCode });
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  // Permission check
  if (!userIsMainAdmin(requestedByUser)) {
    const isAdmin = await isConferenceAdminFor({ user: requestedByUser, conference });
    if (!isAdmin) {
      throw new Error('ACCESS_DENIED');
    }
  }

  await Conference.deleteOne({ _id: conference._id });
  return { deleted: true, conferenceCode };
}

/**
 * Assign speaker role to a user in a conference (conference admin only)
 */
async function assignSpeaker({ conferenceCode, targetTelegramId, requestedByUser }) {
  const conference = await Conference.findOne({ conferenceCode });
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  // Permission check: main admin or conference admin
  if (!userIsMainAdmin(requestedByUser)) {
    const isAdmin = await isConferenceAdminFor({ user: requestedByUser, conference });
    if (!isAdmin) {
      throw new Error('ACCESS_DENIED');
    }
  }

  // Find or create profile
  let profile = await UserProfile.findOne({
    telegramId: targetTelegramId,
    conference: conference._id,
  });

  if (!profile) {
    const targetUser = await User.findOne({ telegramId: targetTelegramId });
    if (!targetUser) {
      throw new Error('TARGET_USER_NOT_FOUND');
    }
    profile = new UserProfile({
      telegramId: targetTelegramId,
      conference: conference._id,
      isActive: true,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      username: targetUser.username,
    });
  }

  // Add speaker role if not present
  if (!profile.roles || !profile.roles.includes('speaker')) {
    if (!profile.roles) profile.roles = [];
    profile.roles.push('speaker');
    await profile.save();
  }

  return { conference, profile };
}

/**
 * Remove speaker role from a user in a conference
 */
async function removeSpeaker({ conferenceCode, targetTelegramId, requestedByUser }) {
  const conference = await Conference.findOne({ conferenceCode });
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  // Permission check
  if (!userIsMainAdmin(requestedByUser)) {
    const isAdmin = await isConferenceAdminFor({ user: requestedByUser, conference });
    if (!isAdmin) {
      throw new Error('ACCESS_DENIED');
    }
  }

  const profile = await UserProfile.findOne({
    telegramId: targetTelegramId,
    conference: conference._id,
  });

  if (!profile) {
    throw new Error('PROFILE_NOT_FOUND');
  }

  if (profile.roles && profile.roles.includes('speaker')) {
    profile.roles = profile.roles.filter((r) => r !== 'speaker');
    await profile.save();
  }

  return { conference, profile };
}

module.exports = {
  ensureUserFromTelegram,
  userIsMainAdmin,
  createConference,
  joinConference,
  listConferencesForUser,
  endConference,
  assignConferenceAdmin,
  revokeConferenceAdmin,
  isConferenceAdminFor,
  updateConference,
  startConference,
  stopConference,
  deleteConference,
  assignSpeaker,
  removeSpeaker,
};



const { Subscription } = require('../models/subscription');
const { TariffPlan } = require('../models/tariffPlan');
const { User } = require('../models/user');
const { Conference } = require('../models/conference');
const { UserProfile } = require('../models/userProfile');
const { Poll } = require('../models/poll');
const { Question } = require('../models/question');
const { Meeting } = require('../models/meeting');

/**
 * Get active subscription for a user
 */
async function getUserSubscription(userId) {
  const subscription = await Subscription.findOne({
    userId,
    status: { $in: ['active', 'trial'] },
    $or: [
      { endsAt: null },
      { endsAt: { $gte: new Date() } },
    ],
  }).populate('tariffPlan');

  // If no subscription found, return default free plan
  if (!subscription) {
    const defaultPlan = await TariffPlan.findOne({ isDefault: true, isActive: true });
    if (defaultPlan) {
      return {
        tariffPlan: defaultPlan,
        status: 'active',
        isDefault: true,
      };
    }
    // Fallback: return null if no default plan exists
    return null;
  }

  return subscription;
}

/**
 * Get active subscription for a conference
 */
async function getConferenceSubscription(conferenceId) {
  const subscription = await Subscription.findOne({
    conferenceId,
    status: { $in: ['active', 'trial'] },
    $or: [
      { endsAt: null },
      { endsAt: { $gte: new Date() } },
    ],
  }).populate('tariffPlan');

  // If no conference-specific subscription, try to get user subscription from conference creator/admin
  if (!subscription) {
    const conference = await Conference.findById(conferenceId);
    if (conference && conference.admins && conference.admins.length > 0) {
      const adminProfile = await UserProfile.findById(conference.admins[0]);
      if (adminProfile) {
        const user = await User.findOne({ telegramId: adminProfile.telegramId });
        if (user) {
          return getUserSubscription(user._id);
        }
      }
    }
  }

  // Fallback to default plan
  if (!subscription) {
    const defaultPlan = await TariffPlan.findOne({ isDefault: true, isActive: true });
    if (defaultPlan) {
      return {
        tariffPlan: defaultPlan,
        status: 'active',
        isDefault: true,
      };
    }
  }

  return subscription;
}

/**
 * Get limits for a user or conference
 */
async function getLimits(userId = null, conferenceId = null) {
  let subscription = null;

  if (conferenceId) {
    subscription = await getConferenceSubscription(conferenceId);
  } else if (userId) {
    subscription = await getUserSubscription(userId);
  }

  if (!subscription || !subscription.tariffPlan) {
    // Return very restrictive limits if no plan found
    return {
      maxConferences: 0,
      maxParticipantsPerConference: 0,
      maxPollsPerConference: 0,
      maxQuestionsPerConference: 0,
      maxMeetingsPerConference: 0,
      maxMeetingsPerUser: 0,
      maxSpeakersPerConference: 0,
      maxAdminsPerConference: 0,
      pollsEnabled: false,
      secondScreenEnabled: false,
      organizerDashboardEnabled: false,
      exportCsvEnabled: false,
      exportPdfEnabled: false,
      customBranding: false,
      apiAccess: false,
      prioritySupport: false,
    };
  }

  return subscription.tariffPlan.limits;
}

/**
 * Check if a limit is exceeded
 * @param {string} limitName - Name of the limit to check (e.g., 'maxParticipantsPerConference')
 * @param {string|ObjectId} userId - User ID (optional)
 * @param {string|ObjectId} conferenceId - Conference ID (optional)
 * @param {number} currentCount - Current count for the resource
 * @returns {Promise<{allowed: boolean, limit: number, current: number}>}
 */
async function checkLimit(limitName, userId = null, conferenceId = null, currentCount = 0) {
  const limits = await getLimits(userId, conferenceId);
  const limit = limits[limitName];

  // -1 means unlimited
  if (limit === -1 || limit === undefined || limit === null) {
    return { allowed: true, limit: -1, current: currentCount };
  }

  const allowed = currentCount < limit;
  return { allowed, limit, current: currentCount };
}

/**
 * Check if user can create a new conference
 */
async function canCreateConference(userId) {
  const user = await User.findById(userId);
  if (!user) return { allowed: false, reason: 'USER_NOT_FOUND' };

  // Count existing conferences for this user
  const userProfiles = await UserProfile.find({ telegramId: user.telegramId });
  const conferenceIds = userProfiles.map(p => p.conference);
  const conferencesAsAdmin = await Conference.countDocuments({
    admins: { $in: userProfiles.map(p => p._id) },
  });

  const totalConferences = new Set([...conferenceIds.map(id => id.toString()), ...conferencesAsAdmin]).size;

  const result = await checkLimit('maxConferences', userId, null, totalConferences);
  return {
    allowed: result.allowed,
    limit: result.limit,
    current: result.current,
    reason: result.allowed ? null : 'LIMIT_EXCEEDED',
  };
}

/**
 * Check if a conference can add more participants
 */
async function canAddParticipant(conferenceId) {
  const participantCount = await UserProfile.countDocuments({
    conference: conferenceId,
    isActive: true,
  });

  const result = await checkLimit('maxParticipantsPerConference', null, conferenceId, participantCount);
  return {
    allowed: result.allowed,
    limit: result.limit,
    current: result.current,
    reason: result.allowed ? null : 'LIMIT_EXCEEDED',
  };
}

/**
 * Check if a conference can create more polls
 */
async function canCreatePoll(conferenceId) {
  const pollCount = await Poll.countDocuments({ conference: conferenceId });

  const result = await checkLimit('maxPollsPerConference', null, conferenceId, pollCount);
  return {
    allowed: result.allowed,
    limit: result.limit,
    current: result.current,
    reason: result.allowed ? null : 'LIMIT_EXCEEDED',
  };
}

/**
 * Check if a conference can create more questions
 */
async function canCreateQuestion(conferenceId) {
  const questionCount = await Question.countDocuments({ conference: conferenceId });

  const result = await checkLimit('maxQuestionsPerConference', null, conferenceId, questionCount);
  return {
    allowed: result.allowed,
    limit: result.limit,
    current: result.current,
    reason: result.allowed ? null : 'LIMIT_EXCEEDED',
  };
}

/**
 * Check if a conference can create more meetings (total limit)
 */
async function canCreateMeeting(conferenceId) {
  const meetingCount = await Meeting.countDocuments({ conference: conferenceId });

  const result = await checkLimit('maxMeetingsPerConference', null, conferenceId, meetingCount);
  return {
    allowed: result.allowed,
    limit: result.limit,
    current: result.current,
    reason: result.allowed ? null : 'LIMIT_EXCEEDED',
  };
}

/**
 * Check if a user can create more meetings (per-user limit)
 */
async function canUserCreateMeeting(conferenceId, userId) {
  // Get user profile for this conference
  const profile = await UserProfile.findOne({
    conference: conferenceId,
    telegramId: userId,
  });

  if (!profile) {
    return { allowed: false, reason: 'USER_NOT_IN_CONFERENCE', limit: 0, current: 0 };
  }

  const userMeetingCount = await Meeting.countDocuments({
    conference: conferenceId,
    $or: [
      { requester: profile._id },
      { recipient: profile._id },
    ],
  });

  const limits = await getLimits(null, conferenceId);
  const limit = limits.maxMeetingsPerUser;

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, limit: -1, current: userMeetingCount };
  }

  const allowed = userMeetingCount < limit;
  return {
    allowed,
    limit,
    current: userMeetingCount,
    reason: allowed ? null : 'USER_MEETING_LIMIT_EXCEEDED',
  };
}

/**
 * Check if a feature is enabled for a conference
 */
async function isFeatureEnabled(featureName, conferenceId, userId = null) {
  const limits = await getLimits(userId, conferenceId);
  return limits[featureName] === true;
}

/**
 * Ensure default tariff plans exist (run on startup or migration)
 */
async function ensureDefaultTariffPlans() {
  const defaultPlans = [
    {
      name: 'free',
      displayName: 'Free Plan',
      description: 'Basic plan for small conferences',
      pricePerMonth: 0,
      limits: {
        maxConferences: 1,
        maxParticipantsPerConference: 50,
        maxPollsPerConference: 10,
        maxQuestionsPerConference: 100,
        maxMeetingsPerConference: 50,
        maxMeetingsPerUser: 10,
        maxSpeakersPerConference: 5,
        maxAdminsPerConference: 2,
        pollsEnabled: true,
        secondScreenEnabled: true,
        organizerDashboardEnabled: true,
        exportCsvEnabled: false,
        exportPdfEnabled: false,
        customBranding: false,
        apiAccess: false,
        prioritySupport: false,
      },
      isDefault: true,
      isActive: true,
    },
    {
      name: 'basic',
      displayName: 'Basic Plan',
      description: 'For growing conferences',
      pricePerMonth: 2999, // $29.99 in cents
      limits: {
        maxConferences: 5,
        maxParticipantsPerConference: 200,
        maxPollsPerConference: 50,
        maxQuestionsPerConference: 500,
        maxMeetingsPerConference: 200,
        maxMeetingsPerUser: 50,
        maxSpeakersPerConference: 20,
        maxAdminsPerConference: 10,
        pollsEnabled: true,
        secondScreenEnabled: true,
        organizerDashboardEnabled: true,
        exportCsvEnabled: true,
        exportPdfEnabled: false,
        customBranding: false,
        apiAccess: true,
        prioritySupport: false,
      },
      isDefault: false,
      isActive: true,
    },
    {
      name: 'premium',
      displayName: 'Premium Plan',
      description: 'For large events and enterprises',
      pricePerMonth: 9999, // $99.99 in cents
      limits: {
        maxConferences: -1, // unlimited
        maxParticipantsPerConference: -1, // unlimited
        maxPollsPerConference: -1, // unlimited
        maxQuestionsPerConference: -1, // unlimited
        maxMeetingsPerConference: -1, // unlimited
        maxMeetingsPerUser: -1, // unlimited
        maxSpeakersPerConference: -1, // unlimited
        maxAdminsPerConference: -1, // unlimited
        pollsEnabled: true,
        secondScreenEnabled: true,
        organizerDashboardEnabled: true,
        exportCsvEnabled: true,
        exportPdfEnabled: true,
        customBranding: true,
        apiAccess: true,
        prioritySupport: true,
      },
      isDefault: false,
      isActive: true,
    },
  ];

  for (const planData of defaultPlans) {
    await TariffPlan.findOneAndUpdate(
      { name: planData.name },
      { $set: planData },
      { upsert: true, new: true }
    );
  }

  console.log('✅ Default tariff plans ensured');
}

module.exports = {
  getUserSubscription,
  getConferenceSubscription,
  getLimits,
  checkLimit,
  canCreateConference,
  canAddParticipant,
  canCreatePoll,
  canCreateQuestion,
  canCreateMeeting,
  canUserCreateMeeting,
  isFeatureEnabled,
  ensureDefaultTariffPlans,
};

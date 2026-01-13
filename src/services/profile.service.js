const { UserProfile } = require('../models/userProfile');
const { GlobalUserProfile } = require('../models/globalUserProfile');
const { validate, userProfileSchema } = require('../lib/validation');

/**
 * Upsert global user profile data (independent of conferences).
 * Used by onboarding flow to persist validated profile info.
 */
async function upsertGlobalProfile({ telegramId, data }) {
  if (!telegramId) {
    throw new Error('MISSING_TELEGRAM_ID');
  }

  // Validate only known fields via Joi
  const validated = validate(data, userProfileSchema);

  let globalProfile = await GlobalUserProfile.findOne({ telegramId });

  if (!globalProfile) {
    globalProfile = new GlobalUserProfile({
      telegramId: String(telegramId),
    });
  }

  Object.assign(globalProfile, validated);
  globalProfile.onboardingCompleted = true;

  await globalProfile.save();

  // Clear onboarding state after successful completion
  const { clearOnboardingState } = require('./onboarding.service');
  try {
    await clearOnboardingState(telegramId);
  } catch (err) {
    // Ignore errors if state doesn't exist
    console.warn('Could not clear onboarding state:', err.message);
  }

  return globalProfile;
}

/**
 * Get global user profile
 */
async function getGlobalProfile(telegramId) {
  return await GlobalUserProfile.findOne({ telegramId: String(telegramId) });
}

/**
 * Update specific fields in global profile
 */
async function updateGlobalProfile(telegramId, updates) {
  const globalProfile = await getGlobalProfile(telegramId);
  
  if (!globalProfile) {
    throw new Error('PROFILE_NOT_FOUND');
  }
  
  // Validate updates if needed
  if (updates.firstName || updates.lastName) {
    const { validate, userProfileSchema } = require('../lib/validation');
    validate({ firstName: updates.firstName || globalProfile.firstName, lastName: updates.lastName || globalProfile.lastName }, userProfileSchema);
  }
  
  if (updates.interests) {
    const { validate, userProfileSchema } = require('../lib/validation');
    validate({ interests: updates.interests }, userProfileSchema);
  }
  
  if (updates.offerings) {
    const { validate, userProfileSchema } = require('../lib/validation');
    validate({ offerings: updates.offerings }, userProfileSchema);
  }
  
  if (updates.lookingFor) {
    const { validate, userProfileSchema } = require('../lib/validation');
    validate({ lookingFor: updates.lookingFor }, userProfileSchema);
  }
  
  // Update fields
  Object.assign(globalProfile, updates);
  await globalProfile.save();
  
  return globalProfile;
}

/**
 * Copy global profile data to conference-specific profile when user joins a conference.
 */
async function copyGlobalProfileToConference({ telegramId, conferenceId }) {
  const globalProfile = await getGlobalProfile(telegramId);
  
  if (!globalProfile) {
    return null; // No global profile to copy
  }

  let conferenceProfile = await UserProfile.findOne({
    telegramId,
    conference: conferenceId,
  });

  if (!conferenceProfile) {
    conferenceProfile = new UserProfile({
      telegramId,
      conference: conferenceId,
      isActive: true,
    });
  }

  // Copy data from global profile
  conferenceProfile.firstName = globalProfile.firstName;
  conferenceProfile.lastName = globalProfile.lastName;
  conferenceProfile.username = globalProfile.username;
  conferenceProfile.photoUrl = globalProfile.photoUrl;
  conferenceProfile.interests = globalProfile.interests || [];
  conferenceProfile.offerings = globalProfile.offerings || [];
  conferenceProfile.lookingFor = globalProfile.lookingFor || [];
  conferenceProfile.roles = globalProfile.roles || [];
  conferenceProfile.onboardingCompleted = globalProfile.onboardingCompleted || false;

  await conferenceProfile.save();
  return conferenceProfile;
}

/**
 * Upsert user profile data for a given conference.
 * Used by onboarding flow to persist validated profile info.
 * @deprecated Use upsertGlobalProfile instead. This function is kept for backward compatibility.
 */
async function upsertProfileForConference({ telegramId, conferenceId, data }) {
  if (!telegramId || !conferenceId) {
    throw new Error('MISSING_KEYS');
  }

  // Validate only known fields via Joi
  const validated = validate(data, userProfileSchema);

  let profile = await UserProfile.findOne({
    telegramId,
    conference: conferenceId,
  });

  if (!profile) {
    profile = new UserProfile({
      telegramId,
      conference: conferenceId,
      isActive: true,
    });
  }

  Object.assign(profile, validated);
  profile.onboardingCompleted = true;

  await profile.save();

  // Clear onboarding state after successful completion
  const { clearOnboardingState } = require('./onboarding.service');
  try {
    await clearOnboardingState(telegramId);
  } catch (err) {
    // Ignore errors if state doesn't exist
    console.warn('Could not clear onboarding state:', err.message);
  }

  return profile;
}

module.exports = {
  upsertGlobalProfile,
  getGlobalProfile,
  updateGlobalProfile,
  copyGlobalProfileToConference,
  upsertProfileForConference, // Keep for backward compatibility
};



/**
 * Access Control Service
 * Logic for determining user access to conference data
 */

const ACCESS_PHASES = {
  FREE: 'free',
  GRACE: 'grace',
  PAYMENT_REQUIRED: 'payment_required',
  PAID: 'paid',
};

// 2 hours in milliseconds
const GRACE_PERIOD_MS = 2 * 60 * 60 * 1000;

/**
 * Get current access phase for a user in a conference
 * @param {Object} conference - The conference document
 * @param {Object} userProfile - The user's profile in this conference
 * @returns {string} - The access phase from ACCESS_PHASES
 */
function getAccessPhase(conference, userProfile) {
  // 1. If user is a conference admin or system admin, they always have full access
  // (This check should be done by the caller using roles)

  // 2. If user has already paid, they have full access
  if (userProfile && userProfile.paymentStatus === 'paid') {
    return ACCESS_PHASES.PAID;
  }

  // 3. If conference is not ended and active, it's free
  if (!conference.isEnded && conference.isActive) {
    return ACCESS_PHASES.FREE;
  }

  // 4. If conference is ended/inactive, check the grace period
  const endTime = conference.endsAt || conference.updatedAt;
  const now = new Date();
  
  if (now.getTime() <= endTime.getTime() + GRACE_PERIOD_MS) {
    return ACCESS_PHASES.GRACE;
  }

  // 5. Otherwise, payment is required
  return ACCESS_PHASES.PAYMENT_REQUIRED;
}

/**
 * Filter profile data based on access phase
 * @param {Object} profile - Target profile to view
 * @param {string} accessPhase - Access phase of the viewer
 * @returns {Object} - Filtered profile
 */
function filterProfileByAccess(profile, accessPhase) {
  if (accessPhase === ACCESS_PHASES.FREE || accessPhase === ACCESS_PHASES.PAID || accessPhase === ACCESS_PHASES.GRACE) {
    return profile;
  }

  // Restricted view
  return {
    _id: profile._id,
    firstName: profile.firstName,
    lastName: profile.lastName ? `${profile.lastName[0]}.` : '', // Mask last name
    username: null, // Hide telegram handle
    interests: profile.interests, // Interests remain public to encourage payment
    roles: profile.roles,
    isRestricted: true,
  };
}

module.exports = {
  ACCESS_PHASES,
  getAccessPhase,
  filterProfileByAccess,
};

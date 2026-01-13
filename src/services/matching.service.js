const { Conference } = require('../models/conference');
const { UserProfile } = require('../models/userProfile');
const { getConferenceIdByCode } = require('../lib/conference-helper');

/**
 * Basic profile search / matching inside a conference.
 * Supports filters:
 * - role: 'speaker' | 'investor' | 'participant' | 'organizer'
 * - text: free-text match against interests / offerings / lookingFor
 * 
 * Note: conferenceCode is for UX only, internally uses conferenceId (ObjectId)
 */
async function searchProfiles({ conferenceCode, role, text, limit = 20 }) {
  // Convert conferenceCode to conferenceId (ObjectId) for consistent DB queries
  const conferenceId = await getConferenceIdByCode(conferenceCode);

  // Get conference for return value (only if needed)
  const conference = await Conference.findById(conferenceId).select('_id conferenceCode title');

  const query = {
    conference: conferenceId, // Use ObjectId for all DB queries
    isActive: true,
    // Don't filter by onboardingCompleted - users might have global profile but not conference-specific onboarding
    // onboardingCompleted: true,
  };

  if (role) {
    query.roles = role;
  }

  // Use indexed query for performance
  const profiles = await UserProfile.find(query).limit(limit);

  if (text && text.trim()) {
    const t = text.trim().toLowerCase();
    const filtered = profiles.filter((p) => {
      const fields = []
        .concat(p.interests || [])
        .concat(p.offerings || [])
        .concat(p.lookingFor || []);
      return fields.some((val) => String(val).toLowerCase().includes(t));
    });
    return { conference, profiles: filtered };
  }

  return { conference, profiles };
}

module.exports = {
  searchProfiles,
};



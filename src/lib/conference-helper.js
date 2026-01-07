/**
 * Helper functions for conference code/id conversion
 * Ensures consistency: conferenceCode is only for UX, conferenceId (ObjectId) is used in DB
 */

const { Conference } = require('../models/conference');
const mongoose = require('mongoose');

/**
 * Convert conferenceCode to conferenceId (ObjectId)
 * Throws error if conference not found
 * @param {string} conferenceCode - Conference code (for UX)
 * @returns {Promise<mongoose.Types.ObjectId>} Conference ObjectId
 */
async function getConferenceIdByCode(conferenceCode) {
  if (!conferenceCode) {
    throw new Error('CONFERENCE_CODE_REQUIRED');
  }

  const conference = await Conference.findOne({ conferenceCode }).select('_id');
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  return conference._id;
}

/**
 * Get conference by code and return both code and id
 * Useful when you need both for different purposes
 * @param {string} conferenceCode - Conference code
 * @returns {Promise<{_id: ObjectId, conferenceCode: string}>} Conference with id and code
 */
async function getConferenceByCode(conferenceCode) {
  if (!conferenceCode) {
    throw new Error('CONFERENCE_CODE_REQUIRED');
  }

  const conference = await Conference.findOne({ conferenceCode }).select('_id conferenceCode');
  if (!conference) {
    throw new Error('CONFERENCE_NOT_FOUND');
  }

  return {
    _id: conference._id,
    conferenceId: conference._id,
    conferenceCode: conference.conferenceCode,
  };
}

/**
 * Validate that a value is a valid ObjectId
 * @param {any} id - Value to validate
 * @returns {boolean} True if valid ObjectId
 */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Convert string to ObjectId if valid
 * @param {string|ObjectId} id - ID to convert
 * @returns {mongoose.Types.ObjectId} ObjectId instance
 */
function toObjectId(id) {
  if (id instanceof mongoose.Types.ObjectId) {
    return id;
  }
  if (isValidObjectId(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  throw new Error('INVALID_OBJECT_ID');
}

module.exports = {
  getConferenceIdByCode,
  getConferenceByCode,
  isValidObjectId,
  toObjectId,
};

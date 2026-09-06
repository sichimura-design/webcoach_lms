/**
 * Google Meet Space Service
 *
 * Creates one Meeting Space per coaching_schedule row (not one fixed Space per
 * coach) so a Conference Record can be attributed to a specific booking without
 * the time-window/participant-email heuristics a shared/reused Space would need.
 *
 * Uses the Organizer's access token (see IntegrationService.getValidOrganizerAccessToken)
 * — coaches never authenticate with Google themselves.
 */

const axios = require('axios');
const integrationService = require('./IntegrationService');
const moodleAdapter = require('../adapters/MoodleAdapter');
const logger = require('../utils/logger');

const MEET_API_BASE = 'https://meet.googleapis.com/v2';
const MEET_API_BETA_BASE = 'https://meet.googleapis.com/v2beta';

class GoogleMeetSpaceService {
  /**
   * Create a Meeting Space and add the given coach as a co-host.
   *
   * @param {number} coachUserId Moodle user ID of the coach
   * @returns {Promise<{ meetingUri: string, spaceName: string }>}
   */
  async createSpaceForSchedule(coachUserId) {
    const accessToken = await integrationService.getValidOrganizerAccessToken('google');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const spaceResponse = await axios.post(
      `${MEET_API_BASE}/spaces`,
      {
        config: {
          accessType: 'TRUSTED',
          moderation: 'ON',
          // Without this, transcription must be started manually by a host
          // during the call — since the coach isn't a co-host (see the
          // spaces.members.create failure below), nobody present would
          // otherwise have the privilege to start it.
          artifactConfig: {
            transcriptionConfig: { autoTranscriptionGeneration: 'ON' },
          },
        },
      },
      { headers: authHeader, timeout: 10000 }
    );

    const spaceName = spaceResponse.data.name; // e.g. "spaces/aBcD1234"
    const meetingUri = spaceResponse.data.meetingUri;

    try {
      const coachEmail = await this._getCoachEmail(coachUserId);
      // `email` is the input field for who to add; `user` is an output-only
      // resource identifier — setting both is rejected by the API.
      await axios.post(
        `${MEET_API_BETA_BASE}/${spaceName}/members`,
        {
          email: coachEmail,
          role: 'COHOST',
        },
        { headers: authHeader, timeout: 10000 }
      );
    } catch (err) {
      // Known, expected failure as of 2026-09: spaces.members.create is part of
      // Google's Workspace Developer Preview Program, which this project has not
      // been accepted into (Google returns 404 "Method not found", not a data
      // error). Not fatal — the Space itself was already created successfully,
      // and transcript retrieval only needs the Organizer's own token, not a
      // co-hosted coach. The coach still joins as a regular participant.
      logger.warn(
        `[GoogleMeetSpace] Could not add coach ${coachUserId} as co-host on ${spaceName} ` +
        `(spaces.members.create likely requires Developer Preview Program access):`,
        err.response?.data || err.message
      );
    }

    return { meetingUri, spaceName };
  }

  async _getCoachEmail(coachUserId) {
    const users = await moodleAdapter.getUsersByField('id', [coachUserId]);
    const email = users?.[0]?.email;
    if (!email) {
      throw new Error(`Could not resolve Moodle email for coach ${coachUserId}`);
    }
    return email;
  }
}

module.exports = new GoogleMeetSpaceService();

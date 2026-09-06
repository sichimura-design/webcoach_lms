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
        },
      },
      { headers: authHeader, timeout: 10000 }
    );

    const spaceName = spaceResponse.data.name; // e.g. "spaces/aBcD1234"
    const meetingUri = spaceResponse.data.meetingUri;

    try {
      const coachEmail = await this._getCoachEmail(coachUserId);
      await axios.post(
        `${MEET_API_BETA_BASE}/${spaceName}/members`,
        {
          user: { email: coachEmail },
          role: 'COHOST',
        },
        { headers: authHeader, timeout: 10000 }
      );
    } catch (err) {
      // The Space itself was created successfully; failing to add a co-host
      // shouldn't block booking creation — the coach can still join as a
      // regular (non-host) participant, just without host controls.
      logger.error(
        `[GoogleMeetSpace] Failed to add coach ${coachUserId} as co-host on ${spaceName}:`,
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

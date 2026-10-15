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
          // OPEN (not TRUSTED): coaches and students may use accounts outside
          // the Organizer's domain. With TRUSTED they'd have to knock, and the
          // Organizer never joins to admit them. The URL is only shown in-app
          // to the student and their coach.
          accessType: 'OPEN',
          // Host management ON is what lets a co-host from outside the
          // Organizer's domain start transcription (OFF only allows same-domain
          // users — confirmed manually 2026-10-15). Restrictions are
          // NO_RESTRICTION so the student keeps chat/reactions/screen share.
          moderation: 'ON',
          moderationRestrictions: {
            chatRestriction: 'NO_RESTRICTION',
            reactionRestriction: 'NO_RESTRICTION',
            presentRestriction: 'NO_RESTRICTION',
            defaultJoinAsViewerType: 'OFF',
          },
          // Alone this doesn't start transcription without a host/co-host
          // present; the co-host coach still clicks "Start transcript".
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
      // The coach only gets co-host rights when they join with the Google
      // account matching this (Moodle) email.
      await axios.post(
        `${MEET_API_BASE}/${spaceName}/members`,
        {
          email: coachEmail,
          role: 'COHOST',
        },
        { headers: authHeader, timeout: 10000 }
      );
    } catch (err) {
      // Fatal: with host management ON and no co-host, nobody in the call could
      // start transcription. The booking is not saved; the created Space is
      // left unused (the Meet API has no delete for Spaces).
      logger.error(
        `[GoogleMeetSpace] Could not set coach ${coachUserId} as co-host on ${spaceName}:`,
        err.response?.data || err.message
      );
      // Plain Error (no .response) so the route answers 500, not Google's 4xx.
      throw new Error(`Failed to add coach ${coachUserId} as Meet co-host`);
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

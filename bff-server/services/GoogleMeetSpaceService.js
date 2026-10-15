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
          // Created with moderation OFF, then switched ON only after the coach
          // is successfully added as co-host (see below). If the co-host step
          // fails, leaving it OFF keeps the fallback: anyone in the Organizer's
          // domain can still start transcription.
          moderation: 'OFF',
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

      // Host management ON is what lets a co-host from outside the Organizer's
      // domain start transcription (OFF only allows same-domain users —
      // confirmed manually 2026-10-15). Restrictions are NO_RESTRICTION so the
      // student keeps chat/reactions/screen share.
      await axios.patch(
        `${MEET_API_BASE}/${spaceName}`,
        {
          config: {
            moderation: 'ON',
            moderationRestrictions: {
              chatRestriction: 'NO_RESTRICTION',
              reactionRestriction: 'NO_RESTRICTION',
              presentRestriction: 'NO_RESTRICTION',
              defaultJoinAsViewerType: 'OFF',
            },
          },
        },
        {
          headers: authHeader,
          params: { updateMask: 'config.moderation,config.moderationRestrictions' },
          timeout: 10000,
        }
      );
    } catch (err) {
      // Not fatal — the booking still gets a working Meet URL (moderation OFF,
      // coach as a regular participant), but an outside-domain coach can't
      // start transcription. logger.error with "ERROR"/"失敗" so the
      // slack-notifier picks it up and posts to #lms-alert.
      logger.error(
        `[GoogleMeetSpace] ERROR: コーチ${coachUserId}をMeet ${spaceName} の共同主催者にできず失敗 ` +
        '(社外アカウントのコーチは文字起こしを開始できない):',
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

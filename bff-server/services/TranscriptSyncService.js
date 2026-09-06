/**
 * Transcript Sync Service
 *
 * Periodically polls for coaching_schedule rows using the Organizer-centric
 * Google Meet model (see GoogleMeetSpaceService) whose meeting has ended and
 * fetches the generated transcript, then feeds it into the existing AI
 * coaching note generator (api-server: POST /api/coaching/notes/{id}/generate).
 *
 * Batch/poll instead of a Pub/Sub push webhook — this is a post-session review
 * feature, not live, so a few minutes of latency is fine, and polling avoids
 * needing any Google Cloud Pub/Sub setup or a public webhook endpoint.
 *
 * Each schedule already maps 1:1 to its own Meeting Space (see
 * GoogleMeetSpaceService), so there is no ambiguous-matching step here —
 * the Space name alone identifies which schedule a transcript belongs to.
 */

const axios = require('axios');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getS3Client } = require('../config/clients');
const { config } = require('../config/environment');
const integrationService = require('./IntegrationService');
const moodleAdapter = require('../adapters/MoodleAdapter');
const apiServerAdapter = require('../adapters/ApiServerAdapter');
const logger = require('../utils/logger');

const MEET_API_BASE = 'https://meet.googleapis.com/v2';

class TranscriptSyncService {
  async syncPendingTranscripts() {
    const schedules = await apiServerAdapter.getPendingGoogleMeetSchedules();
    if (schedules.length === 0) {
      return;
    }
    logger.log(`[TranscriptSync] Checking ${schedules.length} pending Google Meet schedule(s)`);

    const accessToken = await integrationService.getValidOrganizerAccessToken('google');
    for (const schedule of schedules) {
      try {
        await this._syncOne(schedule, accessToken);
      } catch (err) {
        logger.error(
          `[TranscriptSync] Failed to sync schedule ${schedule.id}:`,
          err.response?.data || err.message
        );
      }
    }
  }

  async _syncOne(schedule, accessToken) {
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const recordsRes = await axios.get(`${MEET_API_BASE}/conferenceRecords`, {
      headers: authHeader,
      params: { filter: `space.name="${schedule.meet_space_name}"` },
      timeout: 10000,
    });
    const ended = (recordsRes.data.conferenceRecords || []).find(r => r.endTime);
    if (!ended) {
      return; // meeting hasn't happened (or hasn't ended) yet — retry next poll
    }

    const transcriptsRes = await axios.get(`${MEET_API_BASE}/${ended.name}/transcripts`, {
      headers: authHeader,
      timeout: 10000,
    });
    const transcript = (transcriptsRes.data.transcripts || [])[0];
    if (!transcript || transcript.state !== 'ENDED') {
      return; // Google hasn't finished generating the transcript yet — retry next poll
    }

    const rawEntries = await this._fetchAllEntries(transcript.name, authHeader);
    const transcriptEntries = await this._toTranscriptEntries(schedule, rawEntries, authHeader);

    const s3Key = `coaching-transcripts/${schedule.id}/${transcript.name.split('/').pop()}.json`;
    await getS3Client().send(new PutObjectCommand({
      Bucket: config.recordingsBucketName,
      Key: s3Key,
      Body: JSON.stringify({ coaching_schedule_id: schedule.id, entries: transcriptEntries }, null, 2),
      ContentType: 'application/json',
    }));

    // Recorded before note generation so a note-generation failure (e.g. AI
    // error) doesn't cause this same transcript to be re-fetched forever.
    await apiServerAdapter.upsertCoachingRecording(schedule.id, 'transcript', {
      source: 'google_meet',
      s3_bucket: config.recordingsBucketName,
      s3_key: s3Key,
      external_recording_id: transcript.name,
      status: 'completed',
    });

    await apiServerAdapter.generateCoachingNote(schedule.id, transcriptEntries);
    logger.log(`[TranscriptSync] Synced transcript and generated note for schedule ${schedule.id}`);
  }

  async _fetchAllEntries(transcriptName, authHeader) {
    const entries = [];
    let pageToken;
    do {
      const res = await axios.get(`${MEET_API_BASE}/${transcriptName}/entries`, {
        headers: authHeader,
        params: { pageSize: 100, pageToken },
        timeout: 10000,
      });
      entries.push(...(res.data.transcriptEntries || []));
      pageToken = res.data.nextPageToken;
    } while (pageToken);
    return entries;
  }

  /**
   * Map raw Meet transcript entries to {speaker, text, timestamp}, resolving
   * "speaker" to coach/client/unknown via a best-effort display-name match —
   * the Meet API's Participant resource exposes a display name, not an email,
   * so this can't be an exact match the way OAuth-based identity would be.
   */
  async _toTranscriptEntries(schedule, rawEntries, authHeader) {
    const [coachUsers, clientUsers] = await Promise.all([
      moodleAdapter.getUsersByField('id', [schedule.coach_user_id]),
      moodleAdapter.getUsersByField('id', [schedule.mdl_user_id]),
    ]);
    const coachName = coachUsers?.[0]?.fullname?.toLowerCase();
    const clientName = clientUsers?.[0]?.fullname?.toLowerCase();

    const participantNameCache = new Map();
    const result = [];
    for (const entry of rawEntries) {
      const displayName = await this._resolveParticipantName(entry.participant, authHeader, participantNameCache);
      const lowerName = displayName?.toLowerCase();

      let speaker = 'unknown';
      if (lowerName && coachName && lowerName.includes(coachName)) {
        speaker = 'coach';
      } else if (lowerName && clientName && lowerName.includes(clientName)) {
        speaker = 'client';
      }

      result.push({ speaker, text: entry.text, timestamp: entry.startTime || null });
    }
    return result;
  }

  async _resolveParticipantName(participantResourceName, authHeader, cache) {
    if (!participantResourceName) {
      return null;
    }
    if (cache.has(participantResourceName)) {
      return cache.get(participantResourceName);
    }

    let name = null;
    try {
      const res = await axios.get(`${MEET_API_BASE}/${participantResourceName}`, {
        headers: authHeader,
        timeout: 10000,
      });
      name = res.data.signedinUser?.displayName
        || res.data.anonymousUser?.displayName
        || res.data.phoneUser?.displayName
        || null;
    } catch (err) {
      logger.warn(`[TranscriptSync] Could not resolve participant ${participantResourceName}:`, err.message);
    }
    cache.set(participantResourceName, name);
    return name;
  }
}

module.exports = new TranscriptSyncService();

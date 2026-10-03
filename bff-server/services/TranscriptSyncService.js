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
 *
 * Note generation runs in the background on api-server (POST .../generate
 * returns 202), so a failure there is not seen here. Instead, every poll looks
 * for schedules whose transcript was fetched but which still have no note,
 * re-reads the transcript from S3 and asks again — up to
 * NOTE_GENERATION_MAX_ATTEMPTS times per schedule. Attempts are counted in
 * memory only, so a BFF restart starts the count over.
 */

const axios = require('axios');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getS3Client } = require('../config/clients');
const { config } = require('../config/environment');
const integrationService = require('./IntegrationService');
const moodleAdapter = require('../adapters/MoodleAdapter');
const apiServerAdapter = require('../adapters/ApiServerAdapter');
const logger = require('../utils/logger');

const MEET_API_BASE = 'https://meet.googleapis.com/v2';

class TranscriptSyncService {
  constructor() {
    // coaching_schedule_id -> number of note generation requests api-server accepted
    this.noteGenerationAttempts = new Map();
  }

  async syncPendingTranscripts() {
    // Retry first: a note requested later in this same run (by _syncOne) would
    // otherwise show up as "no note yet" while it is still being generated.
    try {
      await this.retryPendingNoteGenerations();
    } catch (err) {
      logger.error('[TranscriptSync] Failed to retry note generation:', err.response?.data || err.message);
    }

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
    // Transcript.state lifecycle: STARTED -> ENDED -> FILE_GENERATED. Only
    // FILE_GENERATED means the file is actually ready to read (confirmed via
    // a real test call — the same transcript that returned entries while
    // still ENDED had moved to FILE_GENERATED minutes later).
    if (!transcript || transcript.state !== 'FILE_GENERATED') {
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

    await this._requestNoteGeneration(schedule.id, transcriptEntries);
    logger.log(`[TranscriptSync] Synced transcript and requested note generation for schedule ${schedule.id}`);
  }

  /**
   * Ask api-server again for notes that are still missing (generation failed,
   * or api-server restarted mid-generation), re-reading the saved transcript
   * from S3 so Google Meet doesn't need to be queried again.
   */
  async retryPendingNoteGenerations() {
    const pending = await apiServerAdapter.getPendingNoteGenerations();
    const pendingIds = new Set(pending.map(p => p.coaching_schedule_id));

    // Forget schedules that now have a note, so the map doesn't grow forever
    for (const id of this.noteGenerationAttempts.keys()) {
      if (!pendingIds.has(id)) {
        this.noteGenerationAttempts.delete(id);
      }
    }

    const maxAttempts = config.noteGenerationMaxAttempts;
    for (const item of pending) {
      const scheduleId = item.coaching_schedule_id;
      if ((this.noteGenerationAttempts.get(scheduleId) || 0) >= maxAttempts) {
        continue; // gave up (already logged when the limit was reached)
      }
      try {
        const res = await getS3Client().send(new GetObjectCommand({ Bucket: item.s3_bucket, Key: item.s3_key }));
        const { entries } = JSON.parse(await res.Body.transformToString());
        logger.log(`[TranscriptSync] Retrying note generation for schedule ${scheduleId}`);
        await this._requestNoteGeneration(scheduleId, entries);
      } catch (err) {
        logger.error(
          `[TranscriptSync] Failed to retry note generation for schedule ${scheduleId}:`,
          err.response?.data || err.message
        );
      }
    }
  }

  /**
   * Request note generation and count the attempt. 'already_running' (the same
   * schedule is still being generated) is not counted. A rejected request
   * (e.g. 400 for an empty transcript) is counted, so it isn't retried forever.
   */
  async _requestNoteGeneration(scheduleId, transcriptEntries) {
    let result;
    try {
      result = await apiServerAdapter.generateCoachingNote(scheduleId, transcriptEntries);
    } catch (err) {
      this._countNoteGenerationAttempt(scheduleId);
      throw err;
    }
    if (result?.status !== 'already_running') {
      this._countNoteGenerationAttempt(scheduleId);
    }
    return result;
  }

  _countNoteGenerationAttempt(scheduleId) {
    const attempts = (this.noteGenerationAttempts.get(scheduleId) || 0) + 1;
    this.noteGenerationAttempts.set(scheduleId, attempts);
    if (attempts >= config.noteGenerationMaxAttempts) {
      logger.error(
        `[TranscriptSync] Note generation for schedule ${scheduleId} reached ${attempts} attempt(s); ` +
        'giving up until the BFF restarts (raise NOTE_GENERATION_MAX_ATTEMPTS or regenerate manually)'
      );
    }
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

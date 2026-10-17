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
const apiServerAdapter = require('../adapters/ApiServerAdapter');
const logger = require('../utils/logger');

const MEET_API_BASE = 'https://meet.googleapis.com/v2';

class TranscriptSyncService {
  constructor() {
    // coaching_schedule_id -> number of note generation requests api-server accepted
    this.noteGenerationAttempts = new Map();
    // schedules already warned about having only empty transcripts
    this.emptyTranscriptWarned = new Set();
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

    // One Space can hold several conference records: e.g. the coach joins
    // early alone and leaves, then the real session starts as a new record
    // (prod schedule 11, 2026-10-17: an empty 2-minute record came first and
    // was synced instead of the 1-hour session). So every record and every
    // transcript in the Space is read and merged in time order.
    const records = await this._listAll(
      `${MEET_API_BASE}/conferenceRecords`,
      { filter: `space.name="${schedule.meet_space_name}"` },
      'conferenceRecords',
      authHeader
    );
    if (records.length === 0 || records.some(r => !r.endTime)) {
      return; // not held yet, or still in progress — retry next poll
    }
    // Wait a while after the last record ended, in case the participants
    // rejoin (which starts another record) — once synced it isn't re-read.
    const lastEnd = Math.max(...records.map(r => Date.parse(r.endTime)));
    if (Date.now() - lastEnd < config.transcriptSettleMinutes * 60 * 1000) {
      return;
    }

    const transcripts = [];
    for (const record of records) {
      transcripts.push(...await this._listAll(`${MEET_API_BASE}/${record.name}/transcripts`, {}, 'transcripts', authHeader));
    }
    // Transcript.state lifecycle: STARTED -> ENDED -> FILE_GENERATED. Only
    // FILE_GENERATED means the file is actually ready to read (confirmed via
    // a real test call — the same transcript that returned entries while
    // still ENDED had moved to FILE_GENERATED minutes later).
    if (transcripts.some(t => t.state !== 'FILE_GENERATED')) {
      return; // Google hasn't finished generating a transcript yet — retry next poll
    }

    const rawEntries = [];
    for (const transcript of transcripts) {
      rawEntries.push(...await this._fetchAllEntries(transcript.name, authHeader));
    }
    if (rawEntries.length === 0) {
      // Nothing is saved, so this is checked again on later polls (in case
      // the session is held later in the same Space). Logged once per BFF
      // process as a warning, not an error, so #lms-alert isn't spammed.
      if (!this.emptyTranscriptWarned.has(schedule.id)) {
        this.emptyTranscriptWarned.add(schedule.id);
        logger.warn(
          `[TranscriptSync] Schedule ${schedule.id}: ${records.length} meeting(s) ended but ` +
          `${transcripts.length} transcript(s) have no entries (transcription not started?) — not syncing yet`
        );
      }
      return;
    }
    rawEntries.sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
    const transcriptEntries = await this._toTranscriptEntries(schedule, rawEntries, authHeader);

    // One file for the whole Space (all transcripts merged), listing which
    // transcripts went into it.
    const s3Key = `coaching-transcripts/${schedule.id}/${schedule.meet_space_name.split('/').pop()}.json`;
    await getS3Client().send(new PutObjectCommand({
      Bucket: config.recordingsBucketName,
      Key: s3Key,
      Body: JSON.stringify({
        coaching_schedule_id: schedule.id,
        transcripts: transcripts.map(t => t.name),
        entries: transcriptEntries,
      }, null, 2),
      ContentType: 'application/json',
    }));

    // Recorded before note generation so a note-generation failure (e.g. AI
    // error) doesn't cause this same transcript to be re-fetched forever.
    await apiServerAdapter.upsertCoachingRecording(schedule.id, 'transcript', {
      source: 'google_meet',
      s3_bucket: config.recordingsBucketName,
      s3_key: s3Key,
      // the Space, since the entries come from every transcript in it
      external_recording_id: schedule.meet_space_name,
      status: 'completed',
    });

    await this._requestNoteGeneration(schedule.id, transcriptEntries);
    logger.log(
      `[TranscriptSync] Synced ${transcriptEntries.length} entries from ${transcripts.length} transcript(s) ` +
      `and requested note generation for schedule ${schedule.id}`
    );
  }

  async _listAll(url, params, field, authHeader) {
    const items = [];
    let pageToken;
    do {
      const res = await axios.get(url, { headers: authHeader, params: { ...params, pageToken }, timeout: 10000 });
      items.push(...(res.data[field] || []));
      pageToken = res.data.nextPageToken;
    } while (pageToken);
    return items;
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
   * Map raw Meet transcript entries to {speaker, text, timestamp} with
   * speaker = coach/client/unknown. The Meet API gives a participant's
   * display name and Google user id, not an email, and the Google display
   * name often differs from the Moodle name (prod 2026-10-17: "Yu Takahashi"
   * vs the coach's Moodle name, so every entry came out 'unknown'), so
   * names aren't compared at all:
   *   1. the coach is the participant whose Google user is the Space's
   *      co-host member (added by email in GoogleMeetSpaceService);
   *   2. if exactly one other participant is left, they are the student
   *      (a coaching session is normally just the coach and the student).
   */
  async _toTranscriptEntries(schedule, rawEntries, authHeader) {
    const cohostUsers = await this._getCohostUsers(schedule.meet_space_name, authHeader);

    const participantCache = new Map();
    const participants = new Map(); // participant resource name -> { name, user }
    for (const entry of rawEntries) {
      if (entry.participant && !participants.has(entry.participant)) {
        participants.set(entry.participant, await this._resolveParticipant(entry.participant, authHeader, participantCache));
      }
    }

    // Keyed by Google user (or display name for anonymous joins), since the
    // same person gets a separate participant resource in each conference record.
    const personKey = p => p?.user || (p?.name ? `name:${p.name}` : null);
    const roles = new Map(); // personKey -> 'coach' | 'client'
    const people = new Map(); // personKey -> participant
    for (const p of participants.values()) {
      const key = personKey(p);
      if (key) people.set(key, p);
    }
    for (const [key, p] of people) {
      if (p.user && cohostUsers.has(p.user)) roles.set(key, 'coach');
    }
    const unassigned = [...people.keys()].filter(k => !roles.has(k));
    if (roles.size === 1 && unassigned.length === 1) {
      roles.set(unassigned[0], 'client');
    }
    if (roles.size < people.size) {
      logger.log(
        `[TranscriptSync] Schedule ${schedule.id} speakers: ` +
        [...people].map(([k, p]) => `${p.name || '?'}=${roles.get(k) || 'unknown'}`).join(', ')
      );
    }

    return rawEntries.map(entry => ({
      speaker: roles.get(personKey(participants.get(entry.participant))) || 'unknown',
      text: entry.text,
      timestamp: entry.startTime || null,
    }));
  }

  /** Google user ids ("users/...") of the Space's co-host members (= the coach). */
  async _getCohostUsers(spaceName, authHeader) {
    try {
      const members = await this._listAll(`${MEET_API_BASE}/${spaceName}/members`, {}, 'members', authHeader);
      // `user` came back empty in prod (2026-10-17), but the member id in
      // `name` ("spaces/X/members/114039...") was the same number as the
      // participant's signedinUser.user ("users/114039...").
      return new Set(members
        .filter(m => m.role === 'COHOST')
        .map(m => m.user || (m.name ? `users/${m.name.split('/').pop()}` : null))
        .filter(Boolean));
    } catch (err) {
      logger.warn(`[TranscriptSync] Could not list members of ${spaceName}:`, err.response?.data || err.message);
      return new Set();
    }
  }

  async _resolveParticipant(participantResourceName, authHeader, cache) {
    if (cache.has(participantResourceName)) {
      return cache.get(participantResourceName);
    }

    let participant = { name: null, user: null };
    try {
      const res = await axios.get(`${MEET_API_BASE}/${participantResourceName}`, {
        headers: authHeader,
        timeout: 10000,
      });
      participant = {
        name: res.data.signedinUser?.displayName
          || res.data.anonymousUser?.displayName
          || res.data.phoneUser?.displayName
          || null,
        user: res.data.signedinUser?.user || null,
      };
    } catch (err) {
      logger.warn(`[TranscriptSync] Could not resolve participant ${participantResourceName}:`, err.message);
    }
    cache.set(participantResourceName, participant);
    return participant;
  }
}

module.exports = new TranscriptSyncService();

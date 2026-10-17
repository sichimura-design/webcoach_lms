/**
 * Unit tests for TranscriptSyncService's note generation retry
 * Run with: node --test services/TranscriptSyncService.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

// getS3Client is destructured when TranscriptSyncService is required, so stub it first
const clients = require('../config/clients');
const s3Requests = [];
clients.getS3Client = () => ({
  send: async (command) => {
    s3Requests.push(command.input);
    return {
      Body: { transformToString: async () => JSON.stringify({ entries: [{ speaker: 'coach', text: 'hi' }] }) },
    };
  },
});

const { config } = require('../config/environment');
const apiServerAdapter = require('../adapters/ApiServerAdapter');
const logger = require('../utils/logger');
const transcriptSyncService = require('./TranscriptSyncService');

logger.log = () => {};
logger.error = () => {};

function setup({ pending, generate }) {
  transcriptSyncService.noteGenerationAttempts.clear();
  s3Requests.length = 0;
  const calls = [];
  apiServerAdapter.getPendingNoteGenerations = async () => pending();
  apiServerAdapter.getPendingGoogleMeetSchedules = async () => [];
  apiServerAdapter.generateCoachingNote = async (id, entries) => {
    calls.push({ id, entries });
    return generate(id);
  };
  return calls;
}

const PENDING = [{ coaching_schedule_id: 7, s3_bucket: 'bucket', s3_key: 'coaching-transcripts/7/t.json' }];

test('re-reads the transcript from S3 and asks api-server again', async () => {
  const calls = setup({ pending: () => PENDING, generate: () => ({ status: 'started' }) });

  await transcriptSyncService.syncPendingTranscripts();

  assert.deepStrictEqual(s3Requests, [{ Bucket: 'bucket', Key: 'coaching-transcripts/7/t.json' }]);
  assert.deepStrictEqual(calls, [{ id: 7, entries: [{ speaker: 'coach', text: 'hi' }] }]);
  assert.strictEqual(transcriptSyncService.noteGenerationAttempts.get(7), 1);
});

test('stops retrying after NOTE_GENERATION_MAX_ATTEMPTS', async () => {
  const calls = setup({ pending: () => PENDING, generate: () => ({ status: 'started' }) });

  for (let i = 0; i < config.noteGenerationMaxAttempts + 2; i++) {
    await transcriptSyncService.syncPendingTranscripts();
  }

  assert.strictEqual(calls.length, config.noteGenerationMaxAttempts);
});

test('does not count a request while the same note is still being generated', async () => {
  const calls = setup({ pending: () => PENDING, generate: () => ({ status: 'already_running' }) });

  for (let i = 0; i < config.noteGenerationMaxAttempts + 2; i++) {
    await transcriptSyncService.syncPendingTranscripts();
  }

  assert.strictEqual(calls.length, config.noteGenerationMaxAttempts + 2);
  assert.strictEqual(transcriptSyncService.noteGenerationAttempts.get(7) || 0, 0);
});

test('counts a rejected request so it is not retried forever', async () => {
  const calls = setup({
    pending: () => PENDING,
    generate: () => { throw Object.assign(new Error('400'), { response: { data: 'empty' } }); },
  });

  for (let i = 0; i < config.noteGenerationMaxAttempts + 2; i++) {
    await transcriptSyncService.syncPendingTranscripts();
  }

  assert.strictEqual(calls.length, config.noteGenerationMaxAttempts);
});

test('forgets the count once the note exists', async () => {
  let pending = PENDING;
  setup({ pending: () => pending, generate: () => ({ status: 'started' }) });

  await transcriptSyncService.syncPendingTranscripts();
  assert.strictEqual(transcriptSyncService.noteGenerationAttempts.get(7), 1);

  pending = [];
  await transcriptSyncService.syncPendingTranscripts();
  assert.strictEqual(transcriptSyncService.noteGenerationAttempts.has(7), false);
});

test('a failure while retrying does not stop the new-transcript sync', async () => {
  setup({ pending: () => { throw new Error('api-server down'); }, generate: () => ({ status: 'started' }) });
  let synced = false;
  apiServerAdapter.getPendingGoogleMeetSchedules = async () => { synced = true; return []; };

  await transcriptSyncService.syncPendingTranscripts();

  assert.strictEqual(synced, true);
});

// --- transcript sync across several conference records (prod schedule 11, 2026-10-17) ---

const axios = require('axios');
const integrationService = require('./IntegrationService');

const MIN = 60 * 1000;
// Fixed "now": 2026-10-17 14:00 JST, the coaching day of the schedule below
const NOW = Date.parse('2026-10-17T05:00:00Z');
const realDateNow = Date.now;
const ago = (m) => new Date(NOW - m * MIN).toISOString();
test.after(() => { Date.now = realDateNow; });

function setupMeet({ records, transcripts, entries, participants, members = [], now = NOW }) {
  setup({ pending: () => [], generate: () => ({ status: 'started' }) });
  Date.now = () => now;
  const errors = [];
  logger.error = (...a) => { errors.push(a.join(' ')); };
  transcriptSyncService.emptyTranscriptWarned.clear();
  const upserts = [];
  const generated = [];
  apiServerAdapter.getPendingGoogleMeetSchedules = async () => [
    { id: 11, coach_user_id: 89, mdl_user_id: 113, meet_space_name: 'spaces/S', coaching_date: '2026-10-17' },
  ];
  apiServerAdapter.upsertCoachingRecording = async (id, type, data) => { upserts.push({ id, type, data }); };
  apiServerAdapter.generateCoachingNote = async (id, e) => { generated.push({ id, entries: e }); return { status: 'started' }; };
  integrationService.getValidOrganizerAccessToken = async () => 'token';
  axios.get = async (url) => {
    const path = url.replace('https://meet.googleapis.com/v2/', '');
    if (path === 'conferenceRecords') return { data: { conferenceRecords: records } };
    if (path === 'spaces/S/members') return { data: { members } };
    if (path.endsWith('/transcripts')) return { data: { transcripts: transcripts[path.split('/')[1]] || [] } };
    if (path.endsWith('/entries')) return { data: { transcriptEntries: entries[path.replace('/entries', '')] || [] } };
    if (participants[path]) return { data: participants[path] };
    throw new Error(`unexpected GET ${url}`);
  };
  return { upserts, generated, errors };
}

const THREE_RECORDS = {
  // coach alone and empty, then student alone, then the real session
  records: [
    { name: 'conferenceRecords/r3', startTime: ago(120), endTime: ago(60) },
    { name: 'conferenceRecords/r2', startTime: ago(130), endTime: ago(125) },
    { name: 'conferenceRecords/r1', startTime: ago(150), endTime: ago(148) },
  ],
  transcripts: {
    r1: [{ name: 'conferenceRecords/r1/transcripts/t1', state: 'FILE_GENERATED' }],
    r3: [{ name: 'conferenceRecords/r3/transcripts/t3', state: 'FILE_GENERATED' }],
  },
  entries: {
    'conferenceRecords/r3/transcripts/t3': [
      { participant: 'conferenceRecords/r3/participants/c', text: 'こんにちは', startTime: '2026-10-17T01:29:41Z' },
      { participant: 'conferenceRecords/r3/participants/s', text: 'よろしくお願いします', startTime: '2026-10-17T01:29:50Z' },
    ],
  },
  participants: {
    'conferenceRecords/r3/participants/c': { signedinUser: { user: 'users/coach', displayName: 'Yu Takahashi' } },
    'conferenceRecords/r3/participants/s': { signedinUser: { user: 'users/student', displayName: 'Chihaya' } },
  },
  // as returned in prod: no `user`, the Google user id is the member id
  members: [{ name: 'spaces/S/members/coach', email: 'coach@example.com', role: 'COHOST' }],
};

test('reads every meeting in the Space, not just the first (empty) one', async () => {
  const { upserts, generated } = setupMeet(THREE_RECORDS);

  await transcriptSyncService.syncPendingTranscripts();

  assert.deepStrictEqual(generated[0].entries.map(e => [e.speaker, e.text]), [
    ['coach', 'こんにちは'],
    ['client', 'よろしくお願いします'],
  ]);
  assert.strictEqual(upserts[0].data.external_recording_id, 'spaces/S');
  assert.strictEqual(upserts[0].data.s3_key, 'coaching-transcripts/11/S.json');
});

test('waits for the settle time after the last meeting ends', async () => {
  const { upserts } = setupMeet({
    ...THREE_RECORDS,
    records: [{ ...THREE_RECORDS.records[0], endTime: ago(config.transcriptSettleMinutes - 5) }, ...THREE_RECORDS.records.slice(1)],
  });

  await transcriptSyncService.syncPendingTranscripts();

  assert.strictEqual(upserts.length, 0);
});

test('does not finalize when every transcript is empty', async () => {
  const { upserts, generated } = setupMeet({ ...THREE_RECORDS, entries: {} });

  await transcriptSyncService.syncPendingTranscripts();

  assert.strictEqual(upserts.length, 0);
  assert.strictEqual(generated.length, 0);
});

test('leaves both speakers unknown and alerts when the co-host is not among them', async () => {
  const { generated, errors } = setupMeet({ ...THREE_RECORDS, members: [] });

  await transcriptSyncService.syncPendingTranscripts();

  assert.deepStrictEqual(generated[0].entries.map(e => e.speaker), ['unknown', 'unknown']);
  assert.match(errors.join('\n'), /ERROR: schedule 11 .*コーチを判定できず失敗/);
});

test('uses the member `user` field when Google returns it', async () => {
  const { generated, errors } = setupMeet({
    ...THREE_RECORDS,
    members: [{ name: 'spaces/S/members/other-id', role: 'COHOST', user: 'users/coach' }],
  });

  await transcriptSyncService.syncPendingTranscripts();

  assert.deepStrictEqual(generated[0].entries.map(e => e.speaker), ['coach', 'client']);
  assert.deepStrictEqual(errors, []);
});

// The coach tries the link early, says one word and leaves; the real
// session comes later the same day.
const COACH_ONLY = {
  ...THREE_RECORDS,
  records: [{ name: 'conferenceRecords/r1', startTime: ago(150), endTime: ago(148) }],
  entries: {
    'conferenceRecords/r1/transcripts/t1': [
      { participant: 'conferenceRecords/r1/participants/c', text: 'テスト', startTime: ago(149) },
    ],
  },
  participants: {
    'conferenceRecords/r1/participants/c': { signedinUser: { user: 'users/coach', displayName: 'Yu Takahashi' } },
  },
};

test('does not finalize on one speaker while the coaching day is not over', async () => {
  const { upserts } = setupMeet(COACH_ONLY);

  await transcriptSyncService.syncPendingTranscripts();

  assert.strictEqual(upserts.length, 0);
});

test('finalizes on one speaker once the coaching day (JST) is over', async () => {
  const { upserts, generated } = setupMeet({ ...COACH_ONLY, now: Date.parse('2026-10-17T15:00:00Z') });

  await transcriptSyncService.syncPendingTranscripts();

  assert.strictEqual(upserts.length, 1);
  assert.deepStrictEqual(generated[0].entries.map(e => [e.speaker, e.text]), [['coach', 'テスト']]);
});

test('ignores meetings that ended before the coaching day', async () => {
  // a link check the day before, then the real session
  const { generated } = setupMeet({
    ...THREE_RECORDS,
    records: [
      THREE_RECORDS.records[0],
      { name: 'conferenceRecords/r1', startTime: ago(24 * 60), endTime: ago(24 * 60 - 2) },
    ],
    entries: {
      ...THREE_RECORDS.entries,
      'conferenceRecords/r1/transcripts/t1': [
        { participant: 'conferenceRecords/r3/participants/c', text: '前日のテスト', startTime: ago(24 * 60 - 1) },
      ],
    },
  });

  await transcriptSyncService.syncPendingTranscripts();

  assert.deepStrictEqual(generated[0].entries.map(e => e.text), ['こんにちは', 'よろしくお願いします']);
});

test('orders entries by time even when fractional seconds differ in length', async () => {
  const { generated } = setupMeet({
    ...THREE_RECORDS,
    entries: {
      'conferenceRecords/r3/transcripts/t3': [
        { participant: 'conferenceRecords/r3/participants/s', text: 'B', startTime: '2026-10-17T01:29:41.5Z' },
        { participant: 'conferenceRecords/r3/participants/c', text: 'A', startTime: '2026-10-17T01:29:41Z' },
      ],
    },
  });

  await transcriptSyncService.syncPendingTranscripts();

  assert.deepStrictEqual(generated[0].entries.map(e => e.text), ['A', 'B']);
});

test('merges entries from every transcript in time order', async () => {
  const { generated } = setupMeet({
    ...THREE_RECORDS,
    entries: {
      ...THREE_RECORDS.entries,
      'conferenceRecords/r1/transcripts/t1': [
        { participant: 'conferenceRecords/r3/participants/c', text: '早く入りました', startTime: '2026-10-17T00:59:00Z' },
      ],
    },
  });

  await transcriptSyncService.syncPendingTranscripts();

  assert.deepStrictEqual(generated[0].entries.map(e => e.text), ['早く入りました', 'こんにちは', 'よろしくお願いします']);
});

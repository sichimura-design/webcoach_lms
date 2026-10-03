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

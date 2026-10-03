/**
 * Unit tests for RuntimeSettingsService
 * Run with: node --test services/RuntimeSettingsService.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

// getSsmClient/getEcsClient are destructured when the service is required, so stub them first
const clients = require('../config/clients');
const ssmCalls = [];
const ecsCalls = [];
let ssmParameters = {};
let ecsDeployments = [{ rolloutState: 'COMPLETED' }];
clients.getSsmClient = () => ({
  send: async (command) => {
    const name = command.constructor.name;
    ssmCalls.push({ name, input: command.input });
    if (name === 'GetParametersByPathCommand') {
      const prefix = `${command.input.Path}/`;
      return {
        Parameters: Object.entries(ssmParameters)
          .filter(([n]) => n.startsWith(prefix))
          .map(([Name, Value]) => ({ Name, Value })),
      };
    }
    if (name === 'DeleteParameterCommand' && !(command.input.Name in ssmParameters)) {
      throw Object.assign(new Error('not found'), { name: 'ParameterNotFound' });
    }
    return {};
  },
});
clients.getEcsClient = () => ({
  send: async (command) => {
    const name = command.constructor.name;
    ecsCalls.push({ name, input: command.input });
    if (name === 'DescribeServicesCommand') {
      return { services: [{ deployments: ecsDeployments, runningCount: 2, desiredCount: 2 }] };
    }
    return {};
  },
});

const { config } = require('../config/environment');
const apiServerAdapter = require('../adapters/ApiServerAdapter');
const logger = require('../utils/logger');
const service = require('./RuntimeSettingsService');

logger.log = () => {};
logger.error = () => {};

const API_VALUES = {
  AI_CHAT_MAX_OUTPUT_TOKENS: 1024,
  AI_CHAT_MAX_INPUT_TOKENS: 5000,
  AI_CHAT_MAX_HISTORY_MESSAGE_CHARS: 1200,
  COACHING_NOTE_MAX_OUTPUT_TOKENS: 4096,
};

function setup({ prod }) {
  ssmCalls.length = 0;
  ecsCalls.length = 0;
  ssmParameters = {};
  ecsDeployments = [{ rolloutState: 'COMPLETED' }];
  Object.assign(config, prod
    ? {
      useParameterStore: true,
      apiParameterStorePrefix: '/lms/prod/api-server',
      bffParameterStorePrefix: '/lms/prod/bff-server',
      ecsClusterName: 'prod-lms-cluster',
      ecsServiceName: 'prod-lms-service',
    }
    : {
      useParameterStore: false,
      apiParameterStorePrefix: '',
      bffParameterStorePrefix: '',
      ecsClusterName: '',
      ecsServiceName: '',
    });
  apiServerAdapter.getRuntimeSettings = async () => ({ ...API_VALUES });
}

test('dev: shows current values read-only without touching AWS', async () => {
  setup({ prod: false });

  const result = await service.list();

  assert.strictEqual(result.editable, false);
  assert.deepStrictEqual(result.restart, { available: false });
  const note = result.settings.find((s) => s.name === 'COACHING_NOTE_MAX_OUTPUT_TOKENS');
  assert.strictEqual(note.current, 4096);
  assert.strictEqual(note.pendingRestart, false);
  const attempts = result.settings.find((s) => s.name === 'NOTE_GENERATION_MAX_ATTEMPTS');
  assert.strictEqual(attempts.current, config.noteGenerationMaxAttempts);
  assert.strictEqual(ssmCalls.length, 0);
  assert.strictEqual(ecsCalls.length, 0);
  await assert.rejects(service.update('AI_CHAT_MAX_OUTPUT_TOKENS', '2048', 'admin'), { statusCode: 409 });
  await assert.rejects(service.restart('admin'), { statusCode: 409 });
});

test('prod: a saved value that differs from the running one is pending restart', async () => {
  setup({ prod: true });
  ssmParameters = {
    '/lms/prod/api-server/config/coaching-note-max-output-tokens': '6000',
    '/lms/prod/api-server/config/ai-chat-max-output-tokens': '1024',
  };

  const { editable, settings } = await service.list();

  assert.strictEqual(editable, true);
  const note = settings.find((s) => s.name === 'COACHING_NOTE_MAX_OUTPUT_TOKENS');
  assert.strictEqual(note.saved, 6000);
  assert.strictEqual(note.pendingRestart, true);
  const chat = settings.find((s) => s.name === 'AI_CHAT_MAX_OUTPUT_TOKENS');
  assert.strictEqual(chat.saved, 1024);
  assert.strictEqual(chat.pendingRestart, false);
});

test('prod: saves to the right parameter name', async () => {
  setup({ prod: true });

  await service.update('NOTE_GENERATION_MAX_ATTEMPTS', '5', 'admin@example.com');

  assert.deepStrictEqual(ssmCalls.pop(), {
    name: 'PutParameterCommand',
    input: {
      Name: '/lms/prod/bff-server/config/note-generation-max-attempts',
      Value: '5',
      Type: 'String',
      Overwrite: true,
    },
  });
});

test('rejects values out of range, non-integers and unknown names', async () => {
  setup({ prod: true });

  for (const value of ['0', '11', '2.5', 'abc', '', null]) {
    await assert.rejects(service.update('NOTE_GENERATION_MAX_ATTEMPTS', value, 'admin'), { statusCode: 400 });
  }
  await assert.rejects(service.update('SESSION_SECRET', '1', 'admin'), { statusCode: 404 });
  assert.strictEqual(ssmCalls.length, 0);
});

test('reset deletes the parameter and ignores one that is already gone', async () => {
  setup({ prod: true });

  await service.reset('AI_CHAT_MAX_INPUT_TOKENS', 'admin');

  assert.deepStrictEqual(ssmCalls.pop(), {
    name: 'DeleteParameterCommand',
    input: { Name: '/lms/prod/api-server/config/ai-chat-max-input-tokens' },
  });
});

test('restart forces a new deployment, but not while one is already rolling', async () => {
  setup({ prod: true });

  await service.restart('admin');
  assert.deepStrictEqual(ecsCalls.pop(), {
    name: 'UpdateServiceCommand',
    input: { cluster: 'prod-lms-cluster', service: 'prod-lms-service', forceNewDeployment: true },
  });

  ecsDeployments = [{ rolloutState: 'IN_PROGRESS' }, { rolloutState: 'COMPLETED' }];
  await assert.rejects(service.restart('admin'), { statusCode: 409 });
  assert.strictEqual(ecsCalls.at(-1).name, 'DescribeServicesCommand');
});

test('still lists bff values when api-server is unreachable', async () => {
  setup({ prod: false });
  apiServerAdapter.getRuntimeSettings = async () => { throw new Error('down'); };

  const { settings } = await service.list();

  assert.strictEqual(settings.find((s) => s.name === 'AI_CHAT_MAX_OUTPUT_TOKENS').current, null);
  assert.strictEqual(settings.find((s) => s.name === 'REMINDER_INTERVAL_MINUTES').current, config.reminderIntervalMinutes);
});

/**
 * Unit tests for ModelLifecycleService
 * Run with: node --test services/ModelLifecycleService.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const axios = require('axios');
const logger = require('../utils/logger');
const service = require('./ModelLifecycleService');

logger.error = () => {};

const PAGE = `
## Model status

| API model name             | Current state | Deprecated         | Tentative retirement date          |
| :------------------------- | :------------ | :----------------- | :--------------------------------- |
| claude-opus-4-6            | Active        | N/A                | Not sooner than February 5, 2027   |
| claude-sonnet-4-5-20250929 | Deprecated    | September 30, 2026 | November 30, 2026                  |
| claude-haiku-4-5-20251001  | Active        | N/A                | Not sooner than October 15, 2026   |

### 2026-09-30: Claude Sonnet 4.5 model

| Retirement date   | Deprecated model             | Recommended replacement |
| ----------------- | ---------------------------- | ----------------------- |
| November 30, 2026 | \`claude-sonnet-4-5-20250929\` | \`claude-sonnet-5-5\`     |
`;

const NOW = new Date('2026-10-05T12:00:00+09:00');
let fetches = 0;

function stub(data) {
  fetches = 0;
  service._cache = { at: 0, rows: null };
  axios.get = async () => { fetches += 1; if (data instanceof Error) throw data; return { data }; };
}

test('reads the status table and only the status table', () => {
  const rows = service.parseStatusTable(PAGE);
  assert.deepStrictEqual(Object.keys(rows), ['claude-opus-4-6', 'claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001']);
});

test('describes an active model with a not-sooner-than date, and warns when it is near', async () => {
  stub(PAGE);

  const { lifecycle } = await service.describe('claude-haiku-4-5-20251001', NOW);

  assert.strictEqual(lifecycle.state, 'active');
  assert.strictEqual(lifecycle.retirementOn, '2026-10-15');
  assert.strictEqual(lifecycle.retirementNotSoonerThan, true);
  assert.strictEqual(lifecycle.daysUntilRetirement, 9);
  assert.strictEqual(lifecycle.warning, true);
});

test('matches an alias without the date and does not warn when far away', async () => {
  stub(PAGE);

  const { lifecycle } = await service.describe('claude-opus-4-6', NOW);
  const alias = await service.describe('claude-sonnet-4-5', NOW);

  assert.strictEqual(lifecycle.warning, false);
  assert.strictEqual(alias.lifecycle.state, 'deprecated');
  assert.strictEqual(alias.lifecycle.deprecatedOn, '2026-09-30');
  assert.strictEqual(alias.lifecycle.retirementNotSoonerThan, false);
  assert.strictEqual(fetches, 1);
});

test('returns no lifecycle (link only) when the page cannot be read or the model is unknown', async () => {
  stub(new Error('network'));
  assert.strictEqual((await service.describe('claude-haiku-4-5-20251001', NOW)).lifecycle, null);

  stub('<html>no table</html>');
  assert.strictEqual((await service.describe('claude-haiku-4-5-20251001', NOW)).lifecycle, null);

  stub(PAGE);
  const unknown = await service.describe('claude-unknown-9', NOW);
  assert.strictEqual(unknown.lifecycle, null);
  assert.ok(unknown.sourceUrl.startsWith('https://platform.claude.com/'));
});

/**
 * Unit tests for UserService.getOrCreateMoodleUser のキャッシュ
 * Run with: node --test services/UserService.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const moodleAdapter = require('../adapters/MoodleAdapter');
const userService = require('./UserService');

const originalGetUsersByField = moodleAdapter.getUsersByField;
const originalUpdateUsers = moodleAdapter.updateUsers;

function stubMoodle(users) {
  const calls = [];
  moodleAdapter.getUsersByField = async (field, values) => {
    calls.push({ field, values });
    await new Promise((r) => setTimeout(r, 5));
    return users;
  };
  moodleAdapter.updateUsers = async () => ({});
  return calls;
}

test.afterEach(() => {
  moodleAdapter.getUsersByField = originalGetUsersByField;
  moodleAdapter.updateUsers = originalUpdateUsers;
});

test('2回目以降は Moodle に問い合わせずキャッシュを返す', async () => {
  const calls = stubMoodle([{ id: 11, username: 'u11', email: 'a@example.com' }]);
  const payload = { sub: 'sub-cache-1', email: 'a@example.com' };

  const first = await userService.getOrCreateMoodleUser(payload);
  const second = await userService.getOrCreateMoodleUser(payload);

  assert.deepStrictEqual(first, { id: 11, username: 'u11' });
  assert.deepStrictEqual(second, first);
  assert.strictEqual(calls.length, 1);
});

test('同時に来たリクエストは問い合わせを1回にまとめる', async () => {
  const calls = stubMoodle([{ id: 12, username: 'u12', email: 'b@example.com' }]);
  const payload = { sub: 'sub-cache-2', email: 'b@example.com' };

  const results = await Promise.all(
    Array.from({ length: 10 }, () => userService.getOrCreateMoodleUser(payload))
  );

  assert.ok(results.every((r) => r.id === 12));
  assert.strictEqual(calls.length, 1);
});

test('メールが変わったときはキャッシュを使わず問い合わせ直す', async () => {
  const calls = stubMoodle([{ id: 13, username: 'u13', email: 'c@example.com' }]);

  await userService.getOrCreateMoodleUser({ sub: 'sub-cache-3', email: 'c@example.com' });
  await userService.getOrCreateMoodleUser({ sub: 'sub-cache-3', email: 'c2@example.com' });

  assert.strictEqual(calls.length, 2);
});

test('失敗した結果は覚えず、次のリクエストで問い合わせ直す', async () => {
  let n = 0;
  moodleAdapter.getUsersByField = async () => {
    n += 1;
    if (n === 1) throw new Error('timeout');
    return [{ id: 14, username: 'u14', email: 'd@example.com' }];
  };
  const payload = { sub: 'sub-cache-4', email: 'd@example.com' };

  await assert.rejects(userService.getOrCreateMoodleUser(payload));
  const user = await userService.getOrCreateMoodleUser(payload);

  assert.strictEqual(user.id, 14);
  assert.strictEqual(n, 2);
});

/**
 * Unit tests for requireAuth の最終アクセス更新の間引き
 * Run with: node --test middleware/auth.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const { shouldUpdateLastAccess } = require('./auth');

const at = (iso) => new Date(iso).getTime();

test('同じユーザーへは5分以内に再送しない', () => {
  assert.strictEqual(shouldUpdateLastAccess(101, at('2026-10-08T10:00:00+09:00')), true);
  assert.strictEqual(shouldUpdateLastAccess(101, at('2026-10-08T10:04:59+09:00')), false);
  assert.strictEqual(shouldUpdateLastAccess(101, at('2026-10-08T10:05:00+09:00')), true);
});

test('ユーザーごとに別々に数える', () => {
  assert.strictEqual(shouldUpdateLastAccess(201, at('2026-10-08T10:00:00+09:00')), true);
  assert.strictEqual(shouldUpdateLastAccess(202, at('2026-10-08T10:00:01+09:00')), true);
});

test('日付(JST)が変わったら5分以内でも送る(その日のログイン記録のため)', () => {
  assert.strictEqual(shouldUpdateLastAccess(301, at('2026-10-08T23:59:00+09:00')), true);
  assert.strictEqual(shouldUpdateLastAccess(301, at('2026-10-09T00:01:00+09:00')), true);
});

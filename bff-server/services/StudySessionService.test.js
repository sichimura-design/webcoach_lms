/**
 * Unit tests for StudySessionService
 * Run with: node --test services/StudySessionService.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const { planSegmentCorrections, planCourseOverrides } = require('./StudySessionService');

const seg = (id, min) => ({ ended_log_id: id, duration_minutes: min });

test('増やすときは直前の区間へ1件', () => {
  assert.deepStrictEqual(planSegmentCorrections([seg(1, 7), seg(2, 7)], 1), [{ endedLogId: undefined, delta: 1 }]);
});

test('最後の区間で吸収できる減少は直前の区間へ1件', () => {
  assert.deepStrictEqual(planSegmentCorrections([seg(1, 30), seg(2, 5)], -3), [{ endedLogId: undefined, delta: -3 }]);
});

test('30分+5分を20分に直すと、前の区間も名指しで減らす', () => {
  assert.deepStrictEqual(planSegmentCorrections([seg(1, 30), seg(2, 5)], -15), [
    { endedLogId: undefined, delta: -5 },
    { endedLogId: 1, delta: -10 },
  ]);
});

test('破棄(合計0分)は全区間を0にする。0分の区間は飛ばす', () => {
  assert.deepStrictEqual(planSegmentCorrections([seg(1, 10), seg(2, 0), seg(3, 4)], -14), [
    { endedLogId: undefined, delta: -4 },
    { endedLogId: 1, delta: -10 },
  ]);
});

test('区間の合計より大きく減らしても区間の分数を超えては割り振らない', () => {
  assert.deepStrictEqual(planSegmentCorrections([seg(1, 2)], -5), [{ endedLogId: undefined, delta: -2 }]);
});

const cseg = (id, courseid) => ({ ended_log_id: id, duration_minutes: 5, courseid });

test('教材の置き換え: 選んだ教材と違う区間だけ0分の補正を作る', () => {
  assert.deepStrictEqual(planCourseOverrides([cseg(1, null), cseg(2, 12), cseg(3, 7)], 12), [
    { endedLogId: 1, delta: 0 },
    { endedLogId: 3, delta: 0 },
  ]);
});

test('教材の置き換え: 時間の補正で既に教材を付けた区間は除く', () => {
  assert.deepStrictEqual(planCourseOverrides([cseg(1, null), cseg(2, null)], '12', new Set([2])), [
    { endedLogId: 1, delta: 0 },
  ]);
});

test('教材の置き換え: 教材を指定しないときは何もしない', () => {
  assert.deepStrictEqual(planCourseOverrides([cseg(1, 12)], undefined), []);
});

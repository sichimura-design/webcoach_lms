const test = require('node:test');
const assert = require('node:assert');
const { buildHints, scheduleStage, summarizeCognitoUser } = require('./SupportLookupService');

const NOW = new Date('2026-10-20T03:00:00Z'); // 2026-10-20 12:00 JST
const TODAY = '2026-10-20';

function cognitoUser(overrides = {}) {
  return {
    Username: 'taro',
    UserStatus: 'CONFIRMED',
    Enabled: true,
    UserCreateDate: '2026-10-01T00:00:00Z',
    UserLastModifiedDate: '2026-10-01T00:00:00Z',
    Attributes: [
      { Name: 'sub', Value: 'sub-1' },
      { Name: 'email_verified', Value: 'true' },
    ],
    ...overrides,
  };
}

const moodle = { id: 10, fullname: '山田 太郎', lastaccess: NOW.getTime() / 1000 - 60, suspended: false };

function texts(hints) {
  return hints.map(h => `${h.level}:${h.text}`).join('\n');
}

test('アカウントが無ければ登録アドレス違いを案内して終わる', () => {
  const hints = buildHints({ cognito: null, moodle: null }, NOW);
  assert.strictEqual(hints.length, 1);
  assert.strictEqual(hints[0].level, 'danger');
  assert.match(hints[0].text, /アカウントはありません/);
});

test('仮パスワードは最終更新から7日で期限切れとみなす', () => {
  const fresh = summarizeCognitoUser(cognitoUser({ UserStatus: 'FORCE_CHANGE_PASSWORD', UserLastModifiedDate: '2026-10-14T00:00:00Z' }), ['student'], NOW);
  assert.strictEqual(fresh.tempPasswordExpired, false);
  assert.strictEqual(fresh.tempPasswordExpiresAt, '2026-10-21T00:00:00.000Z');

  const old = summarizeCognitoUser(cognitoUser({ UserStatus: 'FORCE_CHANGE_PASSWORD', UserLastModifiedDate: '2026-10-12T00:00:00Z' }), ['student'], NOW);
  assert.strictEqual(old.tempPasswordExpired, true);
  const hints = buildHints({ cognito: old, moodle: null }, NOW);
  assert.strictEqual(hints[0].level, 'danger');
  assert.match(hints[0].text, /仮パスワードの有効期限/);
  assert.match(hints[0].text, /パスワードお忘れですか？/);
});

test('仮パスワード以外のユーザーには期限を付けない', () => {
  const c = summarizeCognitoUser(cognitoUser(), ['student'], NOW);
  assert.strictEqual(c.tempPasswordExpiresAt, null);
  assert.strictEqual(c.tempPasswordExpired, false);
});

test('パスワード設定済みなのに学習データが無ければ初期処理の失敗を疑う', () => {
  const c = summarizeCognitoUser(cognitoUser(), ['student'], NOW);
  assert.match(texts(buildHints({ cognito: c, moodle: null }, NOW)), /warning:.*学習データがありません/);
});

test('無効・停止・役割なしはそれぞれ出し、重い順に並べる', () => {
  const c = summarizeCognitoUser(cognitoUser({ Enabled: false }), [], NOW);
  const hints = buildHints({ cognito: c, moodle: { ...moodle, suspended: true } }, NOW);
  assert.deepStrictEqual(hints.map(h => h.level), ['danger', 'danger', 'warning']);
  assert.match(texts(hints), /無効/);
  assert.match(texts(hints), /停止/);
  assert.match(texts(hints), /役割/);
});

test('受講生: コーチ未割り当てを知らせる', () => {
  const c = summarizeCognitoUser(cognitoUser(), ['student'], NOW);
  const hints = buildHints({ cognito: c, moodle, coach: { id: null }, schedules: [] }, NOW);
  assert.match(texts(hints), /担当コーチが割り当てられていません/);
  assert.doesNotMatch(texts(hints), /予約はありません/);
});

test('受講生: 未公開・自動作成失敗の回を回数つきで知らせる', () => {
  const c = summarizeCognitoUser(cognitoUser(), ['student'], NOW);
  const schedules = [
    { coachingNo: 3, coachingDate: '2026-10-27', stage: 'upcoming' },
    { coachingNo: 2, coachingDate: '2026-10-13', stage: 'draft' },
    { coachingNo: 1, coachingDate: '2026-10-06', stage: 'missed' },
  ];
  const all = texts(buildHints({ cognito: c, moodle, coach: { id: 5 }, schedules }, NOW));
  assert.match(all, /公開されていない回が1件.*第2回/);
  assert.match(all, /自動で作れなかった回が1件.*第1回/);
  assert.doesNotMatch(all, /予約はありません/);
});

test('予約の段階: リスケ・予定・前日のリマインド未送信', () => {
  assert.strictEqual(scheduleStage({ coachingDate: '2026-10-10', result: 'rescheduled' }, TODAY).stage, 'rescheduled');
  assert.strictEqual(scheduleStage({ coachingDate: '2026-10-25' }, TODAY).label, '予定');
  assert.strictEqual(scheduleStage({ coachingDate: '2026-10-21', reminderSentAt: null }, TODAY).label, '予定(リマインド未送信)');
  assert.strictEqual(scheduleStage({ coachingDate: '2026-10-21', reminderSentAt: '2026-10-20T00:10:00' }, TODAY).label, '予定');
});

test('予約の段階: 過去の回はノートの状態で決まる', () => {
  const past = { coachingDate: '2026-10-13' };
  assert.strictEqual(scheduleStage({ ...past, note: { status: 'published' } }, TODAY).stage, 'published');
  assert.strictEqual(scheduleStage({ ...past, note: { status: 'coach_confirmed' } }, TODAY).stage, 'confirmed');
  assert.strictEqual(scheduleStage({ ...past, note: { status: 'ai_suggested' } }, TODAY).stage, 'draft');
  assert.strictEqual(scheduleStage({ ...past, manualAllowed: true }, TODAY).label, '文字起こしなし(コーチが手で書ける)');
  assert.strictEqual(scheduleStage({ ...past, manualAllowed: true, transcript: { status: 'completed' } }, TODAY).label, '記録の自動作成に失敗(コーチが手で書ける)');
  assert.strictEqual(scheduleStage({ ...past, transcript: { status: 'completed' } }, TODAY).stage, 'generating');
  assert.strictEqual(scheduleStage(past, TODAY).stage, 'waiting');
});

test('予約の段階: 当日はノートが無くても失敗扱いにしない', () => {
  assert.strictEqual(scheduleStage({ coachingDate: TODAY }, TODAY).stage, 'today');
  assert.strictEqual(scheduleStage({ coachingDate: TODAY, note: { status: 'ai_suggested' } }, TODAY).stage, 'draft');
});

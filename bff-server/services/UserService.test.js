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
const originalCreateUsers = moodleAdapter.createUsers;

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
  moodleAdapter.createUsers = originalCreateUsers;
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

// ---- 新規作成時のユーザー名 ----

// Moodle のユーザー表を配列で真似る。createUsers は同名があれば Moodle と同じ文面で失敗する
function stubMoodleUsers(users, { beforeCreate } = {}) {
  const created = [];
  moodleAdapter.getUsersByField = async (field, values) =>
    users.filter((u) => values.includes(u[field]));
  moodleAdapter.createUsers = async ([user]) => {
    if (beforeCreate) await beforeCreate(user);
    if (users.some((u) => u.username === user.username)) {
      throw new Error('Invalid parameter value detected');
    }
    const row = { id: 100 + users.length, ...user };
    users.push(row);
    created.push(row);
    return [{ id: row.id, username: row.username }];
  };
  return created;
}

test('重ならなければメールの@より前をそのままユーザー名にする', async () => {
  const created = stubMoodleUsers([]);

  const user = await userService.createMoodleUser({ sub: 's-new-1', email: 'Ta.ro@example.com' });

  assert.strictEqual(user.username, 'taro');
  assert.strictEqual(created.length, 1);
});

test('別人と重なったら英小文字を付けた名前で作る', async () => {
  const created = stubMoodleUsers([{ id: 1, username: 'taro', email: 'taro@other.com', idnumber: 'x' }]);

  const user = await userService.createMoodleUser({ sub: 's-new-2', email: 'taro@example.com' });

  assert.match(user.username, /^taro\.[a-z]+$/);
  assert.strictEqual(created.length, 1);
  assert.strictEqual(created[0].idnumber, 's-new-2');
});

test('@より前に英数字が無いときは user を土台にする', async () => {
  stubMoodleUsers([]);

  const user = await userService.createMoodleUser({ sub: 's-new-3', email: 'たろう@example.com' });

  assert.strictEqual(user.username, 'user');
});

test('別の台が同じ人を先に作っていたら、作り直さずそれを使う', async () => {
  const users = [];
  const created = stubMoodleUsers(users, {
    // 確認の後・作成の前に、もう1台のBFFが同じ人(同じsub)を作った状況
    beforeCreate: async (user) => {
      if (!users.some((u) => u.idnumber === user.idnumber)) {
        users.push({ id: 50, username: user.username, email: user.email, idnumber: user.idnumber });
      }
    }
  });

  const user = await userService.createMoodleUser({ sub: 's-new-4', email: 'hanako@example.com' });

  assert.deepStrictEqual(user, { id: 50, username: 'hanako' });
  assert.strictEqual(created.length, 0);
  assert.strictEqual(users.length, 1);
});

test('ユーザー名の重複以外の失敗はそのまま投げる', async () => {
  stubMoodleUsers([]);
  moodleAdapter.createUsers = async () => { throw new Error('Moodle down'); };

  await assert.rejects(
    userService.createMoodleUser({ sub: 's-new-5', email: 'jiro@example.com' }),
    /Moodle down/
  );
});

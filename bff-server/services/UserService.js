/**
 * User Service
 * Handles user creation, management, and Cognito-Moodle mapping
 */

const moodleAdapter = require('../adapters/MoodleAdapter');

// Cognitoのグループ(admin/coach)に応じたMoodleのロールは付けない。アプリ内の権限判定はすべて
// Cognitoのグループで行い(middleware/coachAccess.js)、Moodleへは専用アカウント(bff-service)経由でしか
// 触らないため、本人のMoodleロールは使われない。以前はここで付けようとしていたが、呼んでいた
// core_role_get_all_roles がMoodleに存在せず一度も成功していなかった(bff-serviceはstudent以外を
// 付ける権限も無い)ので2026-10-11に撤去した。

// Cognito sub → Moodle ユーザーの対応。requireAuth が全APIリクエストで引くため、毎回 Moodle の
// webservice を呼ぶと、画面1枚(十数本のAPI)ごとに同じ検索が十数回走り、Moodle の処理枠を
// 食い合って全体が遅くなっていた。対応はほぼ変わらないのでプロセス内で一定時間覚えておく。
// メールが変わったとき(同期が要る)はキャッシュを使わない。
const MOODLE_USER_CACHE_TTL_MS = 10 * 60 * 1000;
const MOODLE_USER_CACHE_MAX = 5000;
const moodleUserCache = new Map(); // sub -> { user, email, expiresAt }
// 画面表示時は同じユーザーのAPIが同時に十数本来る。キャッシュが空のときに全部が
// Moodle へ行かない(新規ユーザーの二重作成も防ぐ)よう、問い合わせ中の Promise を共有する
const moodleUserInflight = new Map(); // sub -> Promise

// ユーザー名が重なったときに英字を付けて試す回数
const USERNAME_SUFFIX_ATTEMPTS = 10;

function randomLetters(length) {
  let letters = '';
  for (let i = 0; i < length; i++) {
    letters += String.fromCharCode(97 + Math.floor(Math.random() * 26));
  }
  return letters;
}

function pruneMoodleUserCache(now) {
  if (moodleUserCache.size < MOODLE_USER_CACHE_MAX) return;
  for (const [key, entry] of moodleUserCache) {
    if (entry.expiresAt <= now) moodleUserCache.delete(key);
  }
  if (moodleUserCache.size >= MOODLE_USER_CACHE_MAX) moodleUserCache.clear();
}

class UserService {
  /**
   * Get or create Moodle user from Cognito payload (cached per Cognito sub)
   */
  async getOrCreateMoodleUser(cognitoPayload) {
    const { email, sub } = cognitoPayload;

    if (!sub) {
      throw new Error('Cognito sub is required');
    }

    const now = Date.now();
    const cached = moodleUserCache.get(sub);
    if (cached && cached.email === email && cached.expiresAt > now) {
      return cached.user;
    }

    const inflight = moodleUserInflight.get(sub);
    if (inflight) return inflight;

    const promise = this.lookupOrCreateMoodleUser(cognitoPayload)
      .then((user) => {
        if (user) {
          pruneMoodleUserCache(Date.now());
          moodleUserCache.set(sub, { user, email, expiresAt: Date.now() + MOODLE_USER_CACHE_TTL_MS });
        }
        return user;
      })
      .finally(() => moodleUserInflight.delete(sub));
    moodleUserInflight.set(sub, promise);
    return promise;
  }

  /**
   * Cognito sub に紐づく Moodle ユーザーを探し、無ければ作る(キャッシュなし)
   */
  async lookupOrCreateMoodleUser(cognitoPayload) {
    const { email, sub } = cognitoPayload;

    // Try to find existing user by idnumber (Cognito sub)
    try {
      const moodleUsers = await moodleAdapter.getUsersByField('idnumber', [sub]);

      if (moodleUsers && moodleUsers.length > 0) {
        const user = moodleUsers[0];
        console.log('Moodle user found by idnumber:', { id: user.id, username: user.username });

        // Sync email if changed
        if (user.email !== email) {
          console.log('Email mismatch, syncing to Moodle:', {
            moodleEmail: user.email,
            cognitoEmail: email
          });
          try {
            await moodleAdapter.updateUsers([{ id: user.id, email }]);
            console.log('Moodle email updated successfully');
          } catch (updateError) {
            console.error('Failed to sync email to Moodle:', updateError.message);
          }
        }

        return {
          id: user.id,
          username: user.username
        };
      }

      // User not found by idnumber, try finding by email
      console.log('Moodle user not found by idnumber, searching by email:', email);
      const usersByEmail = await moodleAdapter.getUsersByField('email', [email]);

      if (usersByEmail && usersByEmail.length > 0) {
        const user = usersByEmail[0];
        console.log('Moodle user found by email:', { id: user.id, username: user.username });
        console.log('Updating idnumber to link with Cognito sub:', sub);

        // Update idnumber to link with Cognito
        try {
          await moodleAdapter.callAPI('core_user_update_users', {
            'users[0][id]': user.id,
            'users[0][idnumber]': sub
          });
          console.log('Moodle user idnumber updated successfully');

          return {
            id: user.id,
            username: user.username
          };
        } catch (updateError) {
          console.error('Failed to update idnumber:', updateError.message);
          throw updateError;
        }
      }

      // User not found by idnumber or email, create new one
      console.log('Moodle user not found. Creating new user for sub:', sub);
      return await this.createMoodleUser(cognitoPayload);
    } catch (error) {
      console.error('Failed to lookup Moodle user:', error.message);
      throw error;
    }
  }

  /**
   * Create Moodle user from Cognito payload
   *
   * ユーザー名はメールの@より前(英数字のみ・小文字)。別人と重なったら「taro.a」「taro.kq」のように
   * 英小文字を付けて空いている名前を探す。Moodle のユーザー名はログインには使わない(認証は Cognito、
   * 紐付けは idnumber=sub)ので、名前に意味は要らない。
   */
  async createMoodleUser(cognitoPayload) {
    const { email, sub, 'cognito:username': cognitoUsername } = cognitoPayload;

    // Parse name from Cognito
    const givenName = cognitoPayload.given_name || cognitoUsername || 'User';
    const familyName = cognitoPayload.family_name || 'User';

    // @より前に英数字が無い(日本語など)と空になるので、その場合は user を土台にする
    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'user';

    // Generate temporary password (not used with Cognito auth)
    const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!${Date.now()}`;

    for (let attempt = 0; attempt <= USERNAME_SUFFIX_ATTEMPTS; attempt++) {
      // 2回目以降は英字1文字×3回→2文字×3回→…と増やす
      const username = attempt === 0
        ? baseUsername
        : `${baseUsername}.${randomLetters(Math.ceil(attempt / 3))}`;

      if (await this.isMoodleUsernameTaken(username)) continue;

      console.log('[Create Moodle User] Attempting to create user:', {
        username,
        email,
        firstname: givenName,
        lastname: familyName
      });

      try {
        const result = await moodleAdapter.createUsers([{
          username,
          password: tempPassword,
          firstname: givenName,
          lastname: familyName,
          email,
          auth: 'manual',
          idnumber: sub,
          lang: 'ja',
          timezone: 'Asia/Tokyo'
        }]);

        if (!result || result.length === 0 || !result[0].id) {
          throw new Error('User creation returned empty result');
        }

        console.log('[Create Moodle User] User created successfully:', {
          id: result[0].id,
          username: result[0].username
        });

        return {
          id: result[0].id,
          username: result[0].username
        };
      } catch (error) {
        console.error('[Create Moodle User] Error:', error.message);

        // 本番はBFFが2台あり、初回ログイン直後の同時リクエストで別の台が同じ人を先に作ることがある。
        // その場合は作り直さずそれを使う(別名で作ると同じ人のMoodleユーザーが2件になる)
        const existing = await moodleAdapter.getUsersByField('idnumber', [sub]);
        if (existing && existing.length > 0) {
          return {
            id: existing[0].id,
            username: existing[0].username
          };
        }

        // 確認と作成の間に別人に取られた場合だけ次の候補へ。それ以外の失敗はそのまま返す
        // (Moodle のエラー文は "Invalid parameter value detected" で、重複かどうかは文面から分からない)
        if (!(await this.isMoodleUsernameTaken(username))) throw error;
      }
    }

    throw new Error(`Moodle username candidates exhausted for base: ${baseUsername}`);
  }

  async isMoodleUsernameTaken(username) {
    const users = await moodleAdapter.getUsersByField('username', [username]);
    return Boolean(users && users.length > 0);
  }

  /**
   * Get user info by Moodle user ID
   */
  async getUserInfo(moodleUserId) {
    const users = await moodleAdapter.getUsersByField('id', [moodleUserId]);
    if (!users || users.length === 0) {
      return null;
    }
    return users[0];
  }
}

// Create singleton instance
const userService = new UserService();

module.exports = userService;

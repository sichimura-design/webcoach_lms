/**
 * Authentication Middleware
 * JWT Token Verification
 */

const { getCognitoJwtVerifier } = require('../config/clients');
const userService = require('../services/UserService');
const logger = require('../utils/logger');
const moodleAdapter = require('../adapters/MoodleAdapter');

// 最終アクセス日時の更新(Moodle webservice)を全APIリクエストで送ると、画面1枚ごとに
// 十数回 Moodle を叩くことになる。同じユーザーへは間隔を空けて送る。
// ただしこの呼び出しは「その日最初のアクセスでログインイベントを記録する」役目も兼ねるので
// (local_webcoach_utils の update_user_lastaccess)、日付(JST)が変わったら間隔に関係なく送る。
const LASTACCESS_UPDATE_INTERVAL_MS = 5 * 60 * 1000;
const lastAccessSent = new Map(); // moodleUserId -> { at, day }

function jstDay(ms) {
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function shouldUpdateLastAccess(moodleUserId, now = Date.now()) {
  const day = jstDay(now);
  const prev = lastAccessSent.get(moodleUserId);
  if (prev && prev.day === day && now - prev.at < LASTACCESS_UPDATE_INTERVAL_MS) return false;
  if (lastAccessSent.size >= 5000) lastAccessSent.clear();
  lastAccessSent.set(moodleUserId, { at: now, day });
  return true;
}

/**
 * Require authentication - JWT Token Verification or Internal API Key
 */
async function requireAuth(req, res, next) {
  logger.log('=== Authentication Check ===');
  logger.log('Path:', req.path);

  const authHeader = req.headers.authorization;
  const internalApiKey = req.headers['x-internal-api-key'];
  logger.log('Authorization header:', authHeader ? 'Present' : 'Missing');
  logger.log('Internal API key:', internalApiKey ? 'Present' : 'Missing');

  // Check for internal API key (for service-to-service communication)
  const expectedInternalKey = process.env.INTERNAL_API_KEY;
  if (expectedInternalKey && internalApiKey === expectedInternalKey) {
    logger.log('Authentication SUCCESS - Internal API Key');
    // Set a service user for internal requests
    req.user = {
      sub: 'internal-service',
      email: 'service@internal',
      username: 'internal-service',
      cognitoUsername: 'internal-service',
      groups: ['service'],
      moodleUserId: null,  // Will be set from request params if needed
      isInternalService: true
    };
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.log('Authentication FAILED - No Bearer token or Internal API Key');
    return res.status(401).json({
      error: 'Unauthorized',
      message: '認証が必要です。Authorizationヘッダーにトークンを含めてください。'
    });
  }

  try {
    const token = authHeader.split(' ')[1];
    logger.log('Token extracted, verifying...');

    const verifier = getCognitoJwtVerifier();
    const payload = await verifier.verify(token);
    logger.log('Token verified successfully');
    logger.log('Cognito user:', {
      sub: payload.sub,
      email: payload.email,
      username: payload['cognito:username']
    });

    // Cognitoユーザー情報をreq.userに設定
    req.user = {
      sub: payload.sub,
      email: payload.email,
      username: payload['cognito:username'],
      cognitoUsername: payload['cognito:username'],
      groups: payload['cognito:groups'] || []
    };

    // Moodleユーザーとの紐付け: idnumber(=Cognito sub)で検索、なければ自動作成
    try {
      const moodleUser = await userService.getOrCreateMoodleUser(payload);
      if (moodleUser) {
        req.user.moodleUserId = moodleUser.id;
        req.user.moodleUsername = moodleUser.username;
        logger.log('Moodle user found/created:', {
          moodleUserId: req.user.moodleUserId,
          moodleUsername: req.user.moodleUsername
        });

        // Update user's lastaccess timestamp in background (non-blocking, throttled per user)
        if (shouldUpdateLastAccess(moodleUser.id)) {
          moodleAdapter.updateUserLastAccess(moodleUser.id).catch(err => {
            logger.error('Failed to update user lastaccess:', err.message);
            // 失敗したら次のリクエストでもう一度送れるようにする
            lastAccessSent.delete(moodleUser.id);
          });
        }
      }
    } catch (error) {
      logger.error('=== CRITICAL: Failed to lookup/create Moodle user ===');
      logger.error('Cognito sub:', payload.sub);
      logger.error('Error:', error.message);
      logger.error('Stack:', error.stack);
      req.user.moodleUserLookupError = error.message;
    }

    logger.log('Authentication SUCCESS');
    next();
  } catch (err) {
    logger.error('Token verification failed:', err.message);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'トークンが無効です'
    });
  }
}

module.exports = requireAuth;
module.exports.shouldUpdateLastAccess = shouldUpdateLastAccess;

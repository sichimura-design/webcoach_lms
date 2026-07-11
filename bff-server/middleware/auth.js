/**
 * Authentication Middleware
 * JWT Token Verification
 */

const { getCognitoJwtVerifier } = require('../config/clients');
const userService = require('../services/UserService');
const logger = require('../utils/logger');
const moodleAdapter = require('../adapters/MoodleAdapter');

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

        // Update user's lastaccess timestamp in background (non-blocking)
        moodleAdapter.updateUserLastAccess(moodleUser.id).catch(err => {
          logger.error('Failed to update user lastaccess:', err.message);
          // Don't block the request if lastaccess update fails
        });
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

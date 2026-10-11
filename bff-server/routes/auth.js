/**
 * Authentication Routes
 * NOTE: These endpoints are DEPRECATED for JWT authentication
 * Use Cognito direct authentication instead
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const authService = require('../services/AuthService');
const userService = require('../services/UserService');
const moodleAdapter = require('../adapters/MoodleAdapter');
const cognitoAdapter = require('../adapters/CognitoAdapter');
const { accountCheckLimiter } = require('../middleware/rateLimit');
const axios = require('axios');
const { config } = require('../config/environment');
const { createErrorResponse } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// Get current user info
router.get('/user/info', requireAuth, async (req, res) => {
  try {
    if (!req.user.moodleUserId) {
      return res.json({
        cognito: {
          sub: req.user.sub,
          email: req.user.email,
          username: req.user.username
        },
        moodle: null,
        warning: 'Moodle user not found for this Cognito account'
      });
    }

    const moodleUser = await userService.getUserInfo(req.user.moodleUserId);

    if (!moodleUser) {
      return res.status(404).json({ error: 'Moodle user not found' });
    }

    res.json({
      cognito: {
        sub: req.user.sub,
        email: req.user.email,
        username: req.user.username
      },
      moodle: {
        id: moodleUser.id,
        username: moodleUser.username,
        fullname: moodleUser.fullname,
        email: moodleUser.email,
        firstname: moodleUser.firstname,
        lastname: moodleUser.lastname,
        profileimageurl: moodleUser.profileimageurl
      }
    });
  } catch (error) {
    logger.error('Get user info error:', error.message);
    const errorResponse = createErrorResponse(error, 'moodle', 500);
    res.status(500).json(errorResponse);
  }
});

// Generate content access token
router.get('/content-token', requireAuth, (req, res) => {
  const userId = req.user?.sub || req.user?.username || 'anonymous';
  const tokenData = authService.generateContentToken(userId);

  res.json(tokenData);
});

// パスワード再設定の前に、メールアドレスが登録済みか確認する(未ログインで呼ぶ)
// Cognitoはクライアント設定(preventUserExistenceErrors)で未登録でも成功を返すため、ここで判定する
router.post('/auth/password-reset/check', accountCheckLimiter, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  try {
    const user = await cognitoAdapter.findUserByEmail(email);
    const exists = !!user && user.Enabled !== false;
    // 仮パスワードのまま(初回ログイン前)のユーザーはCognitoの仕様で再設定コードを送れない
    const needsFirstLogin = exists && user.UserStatus === 'FORCE_CHANGE_PASSWORD';
    res.json({ exists, needsFirstLogin });
  } catch (error) {
    logger.error('Password reset account check failed:', error.message);
    res.status(500).json(createErrorResponse(error, 'cognito', 500));
  }
});

module.exports = router;

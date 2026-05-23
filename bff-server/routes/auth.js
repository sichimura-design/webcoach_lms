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

module.exports = router;

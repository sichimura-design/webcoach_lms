/**
 * Authentication Service
 * Handles token management and authentication logic
 */

const moodleAdapter = require('../adapters/MoodleAdapter');
const logger = require('../utils/logger');

class AuthService {
  constructor() {
    this.tokenRefreshInterval = null;
  }

  /**
   * Initialize service account authentication
   */
  async initializeServiceAccount() {
    try {
      await moodleAdapter.authenticateServiceAccount();
      return true;
    } catch (error) {
      logger.error('Failed to initialize service account:', error.message);
      throw error;
    }
  }

  /**
   * Start token refresh (every 12 hours)
   */
  startTokenRefresh() {
    const REFRESH_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours

    this.tokenRefreshInterval = setInterval(async () => {
      try {
        logger.log('Refreshing service account token...');
        await moodleAdapter.authenticateServiceAccount();
        logger.log('Service account token refreshed successfully');
      } catch (error) {
        logger.error('Failed to refresh service account token:', error.message);
      }
    }, REFRESH_INTERVAL);
  }

  /**
   * Stop token refresh
   */
  stopTokenRefresh() {
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
  }

  /**
   * Generate content access token
   * Used by Lambda@Edge for CloudFront access control
   */
  generateContentToken(userId) {
    const crypto = require('crypto');
    const { config } = require('../config/environment');
    const secret = config.contentTokenSecret;

    if (!secret) {
      throw new Error('CONTENT_TOKEN_SECRET is not configured');
    }

    const expiry = Date.now() + 60 * 60 * 1000; // 1 hour
    const data = `${userId}:${expiry}`;
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');

    const token = Buffer.from(`${data}:${hmac}`).toString('base64url');

    return {
      token,
      expiresAt: expiry
    };
  }

  /**
   * Check if service token is available
   */
  isServiceTokenAvailable() {
    return !!moodleAdapter.getServiceToken();
  }
}

// Create singleton instance
const authService = new AuthService();

module.exports = authService;

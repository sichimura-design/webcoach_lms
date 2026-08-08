/**
 * Integration Service
 * Manages OAuth2 integrations with third-party meeting providers (Zoom, Google Meet)
 */

const crypto = require('crypto');
const axios = require('axios');
const { config } = require('../config/environment');
const logger = require('../utils/logger');

// In-memory token storage (replace with database in production)
const tokenStore = new Map();

// State verification secret
const STATE_SECRET = process.env.INTEGRATION_STATE_SECRET || crypto.randomBytes(32).toString('hex');

class IntegrationService {
  /**
   * Get integration status for a coach
   * @param {number} moodleUserId
   * @returns {Promise<{coach_user_id: number, integrations: Array}>}
   */
  async getStatus(moodleUserId) {
    const integrations = [];

    // Check for stored tokens
    const zoomTokenKey = `zoom:${moodleUserId}`;
    const googleTokenKey = `google:${moodleUserId}`;

    if (tokenStore.has(zoomTokenKey)) {
      const token = tokenStore.get(zoomTokenKey);
      integrations.push({
        coach_user_id: moodleUserId,
        provider: 'zoom',
        provider_account_email: token.account_email || null,
        connected_at: token.connected_at,
        updated_at: token.updated_at || token.connected_at,
      });
    }

    if (tokenStore.has(googleTokenKey)) {
      const token = tokenStore.get(googleTokenKey);
      integrations.push({
        coach_user_id: moodleUserId,
        provider: 'google',
        provider_account_email: token.account_email || null,
        connected_at: token.connected_at,
        updated_at: token.updated_at || token.connected_at,
      });
    }

    return {
      coach_user_id: moodleUserId,
      integrations,
    };
  }

  /**
   * Build OAuth2 authorization URL
   * @param {string} provider - 'zoom' or 'google'
   * @param {number} moodleUserId
   * @returns {string} Authorization URL
   */
  buildAuthorizeUrl(provider, moodleUserId) {
    const state = this.generateState(moodleUserId, provider);
    const callbackUrl = `${config.bffBaseUrl || 'http://localhost:3001'}/api/integrations/${provider}/callback`;

    if (provider === 'zoom') {
      const zoomClientId = process.env.ZOOM_CLIENT_ID;
      if (!zoomClientId) {
        throw new Error('ZOOM_CLIENT_ID not configured');
      }

      return `https://zoom.us/oauth/authorize?response_type=code&client_id=${zoomClientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${state}`;
    }

    if (provider === 'google') {
      const googleClientId = process.env.GOOGLE_CLIENT_ID;
      if (!googleClientId) {
        throw new Error('GOOGLE_CLIENT_ID not configured');
      }

      const scopes = encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly');
      return `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${googleClientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${scopes}&state=${state}&access_type=offline&prompt=consent`;
    }

    throw new Error(`Unsupported provider: ${provider}`);
  }

  /**
   * Generate signed state parameter
   * @param {number} moodleUserId
   * @param {string} provider
   * @returns {string} Signed state
   */
  generateState(moodleUserId, provider) {
    const payload = JSON.stringify({ moodleUserId, provider, ts: Date.now() });
    const signature = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('hex');
    return Buffer.from(`${payload}.${signature}`).toString('base64url');
  }

  /**
   * Verify state parameter
   * @param {string} state
   * @param {string} provider
   * @returns {{moodleUserId: number}}
   */
  verifyState(state, provider) {
    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf-8');
      const [payload, signature] = decoded.split('.');

      const expectedSignature = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('hex');
      if (signature !== expectedSignature) {
        throw new Error('Invalid state signature');
      }

      const data = JSON.parse(payload);

      // Verify timestamp (max 10 minutes old)
      if (Date.now() - data.ts > 10 * 60 * 1000) {
        throw new Error('State expired');
      }

      if (data.provider !== provider) {
        throw new Error('Provider mismatch');
      }

      return { moodleUserId: data.moodleUserId };
    } catch (error) {
      logger.error('[IntegrationService] State verification failed:', error.message);
      throw new Error('Invalid state parameter');
    }
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} provider
   * @param {string} code
   * @returns {Promise<Object>} Token response
   */
  async exchangeCodeForTokens(provider, code) {
    const callbackUrl = `${config.bffBaseUrl || 'http://localhost:3001'}/api/integrations/${provider}/callback`;

    if (provider === 'zoom') {
      const zoomClientId = process.env.ZOOM_CLIENT_ID;
      const zoomClientSecret = process.env.ZOOM_CLIENT_SECRET;

      if (!zoomClientId || !zoomClientSecret) {
        throw new Error('Zoom credentials not configured');
      }

      const response = await axios.post('https://zoom.us/oauth/token', null, {
        params: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: callbackUrl,
        },
        auth: {
          username: zoomClientId,
          password: zoomClientSecret,
        },
      });

      return response.data;
    }

    if (provider === 'google') {
      const googleClientId = process.env.GOOGLE_CLIENT_ID;
      const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!googleClientId || !googleClientSecret) {
        throw new Error('Google credentials not configured');
      }

      const response = await axios.post('https://oauth2.googleapis.com/token', {
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
        client_id: googleClientId,
        client_secret: googleClientSecret,
      });

      return response.data;
    }

    throw new Error(`Unsupported provider: ${provider}`);
  }

  /**
   * Save tokens for a user
   * @param {number} moodleUserId
   * @param {string} provider
   * @param {Object} tokenResponse
   */
  async saveTokens(moodleUserId, provider, tokenResponse) {
    const key = `${provider}:${moodleUserId}`;
    const now = new Date().toISOString();

    tokenStore.set(key, {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_in: tokenResponse.expires_in,
      token_type: tokenResponse.token_type,
      account_email: tokenResponse.email || null,
      connected_at: now,
      updated_at: now,
    });

    logger.info(`[IntegrationService] Saved ${provider} tokens for user ${moodleUserId}`);
  }
}

module.exports = new IntegrationService();

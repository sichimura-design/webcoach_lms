/**
 * Meeting Integration Service
 * Handles the Zoom / Google Meet OAuth "connect" flow for coaches.
 *
 * Scope of this service (current implementation):
 *   - Build authorize URLs, exchange authorization codes for tokens,
 *     encrypt tokens, and persist/report connection status.
 * Explicitly out of scope for now:
 *   - Fetching meeting transcripts/minutes (future work) — decrypt logic
 *     is intentionally not implemented here since nothing consumes it yet.
 */

const crypto = require('crypto');
const axios = require('axios');
const { config } = require('../config/environment');
const apiServerAdapter = require('../adapters/ApiServerAdapter');
const logger = require('../utils/logger');

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const PROVIDERS = {
  zoom: {
    authorizeUrl: 'https://zoom.us/oauth/authorize',
    tokenUrl: 'https://zoom.us/oauth/token',
    clientId: () => config.zoomClientId,
    clientSecret: () => config.zoomClientSecret,
    redirectUri: () => config.zoomRedirectUri,
    scopes: () => config.zoomOAuthScopes,
  },
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: () => config.googleClientId,
    clientSecret: () => config.googleClientSecret,
    redirectUri: () => config.googleRedirectUri,
    scopes: () => config.googleOAuthScopes,
  },
};

class IntegrationService {
  /**
   * Sign a short-lived state parameter carrying the coach's moodleUserId + provider.
   * Mirrors AuthService.generateContentToken's HMAC scheme.
   */
  generateState(moodleUserId, provider) {
    const secret = config.integrationStateSecret;
    if (!secret) {
      throw new Error('INTEGRATION_STATE_SECRET is not configured');
    }

    const nonce = crypto.randomBytes(8).toString('hex');
    const expiry = Date.now() + STATE_TTL_MS;
    const data = `${moodleUserId}:${provider}:${expiry}:${nonce}`;
    const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');

    return Buffer.from(`${data}:${hmac}`).toString('base64url');
  }

  /**
   * Verify + decode a state parameter. Throws if invalid/expired/tampered.
   */
  verifyState(state, expectedProvider) {
    const secret = config.integrationStateSecret;
    if (!secret) {
      throw new Error('INTEGRATION_STATE_SECRET is not configured');
    }

    let decoded;
    try {
      decoded = Buffer.from(state, 'base64url').toString('utf8');
    } catch (err) {
      throw new Error('Invalid state parameter');
    }

    const parts = decoded.split(':');
    if (parts.length !== 5) {
      throw new Error('Invalid state parameter');
    }
    const [moodleUserId, provider, expiryStr, nonce, hmac] = parts;
    const data = `${moodleUserId}:${provider}:${expiryStr}:${nonce}`;
    const expectedHmac = crypto.createHmac('sha256', secret).update(data).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
      throw new Error('State signature mismatch');
    }

    if (Date.now() > parseInt(expiryStr, 10)) {
      throw new Error('State has expired');
    }

    if (provider !== expectedProvider) {
      throw new Error('State provider mismatch');
    }

    return { moodleUserId: parseInt(moodleUserId, 10), provider };
  }

  /**
   * Derive a 32-byte AES key from the configured secret and encrypt with AES-256-GCM.
   * Returns "iv:authTag:ciphertext" (all base64), storable as an opaque string.
   */
  encryptToken(plaintext) {
    const secret = config.integrationTokenEncKey;
    if (!secret) {
      throw new Error('INTEGRATION_TOKEN_ENC_KEY is not configured');
    }

    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
  }

  _getProviderConfig(provider) {
    const providerConfig = PROVIDERS[provider];
    if (!providerConfig) {
      throw new Error(`Unsupported provider: ${provider}`);
    }
    return providerConfig;
  }

  /**
   * Build the URL to redirect the coach's browser to for consent.
   */
  buildAuthorizeUrl(provider, moodleUserId) {
    const providerConfig = this._getProviderConfig(provider);
    const clientId = providerConfig.clientId();
    const redirectUri = providerConfig.redirectUri();

    if (!clientId || !redirectUri) {
      throw new Error(`${provider} OAuth is not configured (client ID / redirect URI missing)`);
    }

    const state = this.generateState(moodleUserId, provider);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: providerConfig.scopes(),
      state,
    });

    if (provider === 'google') {
      params.set('access_type', 'offline');
      params.set('prompt', 'consent');
    }

    return `${providerConfig.authorizeUrl}?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for tokens.
   */
  async exchangeCodeForTokens(provider, code) {
    const providerConfig = this._getProviderConfig(provider);
    const clientId = providerConfig.clientId();
    const clientSecret = providerConfig.clientSecret();
    const redirectUri = providerConfig.redirectUri();

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(`${provider} OAuth is not configured (client credentials missing)`);
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const requestConfig = {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    };

    if (provider === 'zoom') {
      requestConfig.auth = { username: clientId, password: clientSecret };
    } else {
      params.set('client_id', clientId);
      params.set('client_secret', clientSecret);
    }

    const response = await axios.post(providerConfig.tokenUrl, params.toString(), requestConfig);
    return response.data; // { access_token, refresh_token, expires_in, scope, ... }
  }

  /**
   * Encrypt and persist the tokens returned by the provider.
   */
  async saveTokens(moodleUserId, provider, tokenResponse, providerAccountEmail = null) {
    const expiresAt = new Date(Date.now() + (tokenResponse.expires_in || 3600) * 1000).toISOString();

    const payload = {
      provider,
      access_token: this.encryptToken(tokenResponse.access_token),
      refresh_token: this.encryptToken(tokenResponse.refresh_token),
      expires_at: expiresAt,
      scope: tokenResponse.scope || null,
      provider_account_email: providerAccountEmail,
    };

    logger.log(`[Integration] Saving ${provider} tokens for coach ${moodleUserId}`);
    return await apiServerAdapter.upsertCoachMeetingIntegration(moodleUserId, payload);
  }

  /**
   * Get the coach's connection status across all providers (no tokens included).
   */
  async getStatus(moodleUserId) {
    return await apiServerAdapter.getCoachMeetingIntegrationStatus(moodleUserId);
  }
}

const integrationService = new IntegrationService();

module.exports = integrationService;

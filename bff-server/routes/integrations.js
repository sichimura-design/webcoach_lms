/**
 * Meeting Integration Routes
 *
 * Two independent flows (see IntegrationService for the full explanation):
 *   - /:provider/authorize, /:provider/callback, /status
 *     -> per-coach Zoom connect flow ('zoom' only; 'google' was removed here
 *        when Google Meet moved to the Organizer-centric model below).
 *   - /organizer/:provider/authorize, /organizer/:provider/callback, /organizer/status
 *     -> single company-shared Google account, connected once by an admin.
 *
 * NOTE: both /callback routes are intentionally NOT behind requireAuth —
 * Zoom/Google redirect the raw browser here with no way to attach a Bearer
 * token. Identity/authorization is instead recovered from the signed `state`
 * parameter (which itself was only ever handed out to an authenticated,
 * and for the organizer flow admin-only, request in the /authorize step).
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');
const integrationService = require('../services/IntegrationService');
const { config } = require('../config/environment');
const { createErrorResponse } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const axios = require('axios');

const SUPPORTED_PROVIDERS = ['zoom'];
const SUPPORTED_ORGANIZER_PROVIDERS = ['google'];

function isSupportedProvider(provider) {
  return SUPPORTED_PROVIDERS.includes(provider);
}

function isSupportedOrganizerProvider(provider) {
  return SUPPORTED_ORGANIZER_PROVIDERS.includes(provider);
}

/**
 * Best-effort lookup of the connected Google account's email, so the admin
 * settings UI can show "connected as xxx@company.com". Never throws.
 */
async function fetchGoogleAccountEmail(accessToken) {
  try {
    const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 5000,
    });
    return response.data?.email || null;
  } catch (error) {
    logger.warn('[Integration] Failed to fetch Google account email:', error.message);
    return null;
  }
}

/**
 * GET /api/integrations/status
 * Get the current coach's connection status for all providers
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    if (!req.user.moodleUserId) {
      return res.status(400).json({ error: 'Bad Request', detail: 'Moodle user not found for this account' });
    }

    const status = await integrationService.getStatus(req.user.moodleUserId);
    res.json(status);
  } catch (error) {
    logger.error('[Integration] Get status error:', error.message);
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/integrations/:provider/authorize
 * Returns the URL the frontend should redirect the browser to for consent
 */
router.get('/:provider/authorize', requireAuth, async (req, res) => {
  try {
    const { provider } = req.params;
    if (!isSupportedProvider(provider)) {
      return res.status(404).json({ error: 'Not Found', detail: `Unsupported provider: ${provider}` });
    }

    if (!req.user.moodleUserId) {
      return res.status(400).json({ error: 'Bad Request', detail: 'Moodle user not found for this account' });
    }

    const authorizeUrl = integrationService.buildAuthorizeUrl(provider, req.user.moodleUserId);
    res.json({ authorizeUrl });
  } catch (error) {
    logger.error(`[Integration] Build authorize URL error (${req.params.provider}):`, error.message);
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/integrations/:provider/callback
 * OAuth redirect target. No requireAuth — identity comes from the signed state.
 */
router.get('/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const settingsUrl = `${config.frontendBaseUrl}/coach/settings`;

  if (!isSupportedProvider(provider)) {
    return res.status(404).json({ error: 'Not Found', detail: `Unsupported provider: ${provider}` });
  }

  const { code, state, error: providerError } = req.query;

  if (providerError) {
    logger.warn(`[Integration] ${provider} callback returned error:`, providerError);
    return res.redirect(`${settingsUrl}?connected=${provider}&status=error`);
  }

  try {
    if (!code || !state) {
      throw new Error('Missing code or state in callback');
    }

    const { moodleUserId } = integrationService.verifyState(state, provider);
    const tokenResponse = await integrationService.exchangeCodeForTokens(provider, code);
    await integrationService.saveTokens(moodleUserId, provider, tokenResponse);

    res.redirect(`${settingsUrl}?connected=${provider}&status=success`);
  } catch (error) {
    logger.error(`[Integration] ${provider} callback error:`, error.message);
    res.redirect(`${settingsUrl}?connected=${provider}&status=error`);
  }
});

/**
 * GET /api/integrations/organizer/status
 * Get the Organizer Google account's connection status (admin only).
 */
router.get('/organizer/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = await integrationService.getOrganizerStatus('google');
    res.json(status);
  } catch (error) {
    logger.error('[Integration] Get organizer status error:', error.message);
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/integrations/organizer/:provider/authorize
 * Admin-only. Returns the URL to redirect the browser to for the Organizer
 * Google account's consent.
 */
router.get('/organizer/:provider/authorize', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { provider } = req.params;
    if (!isSupportedOrganizerProvider(provider)) {
      return res.status(404).json({ error: 'Not Found', detail: `Unsupported organizer provider: ${provider}` });
    }

    const authorizeUrl = integrationService.buildOrganizerAuthorizeUrl(provider);
    res.json({ authorizeUrl });
  } catch (error) {
    logger.error(`[Integration] Build organizer authorize URL error (${req.params.provider}):`, error.message);
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/integrations/organizer/:provider/callback
 * OAuth redirect target for the Organizer account. No requireAuth — Google
 * redirects the raw browser here. Authorization was already enforced at the
 * /authorize step (requireAdmin); this endpoint only trusts a signed state.
 */
router.get('/organizer/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const settingsUrl = `${config.frontendBaseUrl}/admin/settings`;

  if (!isSupportedOrganizerProvider(provider)) {
    return res.status(404).json({ error: 'Not Found', detail: `Unsupported organizer provider: ${provider}` });
  }

  const { code, state, error: providerError } = req.query;

  if (providerError) {
    logger.warn(`[Integration] organizer ${provider} callback returned error:`, providerError);
    return res.redirect(`${settingsUrl}?organizerConnected=${provider}&status=error`);
  }

  try {
    if (!code || !state) {
      throw new Error('Missing code or state in callback');
    }

    integrationService.verifyOrganizerState(state, provider);
    const tokenResponse = await integrationService.exchangeCodeForTokens(provider, code);
    const accountEmail = await fetchGoogleAccountEmail(tokenResponse.access_token);
    await integrationService.saveOrganizerTokens(provider, tokenResponse, accountEmail);

    res.redirect(`${settingsUrl}?organizerConnected=${provider}&status=success`);
  } catch (error) {
    logger.error(`[Integration] organizer ${provider} callback error:`, error.message);
    res.redirect(`${settingsUrl}?organizerConnected=${provider}&status=error`);
  }
});

module.exports = router;

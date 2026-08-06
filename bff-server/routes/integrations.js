/**
 * Meeting Integration Routes
 * Zoom / Google Meet OAuth connect flow for coaches
 *
 * NOTE: the /:provider/callback routes are intentionally NOT behind requireAuth —
 * Zoom/Google redirect the raw browser here with no way to attach a Bearer token.
 * The coach's identity is instead recovered from the signed `state` parameter.
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const integrationService = require('../services/IntegrationService');
const { config } = require('../config/environment');
const { createErrorResponse } = require('../utils/errorHandler');
const logger = require('../utils/logger');

const SUPPORTED_PROVIDERS = ['zoom', 'google'];

function isSupportedProvider(provider) {
  return SUPPORTED_PROVIDERS.includes(provider);
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

module.exports = router;

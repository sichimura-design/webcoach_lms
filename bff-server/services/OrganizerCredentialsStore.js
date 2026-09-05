/**
 * Organizer Google Credentials Store
 *
 * Holds the OAuth tokens for the single, company-shared Google Workspace
 * ("Organizer") account used by the Organizer-centric Meet integration —
 * NOT per-coach tokens (compare to the per-coach Zoom flow, which persists
 * to webcoach_coach_meeting_integration via ApiServerAdapter).
 *
 * Storage backend:
 *   - config.organizerGoogleCredentialsSecretId set -> AWS Secrets Manager
 *   - unset -> local gitignored JSON file (local development only; there is
 *     no durable store for other environments without the secret configured)
 */

const fs = require('fs');
const path = require('path');
const {
  GetSecretValueCommand,
  PutSecretValueCommand,
  ResourceNotFoundException,
} = require('@aws-sdk/client-secrets-manager');
const { getSecretsManagerClient } = require('../config/clients');
const { config } = require('../config/environment');
const logger = require('../utils/logger');

const LOCAL_CREDENTIALS_PATH = path.join(__dirname, '..', '.local-secrets', 'organizer-google-credentials.json');

let cache = null;

function readLocalFile() {
  try {
    return JSON.parse(fs.readFileSync(LOCAL_CREDENTIALS_PATH, 'utf8'));
  } catch (err) {
    return null;
  }
}

function writeLocalFile(credentials) {
  fs.mkdirSync(path.dirname(LOCAL_CREDENTIALS_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_CREDENTIALS_PATH, JSON.stringify(credentials, null, 2));
}

class OrganizerCredentialsStore {
  /**
   * Load the current Organizer Google credentials, or null if never connected.
   */
  async load() {
    if (cache) {
      return cache;
    }

    if (config.organizerGoogleCredentialsSecretId) {
      try {
        const client = getSecretsManagerClient();
        const response = await client.send(new GetSecretValueCommand({
          SecretId: config.organizerGoogleCredentialsSecretId,
        }));
        cache = JSON.parse(response.SecretString);
        return cache;
      } catch (err) {
        if (err instanceof ResourceNotFoundException) {
          return null;
        }
        logger.error('[OrganizerCredentials] Failed to load from Secrets Manager:', err.message);
        throw err;
      }
    }

    cache = readLocalFile();
    return cache;
  }

  /**
   * Persist Organizer Google credentials (called from the OAuth callback,
   * and again whenever the access token is refreshed).
   */
  async save(credentials) {
    cache = credentials;

    if (config.organizerGoogleCredentialsSecretId) {
      const client = getSecretsManagerClient();
      await client.send(new PutSecretValueCommand({
        SecretId: config.organizerGoogleCredentialsSecretId,
        SecretString: JSON.stringify(credentials),
      }));
      return;
    }

    writeLocalFile(credentials);
    logger.warn(
      '[OrganizerCredentials] ORGANIZER_GOOGLE_CREDENTIALS_SECRET_ID is not set — ' +
      'credentials were written to a local file only, not AWS Secrets Manager. ' +
      'Set the env var for dev/uat/prod use.'
    );
  }

  /** Invalidate the in-process cache (mainly for tests). */
  clearCache() {
    cache = null;
  }
}

module.exports = new OrganizerCredentialsStore();

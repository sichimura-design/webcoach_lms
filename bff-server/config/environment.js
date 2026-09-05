/**
 * Environment Configuration
 * Centralized environment variable management
 */

const NODE_ENV = process.env.NODE_ENV || 'development';

const config = {
  // Server
  port: process.env.PORT || 3001,
  nodeEnv: NODE_ENV,

  // Moodle
  moodleUrl: process.env.MOODLE_URL || 'http://localhost',
  moodleServiceUsername: process.env.MOODLE_SERVICE_USERNAME,
  moodleServicePassword: process.env.MOODLE_SERVICE_PASSWORD,
  moodleServiceName: process.env.MOODLE_SERVICE_NAME || 'moodle_mobile_app',

  // API Server
  apiServerUrl: process.env.API_SERVER_URL || 'http://localhost:8001',

  // Session
  sessionSecret: process.env.SESSION_SECRET,

  // Cognito
  cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID || 'ap-northeast-1_aAPBRNL7D',
  cognitoClientId: process.env.COGNITO_CLIENT_ID || '23jacbr6nk4baiftjueddmr4kb',
  cognitoRegion: process.env.COGNITO_REGION || 'ap-northeast-1',

  // S3 & CloudFront
  s3BucketName: process.env.S3_BUCKET_NAME || '',
  cloudFrontDomain: process.env.CLOUDFRONT_DOMAIN || '',

  // Content Token
  contentTokenSecret: process.env.CONTENT_TOKEN_SECRET,

  // Frontend (used to build OAuth callback redirect URLs)
  frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:3000',

  // Zoom OAuth (individual coach connect flow)
  zoomClientId: process.env.ZOOM_CLIENT_ID,
  zoomClientSecret: process.env.ZOOM_CLIENT_SECRET,
  zoomRedirectUri: process.env.ZOOM_REDIRECT_URI,
  zoomOAuthScopes: process.env.ZOOM_OAUTH_SCOPES || 'user:read',

  // Google OAuth — Organizer-centric model: a single company-shared Google
  // Workspace account authorizes once; the resulting refresh token is then
  // used to call the Meet API for every coach's meetings. This is NOT a
  // per-coach connect flow (see IntegrationService.buildOrganizerAuthorizeUrl).
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
  googleOAuthScopes: process.env.GOOGLE_OAUTH_SCOPES ||
    'https://www.googleapis.com/auth/userinfo.email ' +
    'https://www.googleapis.com/auth/meetings.space.created ' +
    'https://www.googleapis.com/auth/meetings.space.readonly',

  // Organizer Google credentials storage (written after the OAuth callback, read before each Meet API call).
  //   set   -> AWS Secrets Manager secret name/ARN (dev/uat/prod)
  //   unset -> falls back to a local gitignored file, local development only
  organizerGoogleCredentialsSecretId: process.env.ORGANIZER_GOOGLE_CREDENTIALS_SECRET_ID,

  // Google OAuth Client ID/Secret storage. When set, these override
  // GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET above at startup (see
  // loadGoogleOAuthClientCredentials below) with values pulled from a
  // Secrets Manager secret {"client_id": "...", "client_secret": "..."}.
  googleOAuthClientSecretId: process.env.GOOGLE_OAUTH_CLIENT_SECRET_ID,

  // OAuth state signing (CSRF protection) and token encryption at rest
  integrationStateSecret: process.env.INTEGRATION_STATE_SECRET,
  integrationTokenEncKey: process.env.INTEGRATION_TOKEN_ENC_KEY,

  // CORS
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'https://dils5ct97pefc.cloudfront.net',
    'https://d1zs9qsimyg41i.cloudfront.net'
  ],
};

/**
 * Validate required environment variables
 */
function validateEnvironment() {
  console.log('=== Environment Validation ===');

  const required = [
    'moodleUrl',
    'apiServerUrl',
    'moodleServiceUsername',
    'moodleServicePassword',
    'sessionSecret',
    'contentTokenSecret'
  ];

  const missing = required.filter(key => !config[key]);

  if (missing.length > 0) {
    const envVarNames = {
      moodleUrl: 'MOODLE_URL',
      apiServerUrl: 'API_SERVER_URL',
      moodleServiceUsername: 'MOODLE_SERVICE_USERNAME',
      moodleServicePassword: 'MOODLE_SERVICE_PASSWORD',
      sessionSecret: 'SESSION_SECRET',
      contentTokenSecret: 'CONTENT_TOKEN_SECRET'
    };
    const missingEnvVars = missing.map(k => envVarNames[k]);
    console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  }

  // Warn if secrets look weak (for additional security)
  if (config.sessionSecret && config.sessionSecret.length < 32) {
    console.warn('⚠️  SESSION_SECRET should be at least 32 characters for better security');
  }

  if (config.contentTokenSecret && config.contentTokenSecret.length < 32) {
    console.warn('⚠️  CONTENT_TOKEN_SECRET should be at least 32 characters for better security');
  }

  console.log('✅ All required environment variables are set');
  console.log('   MOODLE_URL:', config.moodleUrl);
  console.log('   API_SERVER_URL:', config.apiServerUrl);
  console.log('   MOODLE_SERVICE_USERNAME:', config.moodleServiceUsername);
  console.log('   MOODLE_SERVICE_NAME:', config.moodleServiceName);
  console.log('   NODE_ENV:', config.nodeEnv);
}

/**
 * If GOOGLE_OAUTH_CLIENT_SECRET_ID is set, fetch {client_id, client_secret}
 * from AWS Secrets Manager and use them in place of the plain
 * GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET env vars. No-op otherwise.
 * Must be awaited before the server starts accepting requests.
 */
async function loadGoogleOAuthClientCredentials() {
  if (!config.googleOAuthClientSecretId) {
    return;
  }

  const { getSecretsManagerClient } = require('./clients');
  const { GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

  const client = getSecretsManagerClient();
  const response = await client.send(new GetSecretValueCommand({
    SecretId: config.googleOAuthClientSecretId,
  }));
  const credentials = JSON.parse(response.SecretString);

  config.googleClientId = credentials.client_id;
  config.googleClientSecret = credentials.client_secret;
  console.log('✅ Loaded Google OAuth client credentials from Secrets Manager:', config.googleOAuthClientSecretId);
}

module.exports = {
  config,
  validateEnvironment,
  loadGoogleOAuthClientCredentials
};

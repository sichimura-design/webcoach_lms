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

module.exports = {
  config,
  validateEnvironment
};

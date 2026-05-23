/**
 * Client Factory
 * Centralized client instantiation for external services
 */

const { CognitoJwtVerifier } = require('aws-jwt-verify');
const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
const { S3Client } = require('@aws-sdk/client-s3');
const { config } = require('./environment');

let jwtVerifierInstance = null;
let cognitoClientInstance = null;
let s3ClientInstance = null;

/**
 * Get or create Cognito JWT Verifier instance (singleton)
 */
function getCognitoJwtVerifier() {
  if (!jwtVerifierInstance) {
    jwtVerifierInstance = CognitoJwtVerifier.create({
      userPoolId: config.cognitoUserPoolId,
      tokenUse: 'id',
      clientId: config.cognitoClientId,
    });
  }
  return jwtVerifierInstance;
}

/**
 * Get or create Cognito Identity Provider Client instance (singleton)
 */
function getCognitoClient() {
  if (!cognitoClientInstance) {
    cognitoClientInstance = new CognitoIdentityProviderClient({
      region: config.cognitoRegion
    });
  }
  return cognitoClientInstance;
}

/**
 * Get or create S3 Client instance (singleton)
 */
function getS3Client() {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: config.cognitoRegion
    });
  }
  return s3ClientInstance;
}

module.exports = {
  getCognitoJwtVerifier,
  getCognitoClient,
  getS3Client
};

/**
 * Secure Logger Utility
 * Automatically masks sensitive information in logs
 */

/**
 * Masks sensitive data in objects before logging
 * @param {*} data - Data to mask
 * @returns {*} Masked data
 */
function maskSensitiveData(data) {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const masked = Array.isArray(data) ? [] : {};
  const sensitiveKeys = [
    'password', 'token', 'secret', 'authorization',
    'api_key', 'apiKey', 'session', 'bearer', 'jwt',
    'apikey', 'api-key', 'auth', 'credential', 'key'
  ];

  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase();

    // Check if key contains sensitive keywords
    if (sensitiveKeys.some(sensitive => keyLower.includes(sensitive))) {
      masked[key] = '[REDACTED]';
    }
    // Mask email addresses (show first 2 chars + domain)
    else if (key === 'email' && typeof value === 'string' && value.includes('@')) {
      const [local, domain] = value.split('@');
      masked[key] = `${local.substring(0, 2)}***@${domain}`;
    }
    // Mask sub (Cognito user ID) - show first 8 chars
    else if (key === 'sub' && typeof value === 'string') {
      masked[key] = `${value.substring(0, 8)}***`;
    }
    // Recursively mask nested objects
    else if (typeof value === 'object') {
      masked[key] = maskSensitiveData(value);
    }
    else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Secure console.log wrapper
 */
function log(...args) {
  const maskedArgs = args.map(arg => maskSensitiveData(arg));
  console.log(...maskedArgs);
}

/**
 * Secure console.error wrapper
 */
function error(...args) {
  const maskedArgs = args.map(arg => maskSensitiveData(arg));
  console.error(...maskedArgs);
}

/**
 * Secure console.warn wrapper
 */
function warn(...args) {
  const maskedArgs = args.map(arg => maskSensitiveData(arg));
  console.warn(...maskedArgs);
}

/**
 * Secure console.info wrapper
 */
function info(...args) {
  const maskedArgs = args.map(arg => maskSensitiveData(arg));
  console.info(...maskedArgs);
}

/**
 * Secure console.debug wrapper
 */
function debug(...args) {
  if (process.env.NODE_ENV === 'development') {
    const maskedArgs = args.map(arg => maskSensitiveData(arg));
    console.debug(...maskedArgs);
  }
}

module.exports = {
  maskSensitiveData,
  log,
  error,
  warn,
  info,
  debug
};

/**
 * Validation Utilities
 */

/**
 * Validate array input
 * @param {any} value - Value to validate
 * @param {string} fieldName - Field name for error message
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateArray(value, fieldName) {
  if (!value) {
    return {
      valid: false,
      error: `${fieldName} is required`
    };
  }

  if (!Array.isArray(value)) {
    return {
      valid: false,
      error: `${fieldName} must be an array`
    };
  }

  if (value.length === 0) {
    return {
      valid: false,
      error: `${fieldName} array cannot be empty`
    };
  }

  return { valid: true };
}

/**
 * Validate required fields in object
 * @param {Object} obj - Object to validate
 * @param {string[]} requiredFields - Required field names
 * @returns {Object} { valid: boolean, error?: string, missingFields?: string[] }
 */
function validateRequiredFields(obj, requiredFields) {
  const missing = requiredFields.filter(field => !obj[field]);

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing required fields: ${missing.join(', ')}`,
      missingFields: missing
    };
  }

  return { valid: true };
}

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = {
  validateArray,
  validateRequiredFields,
  validateEmail
};

/**
 * Input Validation Utilities
 * Provides type-safe validation for common input types
 */

/**
 * Validate and parse integer with range checking
 * @param {*} value - Value to validate
 * @param {Object} options - Validation options
 * @param {number} options.min - Minimum allowed value (inclusive)
 * @param {number} options.max - Maximum allowed value (inclusive)
 * @param {string} options.fieldName - Field name for error messages
 * @returns {number} Validated integer
 * @throws {Error} If validation fails
 */
function validateInteger(value, options = {}) {
  const { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, fieldName = 'value' } = options;

  // Check if value is provided
  if (value === undefined || value === null || value === '') {
    throw new Error(`${fieldName} is required`);
  }

  // Parse as integer
  const parsed = parseInt(value, 10);

  // Check if parsing succeeded
  if (isNaN(parsed)) {
    throw new Error(`${fieldName} must be a valid integer`);
  }

  // Check if original value was an integer (not a float)
  if (String(parsed) !== String(value).trim()) {
    throw new Error(`${fieldName} must be an integer (no decimal points)`);
  }

  // Range check
  if (parsed < min) {
    throw new Error(`${fieldName} must be at least ${min}`);
  }

  if (parsed > max) {
    throw new Error(`${fieldName} must be at most ${max}`);
  }

  return parsed;
}

/**
 * Validate positive integer (commonly used for IDs)
 * @param {*} value - Value to validate
 * @param {string} fieldName - Field name for error messages
 * @returns {number} Validated positive integer
 */
function validatePositiveInteger(value, fieldName = 'value') {
  return validateInteger(value, { min: 1, fieldName });
}

/**
 * Validate non-negative integer (0 or positive)
 * @param {*} value - Value to validate
 * @param {string} fieldName - Field name for error messages
 * @returns {number} Validated non-negative integer
 */
function validateNonNegativeInteger(value, fieldName = 'value') {
  return validateInteger(value, { min: 0, fieldName });
}

/**
 * Validate string with length checking
 * @param {*} value - Value to validate
 * @param {Object} options - Validation options
 * @param {number} options.minLength - Minimum length
 * @param {number} options.maxLength - Maximum length
 * @param {RegExp} options.pattern - Optional regex pattern
 * @param {string} options.fieldName - Field name for error messages
 * @returns {string} Validated string
 */
function validateString(value, options = {}) {
  const { minLength = 0, maxLength = Infinity, pattern = null, fieldName = 'value' } = options;

  // Check if value is provided
  if (value === undefined || value === null) {
    throw new Error(`${fieldName} is required`);
  }

  // Convert to string and trim
  const str = String(value).trim();

  // Length checks
  if (str.length < minLength) {
    throw new Error(`${fieldName} must be at least ${minLength} characters`);
  }

  if (str.length > maxLength) {
    throw new Error(`${fieldName} must be at most ${maxLength} characters`);
  }

  // Pattern check
  if (pattern && !pattern.test(str)) {
    throw new Error(`${fieldName} has invalid format`);
  }

  return str;
}

/**
 * Validate email address
 * @param {*} value - Email to validate
 * @param {string} fieldName - Field name for error messages
 * @returns {string} Validated email
 */
function validateEmail(value, fieldName = 'email') {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return validateString(value, {
    minLength: 3,
    maxLength: 254, // RFC 5321
    pattern: emailPattern,
    fieldName
  });
}

/**
 * Validate array
 * @param {*} value - Value to validate
 * @param {Object} options - Validation options
 * @param {number} options.minLength - Minimum array length
 * @param {number} options.maxLength - Maximum array length
 * @param {Function} options.itemValidator - Optional validator function for each item
 * @param {string} options.fieldName - Field name for error messages
 * @returns {Array} Validated array
 */
function validateArray(value, options = {}) {
  const { minLength = 0, maxLength = Infinity, itemValidator = null, fieldName = 'value' } = options;

  // Check if value is an array
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  // Length checks
  if (value.length < minLength) {
    throw new Error(`${fieldName} must contain at least ${minLength} items`);
  }

  if (value.length > maxLength) {
    throw new Error(`${fieldName} must contain at most ${maxLength} items`);
  }

  // Validate each item if validator provided
  if (itemValidator) {
    return value.map((item, index) => {
      try {
        return itemValidator(item);
      } catch (error) {
        throw new Error(`${fieldName}[${index}]: ${error.message}`);
      }
    });
  }

  return value;
}

/**
 * Validate boolean
 * @param {*} value - Value to validate
 * @param {string} fieldName - Field name for error messages
 * @returns {boolean} Validated boolean
 */
function validateBoolean(value, fieldName = 'value') {
  if (typeof value === 'boolean') {
    return value;
  }

  // Accept string representations
  const str = String(value).toLowerCase().trim();
  if (str === 'true' || str === '1') {
    return true;
  }
  if (str === 'false' || str === '0') {
    return false;
  }

  throw new Error(`${fieldName} must be a boolean value`);
}

module.exports = {
  validateInteger,
  validatePositiveInteger,
  validateNonNegativeInteger,
  validateString,
  validateEmail,
  validateArray,
  validateBoolean
};

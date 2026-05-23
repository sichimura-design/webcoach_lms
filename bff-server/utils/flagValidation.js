/**
 * Flag Validation Utilities
 * Provides strict validation for boolean flags that may come as strings
 */

/**
 * Check if a flag value should be considered true
 * Only accepts: true, 1, or "1"
 * Everything else (including "0", 0, false, null, undefined) returns false
 *
 * @param {any} flag - The flag value to check
 * @returns {boolean} - true if flag is truthy, false otherwise
 */
function isFlagTrue(flag) {
  return flag === true || flag === 1 || flag === "1";
}

/**
 * Check if a flag value should be considered false
 * Accepts: false, 0, "0", null, undefined, or any non-truthy value
 *
 * @param {any} flag - The flag value to check
 * @returns {boolean} - true if flag is falsy, false otherwise
 */
function isFlagFalse(flag) {
  return !isFlagTrue(flag);
}

module.exports = {
  isFlagTrue,
  isFlagFalse
};

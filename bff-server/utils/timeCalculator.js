/**
 * Time Calculator Utility
 * Calculate time differences and format them in human-readable format
 */

/**
 * Calculate time since last access and format as "X分前", "X時間前", or "X日前"
 * @param {number} lastAccessTimestamp - Unix timestamp (seconds)
 * @returns {string} Formatted time string
 */
function formatLastAccess(lastAccessTimestamp) {
  // Handle null, undefined, or 0 (never logged in)
  if (!lastAccessTimestamp || lastAccessTimestamp === 0) {
    return 'ログインなし';
  }

  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  const diffSeconds = now - lastAccessTimestamp;

  // Convert to minutes, hours, and days
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffSeconds / 3600);
  const diffDays = Math.floor(diffSeconds / 86400);

  // Decide which unit to use
  if (diffDays > 0) {
    return `${diffDays}日前`;
  } else if (diffHours > 0) {
    return `${diffHours}時間前`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}分前`;
  } else {
    return '1分以内';
  }
}

/**
 * Get formatted current timestamp
 * @returns {string} ISO 8601 timestamp
 */
function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Convert Unix timestamp to ISO 8601 format
 * @param {number} unixTimestamp - Unix timestamp (seconds)
 * @returns {string} ISO 8601 timestamp
 */
function unixToISO(unixTimestamp) {
  if (!unixTimestamp || unixTimestamp === 0) {
    return null;
  }
  return new Date(unixTimestamp * 1000).toISOString();
}

module.exports = {
  formatLastAccess,
  getCurrentTimestamp,
  unixToISO
};

/**
 * Rate Limiting Middleware
 * Protects against brute force and DoS attacks
 */

const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 * Applied to all API endpoints
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests',
    detail: 'You have exceeded the rate limit. Please try again later.'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip successful requests that don't consume resources
  skip: (req, res) => res.statusCode < 400,
});

/**
 * Strict limiter for authentication endpoints
 * Protects against brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    error: 'Too many authentication attempts',
    detail: 'Too many failed login attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Only count failed authentication attempts
  skipSuccessfulRequests: true,
});

/**
 * Moderate limiter for data modification endpoints
 * Protects against abuse of create/update/delete operations
 */
const modifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 modifications per windowMs
  message: {
    error: 'Too many modification requests',
    detail: 'You have exceeded the rate limit for data modifications.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict limiter for sensitive operations
 * Applied to admin endpoints, bulk operations, etc.
 */
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 requests per hour
  message: {
    error: 'Too many requests to sensitive endpoint',
    detail: 'This endpoint has strict rate limiting. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  authLimiter,
  modifyLimiter,
  sensitiveLimiter,
};

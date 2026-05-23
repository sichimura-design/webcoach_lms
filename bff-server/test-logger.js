/**
 * Test script for logger masking functionality
 */

const logger = require('./utils/logger');

console.log('=== Testing Logger Masking Functionality ===\n');

// Test 1: Mask password in object
console.log('Test 1: Masking password');
logger.log('User data:', {
  username: 'testuser',
  password: 'secretPassword123',
  email: 'test@example.com'
});

// Test 2: Mask JWT token
console.log('\nTest 2: Masking token');
logger.log('Auth header:', {
  authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
  token: 'abc123def456'
});

// Test 3: Mask API key
console.log('\nTest 3: Masking API key');
logger.log('Request headers:', {
  'x-api-key': 'secret-api-key-12345',
  'content-type': 'application/json'
});

// Test 4: Mask email (partial)
console.log('\nTest 4: Masking email');
logger.log('User info:', {
  email: 'john.doe@example.com',
  name: 'John Doe'
});

// Test 5: Mask Cognito sub
console.log('\nTest 5: Masking Cognito sub');
logger.log('Cognito user:', {
  sub: '12345678-1234-1234-1234-123456789012',
  email: 'user@example.com',
  username: 'testuser'
});

// Test 6: Mask nested objects
console.log('\nTest 6: Masking nested objects');
logger.log('Nested data:', {
  user: {
    username: 'admin',
    password: 'admin123',
    apiKey: 'secret-key-789'
  },
  config: {
    database: {
      host: 'localhost',
      password: 'db-password-456'
    }
  }
});

// Test 7: Error logging with sensitive data
console.log('\nTest 7: Error logging with sensitive data');
logger.error('Login failed:', {
  username: 'testuser',
  password: 'wrongPassword',
  error: 'Invalid credentials'
});

console.log('\n=== Tests Complete ===');

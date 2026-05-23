/**
 * Unit tests for flag validation utilities
 * Run with: node flagValidation.test.js
 */

const { isFlagTrue, isFlagFalse } = require('./flagValidation');

// Test framework
let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✓ ${description}`);
    passed++;
  } catch (error) {
    console.error(`✗ ${description}`);
    console.error(`  Error: ${error.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, but got ${actual}`);
  }
}

console.log('Running flag validation tests...\n');

// isFlagTrue tests
console.log('=== isFlagTrue tests ===');

test('isFlagTrue(true) should return true', () => {
  assertEqual(isFlagTrue(true), true);
});

test('isFlagTrue(1) should return true', () => {
  assertEqual(isFlagTrue(1), true);
});

test('isFlagTrue("1") should return true', () => {
  assertEqual(isFlagTrue("1"), true);
});

test('isFlagTrue(false) should return false', () => {
  assertEqual(isFlagTrue(false), false);
});

test('isFlagTrue(0) should return false', () => {
  assertEqual(isFlagTrue(0), false);
});

test('isFlagTrue("0") should return false - THIS IS THE BUG FIX', () => {
  assertEqual(isFlagTrue("0"), false);
});

test('isFlagTrue(null) should return false', () => {
  assertEqual(isFlagTrue(null), false);
});

test('isFlagTrue(undefined) should return false', () => {
  assertEqual(isFlagTrue(undefined), false);
});

test('isFlagTrue("") should return false', () => {
  assertEqual(isFlagTrue(""), false);
});

test('isFlagTrue("true") should return false (string "true" is not accepted)', () => {
  assertEqual(isFlagTrue("true"), false);
});

test('isFlagTrue("false") should return false', () => {
  assertEqual(isFlagTrue("false"), false);
});

test('isFlagTrue(2) should return false (only 1 is truthy)', () => {
  assertEqual(isFlagTrue(2), false);
});

test('isFlagTrue({}) should return false', () => {
  assertEqual(isFlagTrue({}), false);
});

test('isFlagTrue([]) should return false', () => {
  assertEqual(isFlagTrue([]), false);
});

// isFlagFalse tests
console.log('\n=== isFlagFalse tests ===');

test('isFlagFalse(false) should return true', () => {
  assertEqual(isFlagFalse(false), true);
});

test('isFlagFalse(0) should return true', () => {
  assertEqual(isFlagFalse(0), true);
});

test('isFlagFalse("0") should return true', () => {
  assertEqual(isFlagFalse("0"), true);
});

test('isFlagFalse(null) should return true', () => {
  assertEqual(isFlagFalse(null), true);
});

test('isFlagFalse(undefined) should return true', () => {
  assertEqual(isFlagFalse(undefined), true);
});

test('isFlagFalse(true) should return false', () => {
  assertEqual(isFlagFalse(true), false);
});

test('isFlagFalse(1) should return false', () => {
  assertEqual(isFlagFalse(1), false);
});

test('isFlagFalse("1") should return false', () => {
  assertEqual(isFlagFalse("1"), false);
});

// Summary
console.log('\n=== Test Summary ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

if (failed === 0) {
  console.log('\n✓ All tests passed!');
  process.exit(0);
} else {
  console.log(`\n✗ ${failed} test(s) failed`);
  process.exit(1);
}

const test = require('node:test');
const assert = require('node:assert/strict');
const { slugify, calcReadingTime } = require('../utils/helpers');

test('slugify makes URL-friendly slugs', () => {
  assert.equal(slugify('Hello, World! 2026'), 'hello-world-2026');
  assert.equal(slugify('  Café Au Lait  '), 'cafe-au-lait');
  assert.equal(slugify('!!!'), 'post');
});

test('calcReadingTime is at least 1 minute and scales with length', () => {
  assert.equal(calcReadingTime('short'), 1);
  assert.equal(calcReadingTime('word '.repeat(450)), 3);
});

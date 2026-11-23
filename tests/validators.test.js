const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePostInput, parseListQuery, isValidRef } = require('../utils/validators');

const good = { title: 'A fine title', content: 'Some perfectly fine content.', author: 'Asha', category: 'Tech' };

test('create: accepts a valid post and applies defaults', () => {
  const { errors, value } = validatePostInput(good);
  assert.equal(errors.length, 0);
  assert.deepEqual(value.tags, []);
  assert.equal(value.status, 'published');
});

test('create: reports every missing required field', () => {
  const { errors } = validatePostInput({});
  assert.deepEqual(errors.map((e) => e.field).sort(), ['author', 'category', 'content', 'title']);
});

test('create: trims text, normalises and de-duplicates tags', () => {
  const { value } = validatePostInput({ ...good, title: '  Padded title  ', tags: [' Node ', 'node', 'API'] });
  assert.equal(value.title, 'Padded title');
  assert.deepEqual(value.tags, ['node', 'api']);
});

test('create: rejects wrong types, unknown fields, bad status and too many tags', () => {
  assert.ok(validatePostInput({ ...good, title: 123 }).errors.some((e) => e.field === 'title'));
  assert.ok(validatePostInput({ ...good, id: 'hack' }).errors.some((e) => e.field === 'id'));
  assert.ok(validatePostInput({ ...good, status: 'archived' }).errors.some((e) => e.field === 'status'));
  const tags = Array.from({ length: 9 }, (_, i) => `tag${i}`);
  assert.ok(validatePostInput({ ...good, tags }).errors.some((e) => e.field === 'tags'));
});

test('create: accepts authorName as an alias of author', () => {
  const { authorName, ...rest } = { ...good, authorName: 'Ravi' };
  delete rest.author;
  const { errors, value } = validatePostInput({ ...rest, authorName });
  assert.equal(errors.length, 0);
  assert.equal(value.author, 'Ravi');
});

test('create: body must be an object', () => {
  assert.equal(validatePostInput([]).errors[0].field, 'body');
  assert.equal(validatePostInput('text').errors[0].field, 'body');
});

test('update: any subset is fine, empty is not', () => {
  assert.equal(validatePostInput({ category: 'News' }, { partial: true }).errors.length, 0);
  assert.equal(validatePostInput({}, { partial: true }).errors[0].field, 'body');
  assert.ok(validatePostInput({ title: 'x' }, { partial: true }).errors.length > 0);
});

test('list query: defaults and bad values', () => {
  const ok = parseListQuery({});
  assert.deepEqual([ok.value.page, ok.value.limit, ok.value.sort, ok.value.order], [1, 50, 'createdDate', 'desc']);
  assert.ok(parseListQuery({ page: '0' }).errors.length);
  assert.ok(parseListQuery({ limit: '101' }).errors.length);
  assert.ok(parseListQuery({ sort: 'password' }).errors.length);
  assert.ok(parseListQuery({ status: 'nope' }).errors.length);
  assert.ok(parseListQuery({ search: ['a', 'b'] }).errors.length);
});

test('id reference validation', () => {
  assert.ok(isValidRef('00000000-0000-4000-8000-000000000001'));
  assert.ok(isValidRef('my-first-post'));
  assert.ok(!isValidRef('bad id!'));
  assert.ok(!isValidRef('../etc/passwd'));
});

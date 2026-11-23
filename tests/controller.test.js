const test = require('node:test');
const assert = require('node:assert/strict');
const JsonStore = require('../models/JsonStore');
const { createPostModel } = require('../models/postModel');
const createPostController = require('../controllers/postController');
const AppError = require('../utils/AppError');
const errorHandler = require('../middleware/errorHandler');
const apiKeyGuard = require('../middleware/apiKey');
const { validateCreate, validateUpdate, validateListQuery, validateIdParam } = require('../middleware/validate');

/** Minimal fake of Express' req/res so controllers run without Express installed. */
function mockRes() {
  return {
    statusCode: 200, body: null, headers: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    location(l) { this.headers.location = l; return this; },
    setHeader() { return this; },
  };
}
/** Runs a handler; returns the res, or the error passed to next(). */
async function run(handler, req = {}) {
  const res = mockRes();
  let error = null;
  await handler({ params: {}, query: {}, body: {}, ...req }, res, (e) => { error = e || null; });
  return { res, error };
}

const valid = { title: 'Controller test', content: 'Enough content to pass validation.', author: 'Asha', category: 'Tech' };
const setup = () => createPostController(createPostModel(new JsonStore()));

test('createPost -> 201 + Location header', async () => {
  const c = setup();
  const { res } = await run(c.createPost, { validated: { ...valid, tags: [], status: 'published' } });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.headers.location, `/posts/${res.body.data.id}`);
});

test('getPost -> 200 for existing, 404 AppError for missing', async () => {
  const c = setup();
  const created = (await run(c.createPost, { validated: { ...valid, tags: [], status: 'published' } })).res.body.data;
  const ok = await run(c.getPost, { params: { id: created.slug } });
  assert.equal(ok.res.statusCode, 200);
  assert.equal(ok.res.body.data.views, 1);
  const missing = await run(c.getPost, { params: { id: 'does-not-exist' } });
  assert.ok(missing.error instanceof AppError);
  assert.equal(missing.error.statusCode, 404);
});

test('getAllPosts returns data + pagination meta', async () => {
  const c = setup();
  await run(c.createPost, { validated: { ...valid, tags: [], status: 'published' } });
  const { res } = await run(c.getAllPosts, { listQuery: {} });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.meta.total, 1);
});

test('updatePost -> 200, and 404 when missing', async () => {
  const c = setup();
  const p = (await run(c.createPost, { validated: { ...valid, tags: [], status: 'published' } })).res.body.data;
  const ok = await run(c.updatePost, { params: { id: p.id }, validated: { category: 'News' } });
  assert.equal(ok.res.body.data.category, 'News');
  const bad = await run(c.updatePost, { params: { id: 'nope' }, validated: { category: 'News' } });
  assert.equal(bad.error.statusCode, 404);
});

test('deletePost: soft by default, permanent on request, validates flag', async () => {
  const c = setup();
  const p = (await run(c.createPost, { validated: { ...valid, tags: [], status: 'published' } })).res.body.data;

  const soft = await run(c.deletePost, { params: { id: p.id } });
  assert.equal(soft.res.statusCode, 200);
  assert.ok(soft.res.body.data.deletedAt);
  assert.equal((await run(c.getPost, { params: { id: p.id } })).error.statusCode, 404);

  assert.equal((await run(c.listTrash)).res.body.data.length, 1);
  assert.equal((await run(c.deletePost, { params: { id: p.id }, query: { permanent: 'maybe' } })).error.statusCode, 400);

  const restored = await run(c.restorePost, { params: { id: p.id } });
  assert.equal(restored.res.statusCode, 200);
  assert.equal((await run(c.restorePost, { params: { id: p.id } })).error.statusCode, 409);

  const hard = await run(c.deletePost, { params: { id: p.id }, query: { permanent: 'true' } });
  assert.equal(hard.res.body.message, 'Post permanently deleted');
  assert.equal((await run(c.deletePost, { params: { id: p.id }, query: { permanent: 'true' } })).error.statusCode, 404);
});

test('likePost and getStats', async () => {
  const c = setup();
  const p = (await run(c.createPost, { validated: { ...valid, tags: [], status: 'published' } })).res.body.data;
  assert.equal((await run(c.likePost, { params: { id: p.id } })).res.body.data.likes, 1);
  assert.equal((await run(c.likePost, { params: { id: 'zzz' } })).error.statusCode, 404);
  assert.equal((await run(c.getStats)).res.body.data.totalLikes, 1);
});

test('validation middleware passes clean input and blocks bad input with 400', async () => {
  const good = { body: valid };
  const r1 = await run(validateCreate, good);
  assert.equal(r1.error, null);

  const req = { body: { title: 'x' } };
  const r2 = await run(validateCreate, req);
  assert.equal(r2.error.statusCode, 400);
  assert.ok(r2.error.details.length >= 3);

  assert.equal((await run(validateUpdate, { body: {} })).error.statusCode, 400);
  assert.equal((await run(validateListQuery, { query: { page: 'abc' } })).error.statusCode, 400);
  assert.equal((await run(validateIdParam, { params: { id: 'bad id!' } })).error.statusCode, 400);
  assert.equal((await run(validateIdParam, { params: { id: 'good-id' } })).error, null);
});

test('apiKeyGuard: open when unset, strict when set', async () => {
  assert.equal((await run(apiKeyGuard(''), { get: () => undefined })).error, null);
  const guard = apiKeyGuard('secret');
  assert.equal((await run(guard, { get: () => undefined })).error.statusCode, 401);
  assert.equal((await run(guard, { get: () => 'wrong!' })).error.statusCode, 401);
  assert.equal((await run(guard, { get: () => 'secret' })).error, null);
});

test('errorHandler shapes AppError, bad JSON and unknown errors', async () => {
  const call = (err) => {
    const res = mockRes();
    const origError = console.error;
    console.error = () => {};
    errorHandler(err, { id: 'abc12345' }, res, () => {});
    console.error = origError;
    return res;
  };
  const a = call(new AppError('Nope', 404));
  assert.deepEqual([a.statusCode, a.body.success, a.body.message], [404, false, 'Nope']);
  const v = call(new AppError('Validation failed', 400, [{ field: 'title', message: 'x' }]));
  assert.equal(v.body.errors[0].field, 'title');
  assert.equal(call(Object.assign(new Error('x'), { type: 'entity.parse.failed' })).statusCode, 400);
  assert.equal(call(new Error('boom')).body.message, 'Internal server error');
});

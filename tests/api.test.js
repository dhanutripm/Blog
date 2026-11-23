/**
 * End-to-end tests: boots the real Express app on a random port and calls it
 * with fetch(). Skipped automatically until you run `npm install`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let hasExpress = true;
try { require.resolve('express'); } catch { hasExpress = false; }

test('HTTP API end-to-end', { skip: !hasExpress && 'express not installed – run npm install' }, async (t) => {
  const { createApp } = require('../app');
  const JsonStore = require('../models/JsonStore');
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'seed.json'), 'utf8'));
  const app = createApp({ store: new JsonStore({ seed }), apiKey: '', logRequests: false });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => server.close());

  const call = async (method, url, body, headers = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json(), headers: res.headers };
  };

  const newPost = { title: 'End to end post', content: 'This post is created by the e2e test suite.', author: 'Tester', category: 'QA', tags: ['e2e'] };

  await t.test('POST /posts creates (201) and rejects bad input (400)', async () => {
    const ok = await call('POST', '/posts', newPost);
    assert.equal(ok.status, 201);
    assert.ok(ok.headers.get('location').startsWith('/posts/'));
    const bad = await call('POST', '/posts', { title: 'x' });
    assert.equal(bad.status, 400);
    assert.ok(Array.isArray(bad.body.errors));
    const broken = await call('POST', '/posts', '{not json');
    assert.equal(broken.status, 400);
    assert.equal(broken.body.message, 'Malformed JSON in request body');
  });

  await t.test('GET /posts lists, filters and paginates', async () => {
    const all = await call('GET', '/posts');
    assert.equal(all.status, 200);
    assert.equal(all.body.meta.total, 6);
    assert.equal((await call('GET', '/posts?category=backend')).body.meta.total, 3);
    assert.equal((await call('GET', '/posts?limit=2&page=2')).body.data.length, 2);
    assert.equal((await call('GET', '/posts?limit=0')).status, 400);
  });

  await t.test('GET /posts/:id by id and slug, 404 and 400', async () => {
    const byId = await call('GET', '/posts/00000000-0000-4000-8000-000000000001');
    assert.equal(byId.status, 200);
    const bySlug = await call('GET', '/posts/designing-friendly-validation-errors');
    assert.equal(bySlug.status, 200);
    assert.equal((await call('GET', '/posts/no-such-post')).status, 404);
    assert.equal((await call('GET', '/posts/bad%20id')).status, 400);
  });

  await t.test('PUT and PATCH update a post', async () => {
    const id = '00000000-0000-4000-8000-000000000002';
    const put = await call('PUT', `/posts/${id}`, { category: 'Web' });
    assert.equal(put.body.data.category, 'Web');
    const patch = await call('PATCH', `/posts/${id}`, { author: 'New Author' });
    assert.equal(patch.body.data.author, 'New Author');
    assert.equal((await call('PUT', `/posts/${id}`, {})).status, 400);
    assert.equal((await call('PUT', '/posts/ghost', { category: 'Web' })).status, 404);
  });

  await t.test('like, stats, trash, restore, permanent delete', async () => {
    const id = '00000000-0000-4000-8000-000000000003';
    assert.equal((await call('POST', `/posts/${id}/like`)).body.data.likes, 5);
    assert.equal((await call('GET', '/posts/stats')).status, 200);

    assert.equal((await call('DELETE', `/posts/${id}`)).status, 200);
    assert.equal((await call('GET', `/posts/${id}`)).status, 404);
    assert.equal((await call('GET', '/posts/trash')).body.data.length, 1);
    assert.equal((await call('POST', `/posts/${id}/restore`)).status, 200);
    assert.equal((await call('POST', `/posts/${id}/restore`)).status, 409);
    assert.equal((await call('DELETE', `/posts/${id}?permanent=true`)).status, 200);
    assert.equal((await call('DELETE', `/posts/${id}?permanent=true`)).status, 404);
  });

  await t.test('utility routes and unknown routes', async () => {
    assert.equal((await call('GET', '/health')).body.status, 'ok');
    assert.equal((await call('GET', '/docs')).status, 200);
    assert.equal((await call('GET', '/nothing-here')).status, 404);
  });
});

test('API key guard protects writes when configured', { skip: !hasExpress && 'express not installed – run npm install' }, async (t) => {
  const { createApp } = require('../app');
  const JsonStore = require('../models/JsonStore');
  const app = createApp({ store: new JsonStore(), apiKey: 'letmein', logRequests: false });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => server.close());

  const payload = JSON.stringify({ title: 'Guarded post', content: 'Needs a key to be created.', author: 'Asha', category: 'Tech' });
  const headers = { 'Content-Type': 'application/json' };
  assert.equal((await fetch(`${base}/posts`)).status, 200); // reads stay public
  assert.equal((await fetch(`${base}/posts`, { method: 'POST', headers, body: payload })).status, 401);
  assert.equal((await fetch(`${base}/posts`, { method: 'POST', headers: { ...headers, 'x-api-key': 'letmein' }, body: payload })).status, 201);
});

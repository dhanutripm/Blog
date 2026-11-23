const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const JsonStore = require('../models/JsonStore');
const { createPostModel } = require('../models/postModel');

const make = (n = 1, extra = {}) => ({
  title: `Post number ${n}`,
  content: `Content for post ${n} about node and express.`,
  author: n % 2 ? 'Asha' : 'Ravi',
  category: n % 2 ? 'Tech' : 'Life',
  tags: n % 2 ? ['node'] : ['life'],
  ...extra,
});
const fresh = () => createPostModel(new JsonStore());

test('create fills id, slug, dates and counters', async () => {
  const model = fresh();
  const p = await model.create(make(1));
  assert.match(p.id, /^[0-9a-f-]{36}$/);
  assert.equal(p.slug, 'post-number-1');
  assert.equal(p.views, 0);
  assert.equal(p.status, 'published');
  assert.ok(!Number.isNaN(Date.parse(p.createdDate)));
});

test('duplicate titles get unique slugs; reserved words are avoided', async () => {
  const model = fresh();
  const a = await model.create(make(1, { title: 'Same title' }));
  const b = await model.create(make(1, { title: 'Same title' }));
  const c = await model.create(make(1, { title: 'Stats' }));
  assert.equal(a.slug, 'same-title');
  assert.equal(b.slug, 'same-title-2');
  assert.equal(c.slug, 'stats-2');
});

test('find works with id or slug and view() counts views', async () => {
  const model = fresh();
  const p = await model.create(make(1));
  assert.equal((await model.find(p.slug)).id, p.id);
  await model.view(p.id);
  assert.equal((await model.view(p.slug)).views, 2);
  assert.equal(await model.view('missing'), null);
});

test('update keeps slug, refreshes readingTime and updatedDate', async () => {
  const model = fresh();
  const p = await model.create(make(1));
  const before = p.updatedDate;
  await new Promise((r) => setTimeout(r, 5));
  const u = await model.update(p.id, { title: 'Brand new title', content: 'word '.repeat(500) });
  assert.equal(u.slug, 'post-number-1');
  assert.equal(u.readingTime, 3);
  assert.notEqual(u.updatedDate, before);
  assert.equal(await model.update('nope', { title: 'x' }), null);
});

test('list: filters, search, sort and pagination', async () => {
  const model = fresh();
  for (let i = 1; i <= 5; i++) await model.create(make(i));
  await model.create(make(6, { status: 'draft', title: 'Hidden gem' }));

  assert.equal((await model.list({ category: 'tech' })).meta.total, 3);
  assert.equal((await model.list({ author: 'ravi' })).meta.total, 3);
  assert.equal((await model.list({ tag: 'NODE' })).meta.total, 3);
  assert.equal((await model.list({ status: 'draft' })).meta.total, 1);
  assert.equal((await model.list({ search: 'hidden gem' })).meta.total, 1);
  assert.equal((await model.list({ search: 'express hidden' })).meta.total, 1);

  const asc = await model.list({ sort: 'title', order: 'asc' });
  assert.equal(asc.items[0].title, 'Hidden gem');

  const page2 = await model.list({ limit: 4, page: 2 });
  assert.equal(page2.items.length, 2);
  assert.deepEqual([page2.meta.totalPages, page2.meta.hasNext, page2.meta.hasPrev], [2, false, true]);
});

test('soft delete -> trash -> restore, and permanent delete', async () => {
  const model = fresh();
  const p = await model.create(make(1));
  await model.softDelete(p.id);
  assert.equal(await model.find(p.id), null);
  assert.equal((await model.list()).meta.total, 0);
  assert.equal((await model.listTrash()).length, 1);
  assert.equal(await model.softDelete(p.id), null);

  assert.equal((await model.restore(p.id)).deletedAt, null);
  assert.equal((await model.list()).meta.total, 1);
  assert.equal(await model.restore(p.id), null); // not in trash any more

  assert.equal((await model.hardDelete(p.id)).id, p.id);
  assert.equal(await model.hardDelete(p.id), null);
});

test('like and stats', async () => {
  const model = fresh();
  const a = await model.create(make(1));
  await model.create(make(2, { status: 'draft' }));
  await model.like(a.id);
  await model.view(a.id);
  const s = await model.stats();
  assert.equal(s.totalPosts, 2);
  assert.equal(s.published, 1);
  assert.equal(s.drafts, 1);
  assert.equal(s.totalLikes, 1);
  assert.equal(s.mostViewed[0].id, a.id);
  assert.equal(s.categories.Tech, 1);
});

test('JsonStore persists to disk atomically and reloads', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quillpad-'));
  const file = path.join(dir, 'nested', 'posts.json');
  const model = createPostModel(new JsonStore({ filePath: file }));
  const p = await model.create(make(1));
  await model.like(p.id);

  const reloaded = createPostModel(new JsonStore({ filePath: file }));
  const found = await reloaded.find(p.id);
  assert.equal(found.likes, 1);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['posts.json']); // no leftover .tmp
  fs.rmSync(dir, { recursive: true, force: true });
});

test('fixture seed loads into the model', async () => {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'seed.json'), 'utf8'));
  const model = createPostModel(new JsonStore({ seed }));
  assert.equal((await model.list()).meta.total, 5);
  assert.equal((await model.list({ status: 'draft' })).meta.total, 1);
});

test('data/posts.json (your live data file) is valid', () => {
  // Checks structure only, so it keeps passing however many posts you add or delete.
  const posts = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'posts.json'), 'utf8'));
  assert.ok(Array.isArray(posts));
  const ids = new Set();
  for (const p of posts) {
    for (const key of ['id', 'title', 'slug', 'content', 'author', 'category', 'createdDate']) {
      assert.ok(p[key], `post is missing ${key}`);
    }
    assert.ok(!ids.has(p.id), 'duplicate id');
    ids.add(p.id);
  }
});

const { randomUUID } = require('node:crypto');
const { slugify, calcReadingTime } = require('../utils/helpers');

// "trash" and "stats" are real sub-routes, so no post may take them as a slug.
const RESERVED_SLUGS = ['trash', 'stats'];

/**
 * All business logic for posts lives here. Controllers stay thin and
 * the storage engine can be swapped without touching anything else.
 */
function createPostModel(store) {
  const live = (all) => all.filter((p) => !p.deletedAt);
  const matches = (p, ref) => p.id === ref || p.slug === ref;

  async function find(ref, { includeDeleted = false } = {}) {
    const all = await store.getAll();
    return all.find((p) => matches(p, ref) && (includeDeleted || !p.deletedAt)) || null;
  }

  function uniqueSlug(base, all) {
    const taken = new Set([...all.map((p) => p.slug), ...RESERVED_SLUGS]);
    let slug = base;
    let n = 2;
    while (taken.has(slug)) slug = `${base}-${n++}`;
    return slug;
  }

  async function create(data) {
    const all = await store.getAll();
    const now = new Date().toISOString();
    const post = {
      id: randomUUID(),
      title: data.title,
      slug: uniqueSlug(slugify(data.title), all), // stays stable even if the title is edited later
      content: data.content,
      author: data.author,
      category: data.category,
      tags: data.tags || [],
      status: data.status || 'published',
      readingTime: calcReadingTime(data.content),
      views: 0,
      likes: 0,
      createdDate: now,
      updatedDate: now,
      deletedAt: null,
    };
    all.push(post);
    await store.persist();
    return post;
  }

  async function list(query = {}) {
    const q = { sort: 'createdDate', order: 'desc', page: 1, limit: 50, ...query };
    let items = live(await store.getAll());

    if (q.status && q.status !== 'all') items = items.filter((p) => p.status === q.status);
    if (q.category) items = items.filter((p) => p.category.toLowerCase() === q.category.toLowerCase());
    if (q.author) items = items.filter((p) => p.author.toLowerCase() === q.author.toLowerCase());
    if (q.tag) items = items.filter((p) => p.tags.includes(q.tag.toLowerCase()));
    if (q.search) {
      // every word typed must appear somewhere in title/content/author/tags
      const words = q.search.toLowerCase().split(/\s+/).filter(Boolean);
      items = items.filter((p) => {
        const haystack = `${p.title} ${p.content} ${p.author} ${p.tags.join(' ')}`.toLowerCase();
        return words.every((w) => haystack.includes(w));
      });
    }

    const dir = q.order === 'asc' ? 1 : -1;
    items = [...items].sort((a, b) => {
      let x = a[q.sort];
      let y = b[q.sort];
      if (typeof x === 'string') {
        x = x.toLowerCase();
        y = y.toLowerCase();
      }
      if (x < y) return -1 * dir;
      if (x > y) return 1 * dir;
      return 0;
    });

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / q.limit));
    const start = (q.page - 1) * q.limit;
    return {
      items: items.slice(start, start + q.limit),
      meta: { total, page: q.page, limit: q.limit, totalPages, hasNext: q.page < totalPages, hasPrev: q.page > 1 },
    };
  }

  async function update(ref, changes) {
    const post = await find(ref);
    if (!post) return null;
    Object.assign(post, changes);
    if (changes.content !== undefined) post.readingTime = calcReadingTime(post.content);
    post.updatedDate = new Date().toISOString();
    await store.persist();
    return post;
  }

  /** Reading a post counts as a view. */
  async function view(ref) {
    const post = await find(ref);
    if (!post) return null;
    post.views += 1;
    await store.persist();
    return post;
  }

  async function like(ref) {
    const post = await find(ref);
    if (!post) return null;
    post.likes += 1;
    await store.persist();
    return post;
  }

  async function softDelete(ref) {
    const post = await find(ref);
    if (!post) return null;
    post.deletedAt = new Date().toISOString();
    await store.persist();
    return post;
  }

  async function restore(ref) {
    const post = await find(ref, { includeDeleted: true });
    if (!post || !post.deletedAt) return null;
    post.deletedAt = null;
    post.updatedDate = new Date().toISOString();
    await store.persist();
    return post;
  }

  async function hardDelete(ref) {
    const all = await store.getAll();
    const index = all.findIndex((p) => matches(p, ref));
    if (index === -1) return null;
    const [removed] = all.splice(index, 1);
    await store.persist();
    return removed;
  }

  async function listTrash() {
    const all = await store.getAll();
    return all.filter((p) => p.deletedAt).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }

  async function stats() {
    const all = await store.getAll();
    const posts = live(all);
    const countBy = (fn) =>
      posts.reduce((acc, p) => {
        [].concat(fn(p)).forEach((k) => (acc[k] = (acc[k] || 0) + 1));
        return acc;
      }, {});
    const top = (obj, n, label) =>
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, n)
        .map(([name, count]) => ({ [label]: name, count }));

    return {
      totalPosts: posts.length,
      published: posts.filter((p) => p.status === 'published').length,
      drafts: posts.filter((p) => p.status === 'draft').length,
      inTrash: all.length - posts.length,
      totalViews: posts.reduce((s, p) => s + p.views, 0),
      totalLikes: posts.reduce((s, p) => s + p.likes, 0),
      averageReadingTime: posts.length
        ? Number((posts.reduce((s, p) => s + p.readingTime, 0) / posts.length).toFixed(1))
        : 0,
      categories: countBy((p) => p.category),
      topTags: top(countBy((p) => p.tags), 5, 'tag'),
      topAuthors: top(countBy((p) => p.author), 5, 'author'),
      mostViewed: [...posts]
        .sort((a, b) => b.views - a.views)
        .slice(0, 3)
        .map((p) => ({ id: p.id, title: p.title, views: p.views })),
    };
  }

  return { create, list, find, update, view, like, softDelete, restore, hardDelete, listTrash, stats };
}

module.exports = { createPostModel, RESERVED_SLUGS };

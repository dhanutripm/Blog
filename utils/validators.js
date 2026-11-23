/**
 * Pure validation functions (no Express inside) so they are easy to unit-test.
 * Each returns { errors: [{field, message}], value } – value is null if invalid.
 */

const STRING_RULES = {
  title: { min: 3, max: 150 },
  content: { min: 10, max: 20000 },
  author: { min: 2, max: 60 },
  category: { min: 2, max: 40 },
};
const ALLOWED_FIELDS = [...Object.keys(STRING_RULES), 'tags', 'status'];
const STATUSES = ['draft', 'published'];
const SORT_FIELDS = ['createdDate', 'updatedDate', 'title', 'views', 'likes'];
const MAX_TAGS = 8;

/** Reference used in /posts/:id – a UUID or a slug. */
const REF_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

function validatePostInput(body, { partial = false } = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: [{ field: 'body', message: 'Request body must be a JSON object' }], value: null };
  }

  const errors = [];
  const input = { ...body };

  // Friendly alias: the brief says "Author Name", so accept authorName too.
  if (input.authorName !== undefined && input.author === undefined) input.author = input.authorName;
  delete input.authorName;

  for (const key of Object.keys(input)) {
    if (!ALLOWED_FIELDS.includes(key)) {
      errors.push({ field: key, message: `'${key}' is not a recognised field` });
    }
  }

  const value = {};

  for (const [field, { min, max }] of Object.entries(STRING_RULES)) {
    const raw = input[field];
    if (raw === undefined) {
      if (!partial) errors.push({ field, message: `${field} is required` });
      continue;
    }
    if (typeof raw !== 'string') {
      errors.push({ field, message: `${field} must be a string` });
      continue;
    }
    const trimmed = raw.trim();
    if (trimmed.length < min || trimmed.length > max) {
      errors.push({ field, message: `${field} must be between ${min} and ${max} characters` });
      continue;
    }
    value[field] = trimmed;
  }

  // tags (optional array of short, lower-cased, de-duplicated strings)
  if (input.tags === undefined) {
    if (!partial) value.tags = [];
  } else if (!Array.isArray(input.tags)) {
    errors.push({ field: 'tags', message: 'tags must be an array of strings' });
  } else {
    const seen = new Set();
    const tags = [];
    let tagsOk = true;
    for (const t of input.tags) {
      if (typeof t !== 'string') {
        errors.push({ field: 'tags', message: 'every tag must be a string' });
        tagsOk = false;
        break;
      }
      const tag = t.trim().toLowerCase();
      if (tag.length < 2 || tag.length > 30) {
        errors.push({ field: 'tags', message: 'each tag must be 2-30 characters' });
        tagsOk = false;
        break;
      }
      if (!seen.has(tag)) {
        seen.add(tag);
        tags.push(tag);
      }
    }
    if (tagsOk && tags.length > MAX_TAGS) {
      errors.push({ field: 'tags', message: `a post can have at most ${MAX_TAGS} tags` });
    } else if (tagsOk) {
      value.tags = tags;
    }
  }

  // status
  if (input.status === undefined) {
    if (!partial) value.status = 'published';
  } else if (!STATUSES.includes(input.status)) {
    errors.push({ field: 'status', message: `status must be one of: ${STATUSES.join(', ')}` });
  } else {
    value.status = input.status;
  }

  if (partial && errors.length === 0 && Object.keys(value).length === 0) {
    errors.push({
      field: 'body',
      message: 'Provide at least one field to update: title, content, author, category, tags or status',
    });
  }

  return errors.length ? { errors, value: null } : { errors: [], value };
}

function parseListQuery(query = {}) {
  const errors = [];
  const v = {};

  const text = (name) => {
    const raw = query[name];
    if (raw === undefined) return;
    if (typeof raw !== 'string') return errors.push({ field: name, message: `${name} must be a single value` });
    const t = raw.trim();
    if (t.length > 100) return errors.push({ field: name, message: `${name} is too long (max 100 characters)` });
    if (t) v[name] = t;
  };
  ['search', 'category', 'author', 'tag'].forEach(text);

  const int = (name, def, min, max) => {
    const raw = query[name];
    if (raw === undefined) {
      v[name] = def;
      return;
    }
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
      return errors.push({ field: name, message: `${name} must be a whole number` });
    }
    const n = Number(raw);
    if (n < min || n > max) return errors.push({ field: name, message: `${name} must be between ${min} and ${max}` });
    v[name] = n;
  };
  int('page', 1, 1, 1_000_000);
  int('limit', 50, 1, 100);

  const oneOf = (name, list, def) => {
    const raw = query[name];
    if (raw === undefined) {
      if (def !== undefined) v[name] = def;
      return;
    }
    if (!list.includes(raw)) errors.push({ field: name, message: `${name} must be one of: ${list.join(', ')}` });
    else v[name] = raw;
  };
  oneOf('sort', SORT_FIELDS, 'createdDate');
  oneOf('order', ['asc', 'desc'], 'desc');
  oneOf('status', [...STATUSES, 'all']);

  return errors.length ? { errors, value: null } : { errors: [], value: v };
}

function isValidRef(ref) {
  return typeof ref === 'string' && ref.length <= 100 && REF_PATTERN.test(ref);
}

module.exports = { validatePostInput, parseListQuery, isValidRef, STATUSES, SORT_FIELDS };

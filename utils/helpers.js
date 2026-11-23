/** Small, dependency-free helpers shared across the project. */

/** "Hello, World! 2026" -> "hello-world-2026" */
function slugify(text) {
  const slug = String(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || 'post'; // titles in non-Latin scripts fall back to "post"
}

function countWords(text) {
  return (String(text).trim().match(/\S+/g) || []).length;
}

/** Estimated minutes to read, at ~200 words per minute (minimum 1). */
function calcReadingTime(text) {
  return Math.max(1, Math.ceil(countWords(text) / 200));
}

/** Lets async route handlers throw without try/catch – errors go to next(). */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** One consistent success envelope for every endpoint. */
function sendSuccess(res, status, message, data = null, meta = null) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

module.exports = { slugify, countWords, calcReadingTime, asyncHandler, sendSuccess };

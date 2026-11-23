const crypto = require('node:crypto');
const AppError = require('../utils/AppError');

/**
 * Optional protection for write routes.
 * If API_KEY is not configured the guard does nothing (handy while learning).
 * If it is configured, callers must send:  x-api-key: <key>
 */
function apiKeyGuard(expectedKey) {
  return function guard(req, res, next) {
    if (!expectedKey) return next();
    const given = Buffer.from(String(req.get('x-api-key') || ''));
    const expected = Buffer.from(expectedKey);
    const ok = given.length === expected.length && crypto.timingSafeEqual(given, expected);
    if (!ok) return next(new AppError('Missing or invalid API key (send it in the x-api-key header)', 401));
    next();
  };
}

module.exports = apiKeyGuard;

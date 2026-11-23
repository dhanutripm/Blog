const { randomUUID } = require('node:crypto');

/** Gives every request a short id (also returned in the X-Request-Id header). */
function requestId(req, res, next) {
  req.id = randomUUID().slice(0, 8);
  res.setHeader('X-Request-Id', req.id);
  next();
}

/** Logs: [time] id METHOD url -> status (ms) */
function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`[${new Date().toISOString()}] ${req.id} ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms.toFixed(1)}ms)`);
  });
  next();
}

module.exports = { requestId, requestLogger };

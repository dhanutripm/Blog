const AppError = require('../utils/AppError');

/** Central error handler – every failure leaves the API in the same JSON shape. */
// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = 500;
  let message = 'Internal server error';
  let details = null;

  if (err instanceof AppError) {
    status = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON in request body';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large (limit 100kb)';
  }

  if (status === 500) console.error(`[${req.id}]`, err);

  const body = { success: false, message, requestId: req.id };
  if (details) body.errors = details;
  if (status === 500 && process.env.NODE_ENV === 'development') body.stack = err.stack;
  res.status(status).json(body);
};

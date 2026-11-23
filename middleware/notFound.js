const AppError = require('../utils/AppError');

/** Anything that reached this point matched no route. */
module.exports = function notFound(req, res, next) {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404));
};

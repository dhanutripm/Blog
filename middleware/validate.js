const AppError = require('../utils/AppError');
const { validatePostInput, parseListQuery, isValidRef } = require('../utils/validators');

/** POST /posts – every required field must be present and valid. */
function validateCreate(req, res, next) {
  const { errors, value } = validatePostInput(req.body ?? {}, { partial: false });
  if (errors.length) return next(new AppError('Validation failed', 400, errors));
  req.validated = value;
  next();
}

/** PUT/PATCH /posts/:id – any subset of fields, but at least one. */
function validateUpdate(req, res, next) {
  const { errors, value } = validatePostInput(req.body ?? {}, { partial: true });
  if (errors.length) return next(new AppError('Validation failed', 400, errors));
  req.validated = value;
  next();
}

/** GET /posts – checks page, limit, sort, order, status and filters. */
function validateListQuery(req, res, next) {
  const { errors, value } = parseListQuery(req.query);
  if (errors.length) return next(new AppError('Invalid query parameters', 400, errors));
  req.listQuery = value;
  next();
}

/** :id must look like a UUID or a slug. */
function validateIdParam(req, res, next) {
  if (!isValidRef(req.params.id)) {
    return next(new AppError('Invalid post id. Use the post UUID or its slug.', 400));
  }
  next();
}

module.exports = { validateCreate, validateUpdate, validateListQuery, validateIdParam };

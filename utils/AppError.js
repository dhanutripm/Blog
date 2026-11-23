/**
 * AppError – an "expected" error that carries an HTTP status code.
 * Throw it anywhere; the central error handler turns it into a JSON response.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details; // e.g. a list of field-level validation errors
  }
}

module.exports = AppError;

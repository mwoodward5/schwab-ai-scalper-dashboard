/**
 * Global error handling middleware and APIError class.
 *
 * Usage:
 *  - Throw new APIError(message, statusCode, details) in routes/services
 *  - Register errorHandler LAST in the middleware chain
 */
const logger = require('../utils/logger');

/**
 * Custom Error class for API errors
 */
class APIError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'APIError';
  }
}

/**
 * Global error handler middleware
 * Catches all errors and sends appropriate response
 */
const errorHandler = (err, req, res, next) => {
  // Log error details
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode || 500,
    path: req.path,
    method: req.method,
    body: req.body,
    details: err.details,
  });

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Prepare error response
  const errorResponse = {
    success: false,
    error: err.message || 'Internal Server Error',
  };
  if (process.env.NODE_ENV !== 'production' && err.details) {
    errorResponse.details = err.details;
  }

  res.status(statusCode).json(errorResponse);
};

module.exports = { errorHandler, APIError };

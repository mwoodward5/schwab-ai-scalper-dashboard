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
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  };

  // Include additional details in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err.details;
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    errorResponse.error = 'Validation Error';
    errorResponse.validationErrors = err.details;
  } else if (err.name === 'UnauthorizedError') {
    errorResponse.error = 'Authentication required';
  } else if (err.code === 'ECONNREFUSED') {
    errorResponse.error = 'Unable to connect to external service';
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 handler for routes that don't exist
 */
const notFoundHandler = (req, res, next) => {
  const error = new APIError(`Route not found: ${req.originalUrl}`, 404);
  next(error);
};

/**
 * Async route wrapper to catch promise rejections
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  APIError,
};

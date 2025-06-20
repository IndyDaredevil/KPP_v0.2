import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Joi validation error
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  // Supabase/Database errors
  if (err.code === '23505') { // Unique constraint violation
    return res.status(409).json({
      success: false,
      message: 'Resource already exists'
    });
  }

  if (err.code === '23503') { // Foreign key constraint violation
    return res.status(400).json({
      success: false,
      message: 'Invalid reference to related resource'
    });
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
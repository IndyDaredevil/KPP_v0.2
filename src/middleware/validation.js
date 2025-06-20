import { body, param, query, validationResult } from 'express-validator';

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  
  next();
};

// Validation rules for different endpoints
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  validateRequest
];

export const validateListingId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid listing ID - must be a positive integer'),
  validateRequest
];

export const validateCreateListing = [
  body('ticker')
    .isString()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Ticker must be 1-20 characters'),
  body('token_id')
    .isInt({ min: 1 })
    .toInt()
    .withMessage('Token ID must be a positive integer'),
  body('total_price')
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage('Total price must be a positive number'),
  body('seller_wallet_address')
    .isString()
    .trim()
    .matches(/^kaspa:/)
    .withMessage('Invalid Kaspa wallet address format'),
  validateRequest
];

export const validateUserRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  validateRequest
];

export const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required'),
  validateRequest
];
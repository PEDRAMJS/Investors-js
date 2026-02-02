const { body, param, query } = require('express-validator');
const constants = require('../../config/constants');

const customerValidation = {
  // Create/update customer validation
  createUpdateCustomer: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters'),
    
    body('budget')
      .optional()
      .isInt({ min: 0 }).withMessage('Budget must be a positive integer')
      .toInt(),
    
    body('contact')
      .optional()
      .isLength({ max: 500 }).withMessage('Contact info must not exceed 500 characters'),
    
    body('isLocal')
      .optional()
      .isIn(['yes', 'no']).withMessage('isLocal must be either "yes" or "no"'),
    
    body('demands')
      .optional()
      .isLength({ max: 1000 }).withMessage('Demands must not exceed 1000 characters'),
    
    body('previousDeal')
      .optional()
      .isIn(['rejected', 'successful']).withMessage('previousDeal must be either "rejected" or "successful"'),
    
    body('notes')
      .optional()
      .isLength({ max: 2000 }).withMessage('Notes must not exceed 2000 characters'),
    
    body('estate_type')
      .optional()
      .isLength({ max: 255 }).withMessage('Estate type must not exceed 255 characters')
  ],

  // Customer ID validation
  validateCustomerId: [
    param('id')
      .isInt({ min: 1 }).withMessage('Customer ID must be a positive integer')
      .toInt()
  ],

  // Search validation
  validateSearch: [
    query('q')
      .optional()
      .trim()
      .isLength({ min: 2 }).withMessage('Search term must be at least 2 characters')
      .isLength({ max: 100 }).withMessage('Search term must not exceed 100 characters')
  ],

  // Filter validation
  validateFilters: [
    query('deal_status')
      .optional()
      .isIn(['rejected', 'successful']).withMessage('Deal status must be either "rejected" or "successful"'),
    
    query('is_local')
      .optional()
      .isIn(['yes', 'no']).withMessage('is_local must be either "yes" or "no"'),
    
    query('estate_type')
      .optional()
      .isLength({ max: 255 }).withMessage('Estate type must not exceed 255 characters'),
    
    query('min_budget')
      .optional()
      .isInt({ min: 0 }).withMessage('Minimum budget must be a positive integer')
      .toInt(),
    
    query('max_budget')
      .optional()
      .isInt({ min: 0 }).withMessage('Maximum budget must be a positive integer')
      .toInt()
      .custom((value, { req }) => {
        if (req.query.min_budget && value < req.query.min_budget) {
          throw new Error('Maximum budget must be greater than or equal to minimum budget');
        }
        return true;
      }),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
      .toInt(),
    
    query('offset')
      .optional()
      .isInt({ min: 0 }).withMessage('Offset must be a positive integer')
      .toInt()
  ]
};

module.exports = customerValidation;
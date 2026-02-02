const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const customerValidation = require('../middleware/validation/customerValidation');
const { protect } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(protect);

// Customer CRUD routes
router.post(
  '/',
  customerValidation.createUpdateCustomer,
  customerController.createCustomer
);

router.get(
  '/',
  customerValidation.validateFilters,
  customerController.getCustomers
);

router.get(
  '/search',
  customerValidation.validateSearch,
  customerController.searchCustomers
);

router.get(
  '/stats',
  customerController.getCustomerStats
);

router.get(
  '/export',
  customerController.exportCustomers
);

router.get(
  '/:id',
  customerValidation.validateCustomerId,
  customerController.getCustomer
);

router.put(
  '/:id',
  customerValidation.validateCustomerId,
  customerValidation.createUpdateCustomer,
  customerController.updateCustomer
);

router.delete(
  '/:id',
  customerValidation.validateCustomerId,
  customerController.deleteCustomer
);

// Deal status routes
router.patch(
  '/:id/mark-successful',
  customerValidation.validateCustomerId,
  customerController.markDealSuccessful
);

router.patch(
  '/:id/mark-rejected',
  customerValidation.validateCustomerId,
  customerController.markDealRejected
);

module.exports = router;
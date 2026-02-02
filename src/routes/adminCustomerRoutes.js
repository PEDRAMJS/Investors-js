const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { adminOnly } = require('../middleware/auth');

// Admin-only customer routes
router.get(
  '/',
  adminOnly,
  customerController.getAllCustomers
);

module.exports = router;
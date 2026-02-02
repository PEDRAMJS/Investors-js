const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {uploadSingle} = require('../config/upload');

// Public routes
router.post('/register', uploadSingle('id_photo'), authController.register);
router.post('/login', authController.login);

// Protected routes
router.get('/me', protect, authController.getProfile);
router.post('/change-password', protect, authController.changePassword);

module.exports = router;
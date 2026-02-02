const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * Simple token verification middleware
 */
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

/**
 * Check if user is approved (simplified)
 */
const checkApproved = (req, res, next) => {
  if (!req.user.approved) {
    return res.status(403).json({ 
      error: 'Account pending approval. Please wait for admin approval.' 
    });
  }
  next();
};

/**
 * Check if user is admin (simplified)
 */
const checkAdmin = async (req, res, next) => {
  try {
    const [results] = await db.promise().query(
      'SELECT is_admin FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (results.length === 0 || !results[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
};

/**
 * Combined middleware for protected routes
 */
const protect = [verifyToken, checkApproved];

/**
 * Admin only middleware
 */
const adminOnly = [verifyToken, checkApproved, checkAdmin];

/**
 * Check ownership or admin access
 */
const checkOwnershipOrAdmin = (table) => async (req, res, next) => {
  try {
    // Admins can access anything
    const [adminCheck] = await db.promise().query(
      'SELECT is_admin FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (adminCheck[0]?.is_admin) {
      return next();
    }
    
    // Regular users can only access their own data
    const [results] = await db.promise().query(
      `SELECT user_id FROM ${table} WHERE id = ?`,
      [req.params.id]
    );
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    if (results[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
};

module.exports = {
  verifyToken,
  checkApproved,
  checkAdmin,
  protect,
  adminOnly,
  checkOwnershipOrAdmin
};
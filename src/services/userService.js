const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fileService = require('./fileService');

class UserService {
  /**
   * Register a new user
   */
  async registerUser(userData, idPhotoFile = null) {
    try {
      // Handle ID photo if provided
      let idPhotoPath = null;
      
      if (idPhotoFile) {
        const validation = fileService.validateFile(idPhotoFile, {
          allowedTypes: /jpeg|jpg|png|gif|bmp|webp/i,
          maxSize: 2 * 1024 * 1024 // 2MB
        });

        if (!validation.valid) {
          throw new Error(validation.error);
        }

        const saveResult = await fileService.saveUploadedFile(idPhotoFile, 'id-photos');
        if (!saveResult.success) {
          throw new Error(saveResult.error);
        }

        idPhotoPath = saveResult.file.relativePath;
      }

      // Create user instance
      const user = new User({
        ...userData,
        id_photo_path: idPhotoPath,
        approved: 1 // Auto-approve for now (can be changed to 0 for admin approval)
      });

      // Validate and save
      await user.save();
      
      // Generate JWT token
      const token = this.generateToken(user);
      
      return {
        success: true,
        user: user.toJSON(),
        token,
        message: 'User registered successfully'
      };
    } catch (error) {
      // Clean up uploaded file if registration failed
      if (idPhotoFile && idPhotoFile.path) {
        await fileService.deleteFile(idPhotoFile.path);
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Login user
   */
  async loginUser(username, password) {
    try {
      // Find user by username
      const user = await User.findByField('name', username);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check password
      const validPassword = await user.comparePassword(password);
      if (!validPassword) {
        throw new Error('Invalid credentials');
      }

      // Check if user is approved
      if (!user.approved) {
        throw new Error('Account pending approval. Please wait for admin approval.');
      }

      // Generate JWT token
      const token = this.generateToken(user);
      
      return {
        success: true,
        user: user.toJSON(),
        token,
        message: 'Login successful'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return {
        success: true,
        user: user.toJSON()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId, userData) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update allowed fields
      const allowedFields = ['name', 'phone_number', 'date_of_birth', 'fathers_name', 'primary_residence'];
      
      allowedFields.forEach(field => {
        if (userData[field] !== undefined) {
          user[field] = userData[field];
        }
      });

      await user.save();
      
      return {
        success: true,
        user: user.toJSON(),
        message: 'Profile updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Change password
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const validPassword = await user.comparePassword(currentPassword);
      if (!validPassword) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      user.password = newPassword;
      await user.save();
      
      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(filters = {}) {
    try {
      const users = await User.findAll(filters);
      
      return {
        success: true,
        users: users.map(user => user.toJSON()),
        count: users.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user by ID (admin only)
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return {
        success: true,
        user: user.toAdminJSON() // Includes sensitive info for admin
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get pending users (admin only)
   */
  async getPendingUsers() {
    try {
      const users = await User.getPendingUsers();
      
      return {
        success: true,
        users: users.map(user => user.toAdminJSON()),
        count: users.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Approve user (admin only)
   */
  async approveUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await user.approve();
      
      return {
        success: true,
        user: user.toJSON(),
        message: 'User approved successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Reject user (admin only - deletes user)
   */
  async rejectUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Delete ID photo file if exists
      if (user.id_photo_path) {
        await fileService.deleteFile(user.id_photo_path);
      }

      // Delete user from database
      await user.delete();
      
      return {
        success: true,
        message: 'User rejected and removed successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Promote user to admin (admin only)
   */
  async promoteToAdmin(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await user.promoteToAdmin();
      
      return {
        success: true,
        user: user.toJSON(),
        message: 'User promoted to admin successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Demote admin to user (admin only)
   */
  async demoteFromAdmin(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await user.demoteFromAdmin();
      
      return {
        success: true,
        user: user.toJSON(),
        message: 'User demoted from admin successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user statistics
   */
  async getUserStatistics() {
    try {
      const totalUsers = await User.count();
      const approvedUsers = await User.count({ approved: 1 });
      const pendingUsers = await User.count({ approved: 0 });
      const adminUsers = await User.count({ is_admin: 1 });
      
      // Get recent users (last 30 days)
      const db = require('../config/database');
      const recentUsers = await db.query(`
        SELECT COUNT(*) as count, 
               DATE(created_at) as date 
        FROM users 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);
      
      return {
        success: true,
        statistics: {
          total: totalUsers,
          approved: approvedUsers,
          pending: pendingUsers,
          admins: adminUsers,
          regular_users: totalUsers - adminUsers,
          approval_rate: totalUsers > 0 ? (approvedUsers / totalUsers * 100).toFixed(2) + '%' : '0%',
          recent_signups: recentUsers
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search users
   */
  async searchUsers(searchTerm) {
    try {
      const users = await User.findAll({ search: searchTerm });
      
      return {
        success: true,
        users: users.map(user => user.toJSON()),
        count: users.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate JWT token
   */
  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        name: user.name,
        approved: user.approved,
        is_admin: user.is_admin || false
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if user exists by field
   */
  async userExists(field, value) {
    try {
      const user = await User.findByField(field, value);
      return user !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update user's ID photo
   */
  async updateIdPhoto(userId, idPhotoFile) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate new ID photo
      const validation = fileService.validateFile(idPhotoFile, {
        allowedTypes: /jpeg|jpg|png|gif|bmp|webp/i,
        maxSize: 2 * 1024 * 1024 // 2MB
      });

      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Delete old ID photo if exists
      if (user.id_photo_path) {
        await fileService.deleteFile(user.id_photo_path);
      }

      // Save new ID photo
      const saveResult = await fileService.saveUploadedFile(idPhotoFile, 'id-photos');
      if (!saveResult.success) {
        throw new Error(saveResult.error);
      }

      // Update user with new photo path
      user.id_photo_path = saveResult.file.relativePath;
      await user.save();
      
      return {
        success: true,
        user: user.toJSON(),
        message: 'ID photo updated successfully'
      };
    } catch (error) {
      // Clean up uploaded file if update failed
      if (idPhotoFile && idPhotoFile.path) {
        await fileService.deleteFile(idPhotoFile.path);
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
module.exports = new UserService();
const User = require('../models/User');
const Customer = require('../models/Customer');
const Estate = require('../models/Estate');
const Map = require('../models/Map');
const fileService = require('./fileService');

class AdminService {
  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    try {
      // Get user statistics
      const totalUsers = await User.count();
      const approvedUsers = await User.count({ approved: 1 });
      const pendingUsers = await User.count({ approved: 0 });
      const adminUsers = await User.count({ is_admin: 1 });

      // Get customer statistics
      const totalCustomers = await Customer.getStatistics();
      
      // Get estate statistics
      const totalEstates = await Estate.getStatistics();
      
      // Get map statistics
      const totalMaps = await Map.getStatistics();
      
      // Get storage statistics
      const storageStats = await fileService.getStorageStats();
      
      // Get recent activities
      const db = require('../config/database');
      const recentActivities = await db.query(`
        (
          SELECT 'user' as type, name as title, created_at as date 
          FROM users 
          ORDER BY created_at DESC 
          LIMIT 5
        )
        UNION ALL
        (
          SELECT 'customer' as type, name as title, created_at as date 
          FROM customers 
          ORDER BY created_at DESC 
          LIMIT 5
        )
        UNION ALL
        (
          SELECT 'estate' as type, project as title, created_at as date 
          FROM estates 
          ORDER BY created_at DESC 
          LIMIT 5
        )
        UNION ALL
        (
          SELECT 'map' as type, title, created_at as date 
          FROM maps 
          ORDER BY created_at DESC 
          LIMIT 5
        )
        ORDER BY date DESC 
        LIMIT 10
      `);

      return {
        success: true,
        stats: {
          users: {
            total: totalUsers,
            approved: approvedUsers,
            pending: pendingUsers,
            admins: adminUsers
          },
          customers: {
            total: totalCustomers.total || 0,
            successful: totalCustomers.successful || 0,
            rejected: totalCustomers.rejected || 0
          },
          estates: {
            total: totalEstates.total || 0,
            total_value: totalEstates.total_value || 0,
            avg_price: totalEstates.avg_price || 0
          },
          maps: {
            total: totalMaps.total_maps || 0,
            total_size: totalMaps.total_size || 0,
            uploaders: totalMaps.uploaders_count || 0
          },
          storage: storageStats.success ? storageStats.stats : null,
          recent_activities: recentActivities
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
   * Get system overview
   */
  async getSystemOverview() {
    try {
      const db = require('../config/database');
      
      // Get database size
      const dbSize = await db.query(`
        SELECT 
          table_schema as database_name,
          SUM(data_length + index_length) as size_bytes,
          ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size_mb
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
        GROUP BY table_schema
      `);

      // Get table row counts
      const tableStats = await db.query(`
        SELECT 
          table_name,
          table_rows as row_count,
          ROUND((data_length + index_length) / 1024 / 1024, 2) as size_mb
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
        ORDER BY table_rows DESC
      `);

      // Get active users (last 7 days)
      const activeUsers = await db.query(`
        SELECT COUNT(DISTINCT user_id) as active_users
        FROM (
          SELECT user_id FROM customers WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          UNION
          SELECT user_id FROM estates WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          UNION
          SELECT uploaded_by as user_id FROM maps WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_activities
      `);

      return {
        success: true,
        overview: {
          database_size: dbSize[0] || { size_mb: 0 },
          table_statistics: tableStats,
          active_users_last_7_days: activeUsers[0]?.active_users || 0,
          server_time: new Date().toISOString(),
          node_version: process.version,
          environment: process.env.NODE_ENV || 'development'
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
   * Get all data with pagination (for admin data export)
   */
  async getAllData(page = 1, limit = 50) {
    try {
      const offset = (page - 1) * limit;
      
      // Get all data with pagination
      const [users, customers, estates, maps] = await Promise.all([
        User.findAll({ limit, offset }),
        Customer.findAll({ limit, offset }),
        Estate.findAll({ limit, offset }),
        Map.findAll({ limit, offset })
      ]);

      // Get counts for pagination info
      const [userCount, customerCount, estateCount, mapCount] = await Promise.all([
        User.count(),
        Customer.getStatistics().then(s => s.total),
        Estate.getStatistics().then(s => s.total),
        Map.getStatistics().then(s => s.total_maps)
      ]);

      return {
        success: true,
        data: {
          users: users.map(u => u.toJSON()),
          customers: customers.map(c => c.toJSON()),
          estates: estates.map(e => e.toJSON()),
          maps: maps.map(m => m.toJSON())
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total_users: userCount,
          total_customers: customerCount,
          total_estates: estateCount,
          total_maps: mapCount,
          total_pages_users: Math.ceil(userCount / limit),
          total_pages_customers: Math.ceil(customerCount / limit),
          total_pages_estates: Math.ceil(estateCount / limit),
          total_pages_maps: Math.ceil(mapCount / limit)
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
   * Clean up orphaned files
   */
  async cleanupOrphanedFiles() {
    try {
      const models = {
        users: require('../models/User'),
        maps: require('../models/Map')
      };

      const cleanupResult = await fileService.cleanupOrphanedFiles(models);
      
      return {
        success: true,
        cleanup_result: cleanupResult,
        message: 'Cleanup completed'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user activity log
   */
  async getUserActivityLog(userId, days = 30) {
    try {
      const db = require('../config/database');
      
      const activityLog = await db.query(`
        SELECT 
          'customer_created' as action,
          c.name as target,
          c.created_at as timestamp,
          'Customer' as entity_type
        FROM customers c
        WHERE c.user_id = ? AND c.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        
        UNION ALL
        
        SELECT 
          'estate_created' as action,
          e.project as target,
          e.created_at as timestamp,
          'Estate' as entity_type
        FROM estates e
        WHERE e.user_id = ? AND e.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        
        UNION ALL
        
        SELECT 
          'map_uploaded' as action,
          m.title as target,
          m.created_at as timestamp,
          'Map' as entity_type
        FROM maps m
        WHERE m.uploaded_by = ? AND m.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        
        ORDER BY timestamp DESC
      `, [userId, days, userId, days, userId, days]);

      return {
        success: true,
        user_id: userId,
        period_days: days,
        activities: activityLog,
        total_activities: activityLog.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get system logs (placeholder for actual logging system)
   */
  async getSystemLogs(level = 'all', limit = 100) {
    try {
      // This is a placeholder. In production, you'd use a proper logging system
      // like Winston, Morgan, or read from a log file/database
      
      return {
        success: true,
        note: 'Logging system not implemented. Use Winston/Morgan for production.',
        placeholder_logs: [
          {
            level: 'info',
            message: 'System started successfully',
            timestamp: new Date().toISOString()
          },
          {
            level: 'info',
            message: 'Admin service initialized',
            timestamp: new Date().toISOString()
          }
        ]
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Backup database (placeholder)
   */
  async backupDatabase() {
    try {
      // This is a placeholder. In production, you'd implement actual backup
      // using mysqldump or similar tools
      
      return {
        success: true,
        note: 'Database backup not implemented. Use mysqldump for production backup.',
        backup_info: {
          timestamp: new Date().toISOString(),
          estimated_size: 'N/A',
          backup_method: 'Not implemented'
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
   * Send system notification to all users
   */
  async sendSystemNotification(notification) {
    try {
      const { title, message, type = 'info' } = notification;
      
      if (!title || !message) {
        throw new Error('Title and message are required');
      }

      // Get all active users
      const users = await User.findAll({ approved: 1 });
      
      // In production, you'd:
      // 1. Store notifications in database
      // 2. Send emails
      // 3. Send push notifications
      // 4. Use WebSocket for real-time updates
      
      return {
        success: true,
        notification: {
          title,
          message,
          type,
          sent_at: new Date().toISOString()
        },
        recipients_count: users.length,
        message: `Notification would be sent to ${users.length} users`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user roles and permissions overview
   */
  async getRolesAndPermissions() {
    try {
      const db = require('../config/database');
      
      const rolesStats = await db.query(`
        SELECT 
          role,
          COUNT(*) as user_count,
          GROUP_CONCAT(name ORDER BY name SEPARATOR ', ') as users
        FROM users
        WHERE approved = 1
        GROUP BY role
        ORDER BY user_count DESC
      `);

      return {
        success: true,
        roles: rolesStats,
        permissions_overview: {
          admin: ['All permissions', 'User management', 'Content management', 'System settings'],
          agent: ['Create customers', 'Create estates', 'View all estates', 'Upload maps'],
          user: ['Create customers', 'Create own estates', 'View own data']
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
   * Get audit trail for important actions
   */
  async getAuditTrail(days = 7) {
    try {
      const db = require('../config/database');
      
      // This would require an audit_log table in production
      // For now, we'll create a placeholder response
      
      return {
        success: true,
        note: 'Audit trail requires audit_log table implementation',
        placeholder: {
          message: 'Implement audit logging for critical actions',
          suggested_actions: [
            'User login/logout',
            'User approval/rejection',
            'Data deletion',
            'Admin actions',
            'Password changes'
          ]
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
module.exports = new AdminService();
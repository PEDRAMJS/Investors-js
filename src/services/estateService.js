const Estate = require('../models/Estate');
const User = require('../models/User');

class EstateService {
  /**
   * Create a new estate
   */
  async createEstate(estateData, userId) {
    try {
      // Create estate instance
      const estate = new Estate({
        ...estateData,
        user_id: userId
      });

      // Validate and save
      await estate.save();
      
      return {
        success: true,
        estate: estate.toJSON(),
        message: 'Estate created successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update estate
   */
  async updateEstate(estateId, estateData, userId) {
    try {
      // Get existing estate
      const estate = await Estate.findById(estateId);
      if (!estate) {
        throw new Error('Estate not found');
      }

      // Check ownership (unless admin)
      const user = await User.findById(userId);
      if (!user.is_admin && estate.user_id !== userId) {
        throw new Error('Access denied');
      }

      // Update estate data
      Object.assign(estate, estateData);
      await estate.save();
      
      return {
        success: true,
        estate: estate.toJSON(),
        message: 'Estate updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete estate
   */
  async deleteEstate(estateId, userId) {
    try {
      // Get existing estate
      const estate = await Estate.findById(estateId);
      if (!estate) {
        throw new Error('Estate not found');
      }

      // Check ownership (unless admin)
      const user = await User.findById(userId);
      if (!user.is_admin && estate.user_id !== userId) {
        throw new Error('Access denied');
      }

      await estate.delete();
      
      return {
        success: true,
        message: 'Estate deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get estate by ID
   */
  async getEstateById(estateId, userId) {
    try {
      const estate = await Estate.findById(estateId);
      if (!estate) {
        throw new Error('Estate not found');
      }

      // Check ownership for phone number visibility
      const user = await User.findById(userId);
      if (!user.is_admin && estate.user_id !== userId) {
        estate.sanitizePhoneNumber(userId);
      }

      return {
        success: true,
        estate: estate.toJSON()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all estates for a user
   */
  async getUserEstates(userId, filters = {}) {
    try {
      const estates = await Estate.findByUserId(userId, filters);
      
      return {
        success: true,
        estates: estates.map(e => e.toJSON()),
        count: estates.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all estates with optional filters
   */
  async getAllEstates(filters = {}, userId = null) {
    try {
      const estates = await Estate.findAll(filters);
      
      // Sanitize phone numbers for non-owners/non-admins
      if (userId) {
        const user = await User.findById(userId);
        estates.forEach(estate => {
          if (!user.is_admin && estate.user_id !== userId) {
            estate.sanitizePhoneNumber(userId);
          }
        });
      }
      
      return {
        success: true,
        estates: estates.map(e => e.toJSON()),
        count: estates.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get estate statistics
   */
  async getEstateStatistics(userId = null) {
    try {
      const stats = await Estate.getStatistics(userId);
      
      return {
        success: true,
        statistics: stats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search estates
   */
  async searchEstates(searchTerm, filters = {}, userId = null) {
    try {
      filters.search = searchTerm;
      const estates = await Estate.findAll(filters);
      
      // Sanitize phone numbers for non-owners/non-admins
      if (userId) {
        const user = await User.findById(userId);
        estates.forEach(estate => {
          if (!user.is_admin && estate.user_id !== userId) {
            estate.sanitizePhoneNumber(userId);
          }
        });
      }
      
      return {
        success: true,
        estates: estates.map(e => e.toJSON()),
        count: estates.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get similar estates
   */
  async getSimilarEstates(estateId, limit = 5) {
    try {
      const estate = await Estate.findById(estateId);
      if (!estate) {
        throw new Error('Estate not found');
      }

      const similarEstates = await estate.getSimilar(limit);
      
      return {
        success: true,
        similarEstates: similarEstates.map(e => e.toJSON()),
        count: similarEstates.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search estates by features
   */
  async searchByFeatures(features = {}, userId = null) {
    try {
      const estates = await Estate.searchByFeatures(features);
      
      // Sanitize phone numbers for non-owners/non-admins
      if (userId) {
        const user = await User.findById(userId);
        estates.forEach(estate => {
          if (!user.is_admin && estate.user_id !== userId) {
            estate.sanitizePhoneNumber(userId);
          }
        });
      }
      
      return {
        success: true,
        estates: estates.map(e => e.toJSON()),
        count: estates.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get estates by price range
   */
  async getEstatesByPriceRange(minPrice, maxPrice, userId = null) {
    try {
      const estates = await Estate.findAll({
        min_price: minPrice,
        max_price: maxPrice
      });
      
      // Sanitize phone numbers for non-owners/non-admins
      if (userId) {
        const user = await User.findById(userId);
        estates.forEach(estate => {
          if (!user.is_admin && estate.user_id !== userId) {
            estate.sanitizePhoneNumber(userId);
          }
        });
      }
      
      return {
        success: true,
        estates: estates.map(e => e.toJSON()),
        count: estates.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get estates grouped by project
   */
  async getEstatesByProject(projectName, userId = null) {
    try {
      const estates = await Estate.findAll({ project: projectName });
      
      // Sanitize phone numbers for non-owners/non-admins
      if (userId) {
        const user = await User.findById(userId);
        estates.forEach(estate => {
          if (!user.is_admin && estate.user_id !== userId) {
            estate.sanitizePhoneNumber(userId);
          }
        });
      }
      
      return {
        success: true,
        project: projectName,
        estates: estates.map(e => e.toJSON()),
        count: estates.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get available estate types
   */
  async getAvailableEstateTypes() {
    try {
      const query = `
        SELECT DISTINCT estate_type, COUNT(*) as count
        FROM estates
        GROUP BY estate_type
        ORDER BY estate_type
      `;
      
      const db = require('../config/database');
      const types = await db.query(query);
      
      return {
        success: true,
        types: types
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get available projects
   */
  async getAvailableProjects() {
    try {
      const query = `
        SELECT DISTINCT project, COUNT(*) as count
        FROM estates
        GROUP BY project
        ORDER BY project
      `;
      
      const db = require('../config/database');
      const projects = await db.query(query);
      
      return {
        success: true,
        projects: projects
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
module.exports = new EstateService();
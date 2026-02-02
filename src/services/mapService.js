const Map = require('../models/Map');
const User = require('../models/User');
const fileService = require('./fileService');

class MapService {
  /**
   * Upload and create a new map
   */
  async uploadMap(file, mapData, userId) {
    try {
      // Validate file
      const validation = fileService.validateFile(file, {
        allowedTypes: /jpeg|jpg|png|gif|bmp|webp|pdf|zip|rar/i,
        maxSize: 5 * 1024 * 1024 // 5MB
      });

      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Get user info for uploaded_by_name
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Save file and get file info
      const saveResult = await fileService.saveUploadedFile(file, 'maps');
      if (!saveResult.success) {
        throw new Error(saveResult.error);
      }

      // Create map instance
      const map = new Map({
        title: mapData.title,
        description: mapData.description || '',
        file_path: saveResult.file.relativePath,
        file_type: file.mimetype,
        file_size: file.size,
        uploaded_by: userId,
        uploaded_by_name: user.name
      });

      // Save to database
      await map.save();
      
      return {
        success: true,
        map: map.toJSON(),
        message: 'Map uploaded successfully'
      };
    } catch (error) {
      // Clean up uploaded file if database save failed
      if (file && file.path) {
        await fileService.deleteFile(file.path);
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update map (title and description only)
   */
  async updateMap(mapId, mapData, userId) {
    try {
      // Get existing map
      const map = await Map.findById(mapId);
      if (!map) {
        throw new Error('Map not found');
      }

      // Check if user is admin (only admins can update maps)
      const user = await User.findById(userId);
      if (!user.is_admin) {
        throw new Error('Admin access required');
      }

      // Update only allowed fields
      if (mapData.title !== undefined) {
        map.title = mapData.title;
      }
      
      if (mapData.description !== undefined) {
        map.description = mapData.description;
      }

      await map.save();
      
      return {
        success: true,
        map: map.toJSON(),
        message: 'Map updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete map
   */
  async deleteMap(mapId, userId) {
    try {
      // Get existing map
      const map = await Map.findById(mapId);
      if (!map) {
        throw new Error('Map not found');
      }

      // Check if user is admin (only admins can delete maps)
      const user = await User.findById(userId);
      if (!user.is_admin) {
        throw new Error('Admin access required');
      }

      // Delete map and its file
      await map.delete();
      
      return {
        success: true,
        message: 'Map deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get map by ID
   */
  async getMapById(mapId) {
    try {
      const map = await Map.findById(mapId);
      if (!map) {
        throw new Error('Map not found');
      }

      // Check if file exists
      const fileExists = await map.fileExists();
      
      return {
        success: true,
        map: map.toJSON(),
        file_exists: fileExists
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all maps
   */
  async getAllMaps(filters = {}) {
    try {
      const maps = await Map.findAll(filters);
      
      // Check file existence for each map
      const mapsWithFileInfo = await Promise.all(
        maps.map(async (map) => {
          const fileExists = await map.fileExists();
          const mapJSON = map.toJSON();
          mapJSON.file_exists = fileExists;
          return mapJSON;
        })
      );
      
      return {
        success: true,
        maps: mapsWithFileInfo,
        count: maps.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get maps by uploader
   */
  async getMapsByUploader(userId) {
    try {
      const maps = await Map.findByUploader(userId);
      
      return {
        success: true,
        maps: maps.map(map => map.toJSON()),
        count: maps.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get map statistics
   */
  async getMapStatistics() {
    try {
      const stats = await Map.getStatistics();
      
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
   * Search maps by title or description
   */
  async searchMaps(searchTerm) {
    try {
      const maps = await Map.findAll({ search: searchTerm });
      
      return {
        success: true,
        maps: maps.map(map => map.toJSON()),
        count: maps.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get maps by file type
   */
  async getMapsByFileType(fileType) {
    try {
      let typeFilter;
      
      switch (fileType) {
        case 'images':
          typeFilter = 'image/%';
          break;
        case 'pdf':
          typeFilter = 'application/pdf';
          break;
        case 'archives':
          typeFilter = 'application/%';
          break;
        default:
          typeFilter = `%${fileType}%`;
      }
      
      const maps = await Map.findAll({ file_type: typeFilter });
      
      return {
        success: true,
        file_type: fileType,
        maps: maps.map(map => map.toJSON()),
        count: maps.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get recent maps
   */
  async getRecentMaps(limit = 10) {
    try {
      const maps = await Map.findAll({ limit });
      
      return {
        success: true,
        maps: maps.map(map => map.toJSON()),
        count: maps.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify map file integrity
   */
  async verifyMapFile(mapId) {
    try {
      const map = await Map.findById(mapId);
      if (!map) {
        throw new Error('Map not found');
      }

      const fileExists = await map.fileExists();
      const fileInfo = await fileService.getFileInfo(map.file_path);
      
      return {
        success: true,
        map_id: mapId,
        file_exists: fileExists,
        file_info: fileInfo.success ? fileInfo.info : null,
        integrity_ok: fileExists && map.file_size === (fileInfo.success ? fileInfo.info.size : 0)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get maps with missing files
   */
  async getMapsWithMissingFiles() {
    try {
      const allMaps = await Map.findAll();
      const mapsWithMissingFiles = [];
      
      for (const map of allMaps) {
        const fileExists = await map.fileExists();
        if (!fileExists) {
          mapsWithMissingFiles.push(map.toJSON());
        }
      }
      
      return {
        success: true,
        maps: mapsWithMissingFiles,
        count: mapsWithMissingFiles.length
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
module.exports = new MapService();
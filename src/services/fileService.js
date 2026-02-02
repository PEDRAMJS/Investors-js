const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const constants = require('../config/constants');
const uploadConfig = require('../config/upload');

const fsUnlink = promisify(fs.unlink);
const fsExists = promisify(fs.exists);
const fsStat = promisify(fs.stat);

class FileService {
  constructor() {
    this.baseUploadsPath = path.join(__dirname, '..', '..', constants.PATHS.UPLOADS);
  }

  /**
   * Get full path for a relative file path
   */
  getFullPath(relativePath) {
    if (!relativePath) return null;
    return path.join(this.baseUploadsPath, '..', relativePath);
  }

  /**
   * Validate file before processing
   */
  validateFile(file, options = {}) {
    const {
      required = true,
      allowedTypes = constants.ALLOWED_FILE_TYPES.MAPS,
      maxSize = constants.UPLOAD_LIMITS.MAX_FILE_SIZE
    } = options;

    if (required && !file) {
      return { 
        valid: false, 
        error: constants.ERRORS.UPLOAD.NO_FILE 
      };
    }

    if (!file) {
      return { valid: true };
    }

    // Check file size
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: constants.ERRORS.UPLOAD.TOO_LARGE(`${maxSize / (1024 * 1024)}MB`) 
      };
    }

    // Check file type
    const extname = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (!allowedTypes.test(extname) || !allowedTypes.test(file.mimetype)) {
      return { 
        valid: false, 
        error: constants.ERRORS.UPLOAD.INVALID_TYPE 
      };
    }

    return { valid: true };
  }

  /**
   * Save uploaded file and return file info
   */
  async saveUploadedFile(file, category = 'uploads', customName = null) {
    try {
      // Generate unique filename
      const filename = customName || uploadConfig.generateFilename(file.originalname, category);
      
      // Determine destination directory
      let destDir;
      switch (category) {
        case 'id-photos':
          destDir = path.join(this.baseUploadsPath, 'id-photos');
          break;
        case 'maps':
          destDir = path.join(this.baseUploadsPath, 'maps');
          break;
        default:
          destDir = path.join(this.baseUploadsPath, category);
      }

      // Ensure directory exists
      uploadConfig.ensureDir(destDir);

      // Destination path
      const destPath = path.join(destDir, filename);

      // Move file (Multer already saved it, we just need to verify and get info)
      // Note: In actual implementation with Multer, the file is already saved
      // We're just returning the file info here

      const fileInfo = {
        originalname: file.originalname,
        filename: filename,
        path: destPath,
        size: file.size,
        mimetype: file.mimetype,
        destination: destDir,
        relativePath: `/${constants.PATHS[category.toUpperCase()]}/${filename}`
      };

      return {
        success: true,
        file: fileInfo
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to save file: ' + error.message
      };
    }
  }

  /**
   * Delete file by path
   */
  async deleteFile(filePath) {
    try {
      const fullPath = this.getFullPath(filePath);
      
      if (!fullPath || !await fsExists(fullPath)) {
        return { success: false, error: 'File not found' };
      }

      await fsUnlink(fullPath);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to delete file: ' + error.message 
      };
    }
  }

  /**
   * Delete multiple files
   */
  async deleteFiles(filePaths) {
    const results = [];
    
    for (const filePath of filePaths) {
      const result = await this.deleteFile(filePath);
      results.push({ filePath, ...result });
    }
    
    return results;
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath) {
    try {
      const fullPath = this.getFullPath(filePath);
      
      if (!fullPath || !await fsExists(fullPath)) {
        return { success: false, error: 'File not found' };
      }

      const stats = await fsStat(fullPath);
      const ext = path.extname(fullPath).toLowerCase().replace('.', '');
      
      return {
        success: true,
        info: {
          path: filePath,
          fullPath: fullPath,
          size: stats.size,
          sizeHuman: this.formatFileSize(stats.size),
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          extension: ext,
          isImage: constants.ALLOWED_FILE_TYPES.IMAGES.test(ext),
          isDocument: constants.ALLOWED_FILE_TYPES.DOCUMENTS.test(ext),
          isArchive: constants.ALLOWED_FILE_TYPES.ARCHIVES.test(ext)
        }
      };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to get file info: ' + error.message 
      };
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    const fullPath = this.getFullPath(filePath);
    return fullPath && await fsExists(fullPath);
  }

  /**
   * Format file size to human readable format
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    try {
      const categories = ['id-photos', 'maps'];
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        byCategory: {}
      };

      for (const category of categories) {
        const categoryPath = path.join(this.baseUploadsPath, category);
        
        if (await fsExists(categoryPath)) {
          const files = await this._getDirectoryStats(categoryPath);
          stats.byCategory[category] = files;
          stats.totalFiles += files.count;
          stats.totalSize += files.totalSize;
        } else {
          stats.byCategory[category] = { count: 0, totalSize: 0, files: [] };
        }
      }

      stats.totalSizeHuman = this.formatFileSize(stats.totalSize);
      
      return {
        success: true,
        stats: stats
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get storage stats: ' + error.message
      };
    }
  }

  /**
   * Get directory statistics recursively
   */
  async _getDirectoryStats(dirPath) {
    const result = {
      count: 0,
      totalSize: 0,
      files: []
    };

    try {
      const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          const subDirStats = await this._getDirectoryStats(fullPath);
          result.count += subDirStats.count;
          result.totalSize += subDirStats.totalSize;
          result.files.push(...subDirStats.files);
        } else if (item.isFile()) {
          const stats = await fsStat(fullPath);
          result.count++;
          result.totalSize += stats.size;
          result.files.push({
            name: item.name,
            path: fullPath.replace(this.baseUploadsPath + '/..', ''),
            size: stats.size,
            sizeHuman: this.formatFileSize(stats.size),
            modifiedAt: stats.mtime
          });
        }
      }
    } catch (error) {
      console.error('Error reading directory:', dirPath, error);
    }

    return result;
  }

  /**
   * Clean up orphaned files (files in uploads but not referenced in database)
   */
  async cleanupOrphanedFiles(models) {
    try {
      // Get all referenced files from database
      const referencedFiles = new Set();
      
      // Collect from users (ID photos)
      if (models.users) {
        const users = await models.users.findAll({ 
          where: { id_photo_path: { $ne: null } } 
        });
        users.forEach(user => {
          if (user.id_photo_path) referencedFiles.add(user.id_photo_path);
        });
      }

      // Collect from maps
      if (models.maps) {
        const maps = await models.maps.findAll();
        maps.forEach(map => {
          if (map.file_path) referencedFiles.add(map.file_path);
        });
      }

      // Get all files from uploads directory
      const allFiles = await this._getAllUploadedFiles();
      
      // Find orphaned files
      const orphanedFiles = allFiles.filter(file => 
        !referencedFiles.has(file.relativePath)
      );

      // Delete orphaned files
      const deletionResults = [];
      for (const file of orphanedFiles) {
        const result = await this.deleteFile(file.relativePath);
        deletionResults.push({
          file: file.relativePath,
          success: result.success,
          error: result.error
        });
      }

      return {
        success: true,
        orphanedCount: orphanedFiles.length,
        deleted: deletionResults.filter(r => r.success).length,
        failed: deletionResults.filter(r => !r.success).length,
        details: deletionResults
      };
    } catch (error) {
      return {
        success: false,
        error: 'Cleanup failed: ' + error.message
      };
    }
  }

  /**
   * Get all files in uploads directory
   */
  async _getAllUploadedFiles() {
    const files = [];
    
    const walk = async (dir, baseDir = this.baseUploadsPath) => {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          await walk(fullPath, baseDir);
        } else if (item.isFile()) {
          const relativePath = fullPath.replace(baseDir + '/..', '');
          const stats = await fsStat(fullPath);
          
          files.push({
            fullPath,
            relativePath,
            name: item.name,
            size: stats.size,
            modifiedAt: stats.mtime
          });
        }
      }
    };

    await walk(this.baseUploadsPath);
    return files;
  }

  /**
   * Generate thumbnail for image (placeholder implementation)
   */
  async generateThumbnail(imagePath, options = {}) {
    // This is a placeholder. In production, you'd use a library like sharp or jimp
    const { width = 200, height = 200, quality = 80 } = options;
    
    return {
      success: false,
      error: 'Thumbnail generation not implemented',
      note: 'Implement using sharp/jimp library for production'
    };
  }

  /**
   * Validate and process multiple files
   */
  async processMultipleFiles(files, category = 'uploads') {
    const results = [];
    
    for (const file of files) {
      const validation = this.validateFile(file, {
        allowedTypes: constants.ALLOWED_FILE_TYPES.MAPS,
        maxSize: constants.UPLOAD_LIMITS.MAX_FILE_SIZE
      });
      
      if (!validation.valid) {
        results.push({
          originalname: file.originalname,
          success: false,
          error: validation.error
        });
        continue;
      }

      const saveResult = await this.saveUploadedFile(file, category);
      results.push({
        originalname: file.originalname,
        success: saveResult.success,
        file: saveResult.file,
        error: saveResult.error
      });
    }

    return results;
  }
}

// Create singleton instance
module.exports = new FileService();
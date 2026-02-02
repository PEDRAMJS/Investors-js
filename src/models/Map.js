const db = require('../config/database');
const constants = require('../config/constants');
const fs = require('fs');
const path = require('path');

class Map {
  constructor(data = {}) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description || '';
    this.file_path = data.file_path;
    this.file_type = data.file_type;
    this.file_size = data.file_size || 0;
    this.uploaded_by = data.uploaded_by;
    this.uploaded_by_name = data.uploaded_by_name;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }


  /**
   * Validate map data
   */
  validate() {
    const errors = [];

    if (!this.title || this.title.trim().length < 2) {
      errors.push(constants.ERRORS.VALIDATION.MIN_LENGTH('Title', 2));
    }

    if (!this.file_path) {
      errors.push('File path is required');
    }

    if (!this.uploaded_by) {
      errors.push('Uploader ID is required');
    }

    if (this.description && this.description.length > 2000) {
      errors.push(constants.ERRORS.VALIDATION.MAX_LENGTH('Description', 2000));
    }

    return errors;
  }

  /**
   * Save map to database
   */
  async save() {
    const validationErrors = this.validate();
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(', '));
    }

    if (this.id) {
      return await this.update();
    } else {
      return await this.create();
    }
  }

  /**
   * Create new map
   */
  async create() {
    const mapData = {
      title: this.title,
      description: this.description,
      file_path: this.file_path,
      file_type: this.file_type,
      file_size: this.file_size,
      uploaded_by: this.uploaded_by,
      uploaded_by_name: this.uploaded_by_name
    };

    this.id = await db.insert('maps', mapData);
    return this;
  }

  /**
   * Update existing map (only title and description)
   */
  async update() {
    const mapData = {
      title: this.title,
      description: this.description,
      updated_at: new Date()
    };

    await db.update('maps', mapData, { id: this.id });
    return this;
  }

  /**
   * Delete map and its file
   */
  async delete() {
    // Get file path before deletion
    const map = await Map.findById(this.id);
    
    // Delete from database
    await db.delete('maps', { id: this.id });
    
    // Delete file
    if (map && map.file_path) {
      const filePath = path.join(__dirname, '..', '..', map.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    return true;
  }

  /**
   * Find map by ID
   */
  static async findById(id) {
    const map = await db.queryOne(
      `SELECT m.*, u.name as uploaded_by_name, u.phone_number as uploaded_by_phone
       FROM maps m
       LEFT JOIN users u ON m.uploaded_by = u.id
       WHERE m.id = ?`,
      [id]
    );
    return map ? new Map(map) : null;
  }

  /**
   * Find all maps
   */
  static async findAll(filters = {}) {
    let query = `
      SELECT m.*, u.name as uploaded_by_name, u.phone_number as uploaded_by_phone
      FROM maps m
      LEFT JOIN users u ON m.uploaded_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.uploaded_by) {
      query += ' AND m.uploaded_by = ?';
      params.push(filters.uploaded_by);
    }

    if (filters.search) {
      query += ' AND (m.title LIKE ? OR m.description LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.file_type) {
      query += ' AND m.file_type LIKE ?';
      params.push(`%${filters.file_type}%`);
    }

    query += ' ORDER BY m.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(parseInt(filters.offset));
    }

    const maps = await db.query(query, params);
    return maps.map(map => new Map(map));
  }

  /**
   * Find maps by uploader
   */
  static async findByUploader(userId) {
    return await this.findAll({ uploaded_by: userId });
  }

  /**
   * Get map statistics
   */
  static async getStatistics() {
    const query = `
      SELECT 
        COUNT(*) as total_maps,
        COALESCE(SUM(file_size), 0) as total_size,
        COALESCE(AVG(file_size), 0) as average_size,
        COUNT(DISTINCT uploaded_by) as uploaders_count,
        MAX(created_at) as last_upload_date,
        (
          SELECT uploaded_by_name 
          FROM maps 
          ORDER BY created_at DESC 
          LIMIT 1
        ) as last_uploader
      FROM maps
    `;

    const stats = await db.queryOne(query);

    // Add file type distribution
    const typesQuery = `
      SELECT 
        CASE 
          WHEN file_type LIKE 'image/%' THEN 'تصاویر'
          WHEN file_type = 'application/pdf' THEN 'PDF'
          WHEN file_type IN ('application/zip', 'application/x-rar-compressed') THEN 'آرشیو'
          ELSE 'سایر'
        END as file_category,
        COUNT(*) as count,
        COALESCE(SUM(file_size), 0) as total_size
      FROM maps
      GROUP BY file_category
      ORDER BY count DESC
    `;

    const typeDistribution = await db.query(typesQuery);

    // Add monthly upload stats
    const monthlyQuery = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as uploads,
        COALESCE(SUM(file_size), 0) as total_size
      FROM maps
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
      LIMIT 6
    `;

    const monthlyStats = await db.query(monthlyQuery);

    return {
      ...stats,
      type_distribution: typeDistribution,
      monthly_stats: monthlyStats
    };
  }

  /**
   * Get file extension
   */
  getFileExtension() {
    if (!this.file_path) return '';
    return path.extname(this.file_path).toLowerCase().replace('.', '');
  }

  /**
   * Check if file is image
   */
  isImage() {
    return this.file_type && this.file_type.startsWith('image/');
  }

  /**
   * Check if file is PDF
   */
  isPDF() {
    return this.file_type === 'application/pdf';
  }

  /**
   * Check if file is archive
   */
  isArchive() {
    return ['application/zip', 'application/x-rar-compressed'].includes(this.file_type);
  }

  /**
   * Get file size in human readable format
   */
  getFileSizeHuman() {
    const bytes = this.file_size;
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get full file path
   */
  getFullPath() {
    if (!this.file_path) return null;
    return path.join(__dirname, '..', '..', this.file_path);
  }

  /**
   * Check if file exists
   */
  fileExists() {
    const fullPath = this.getFullPath();
    return fullPath && fs.existsSync(fullPath);
  }

  /**
   * Get uploader user
   */
  async getUploader() {
    const User = require('./User');
    return await User.findById(this.uploaded_by);
  }

  /**
   * Convert to JSON for API response
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      file_path: this.file_path,
      file_type: this.file_type,
      file_size: this.file_size,
      file_size_human: this.getFileSizeHuman(),
      file_extension: this.getFileExtension(),
      is_image: this.isImage(),
      is_pdf: this.isPDF(),
      is_archive: this.isArchive(),
      uploaded_by: this.uploaded_by,
      uploaded_by_name: this.uploaded_by_name,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = Map;
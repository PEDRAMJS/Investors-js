const db = require('../config/database');
const constants = require('../config/constants');

class Estate {
  constructor(data = {}) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.phase = data.phase;
    this.project = data.project;
    this.block = data.block || '';
    this.floor = data.floor;
    this.area = data.area || 0;
    this.rooms = data.rooms || 1;
    this.deed_type = data.deed_type;
    this.total_floors = data.total_floors || 1;
    this.units_per_floor = data.units_per_floor || 1;
    this.occupancy_status = data.occupancy_status;
    this.notes = data.notes || '';
    this.estate_type = data.estate_type;
    this.phone_number = data.phone_number;
    this.price = data.price;
    this.features = data.features ? 
      (typeof data.features === 'string' ? JSON.parse(data.features) : data.features) 
      : {};
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  /**
   * Validate estate data
   */
  validate() {
    const errors = [];

    // Required fields
    if (!this.phase || this.phase < 0) {
      errors.push('Phase is required and must be non-negative');
    }

    if (!this.project || this.project.trim().length === 0) {
      errors.push('Project name is required');
    }

    if (!this.floor || this.floor < 0) {
      errors.push('Floor must be a non-negative integer');
    }

    if (!this.area || this.area <= 0) {
      errors.push('Area must be greater than 0');
    }

    if (!this.rooms || this.rooms < 0) {
      errors.push('Rooms must be a non-negative integer');
    }

    if (!this.deed_type || this.deed_type.trim().length === 0) {
      errors.push('Deed type is required');
    }

    if (!this.total_floors || this.total_floors <= 0) {
      errors.push('Total floors must be greater than 0');
    }

    if (!this.units_per_floor || this.units_per_floor <= 0) {
      errors.push('Units per floor must be greater than 0');
    }

    if (!this.occupancy_status || this.occupancy_status.trim().length === 0) {
      errors.push('Occupancy status is required');
    }

    if (!this.estate_type || this.estate_type.trim().length === 0) {
      errors.push('Estate type is required');
    }

    if (!this.phone_number || !constants.REGEX.PHONE.test(this.phone_number)) {
      errors.push('Valid phone number is required');
    }

    if (!this.price || this.price < 0) {
      errors.push('Price must be a non-negative integer');
    }

    // Validate features if provided
    if (this.features && typeof this.features !== 'object') {
      errors.push('Features must be a valid JSON object');
    }

    // Validate against constants
    if (this.estate_type && !constants.ESTATE_TYPES.includes(this.estate_type)) {
      errors.push(`Invalid estate type. Allowed: ${constants.ESTATE_TYPES.join(', ')}`);
    }

    if (this.deed_type && !constants.DEED_TYPES.includes(this.deed_type)) {
      errors.push(`Invalid deed type. Allowed: ${constants.DEED_TYPES.join(', ')}`);
    }

    if (this.occupancy_status && !constants.OCCUPANCY_STATUS.includes(this.occupancy_status)) {
      errors.push(`Invalid occupancy status. Allowed: ${constants.OCCUPANCY_STATUS.join(', ')}`);
    }

    return errors;
  }

  /**
   * Save estate to database
   */
  async save() {
    const validationErrors = this.validate();
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(', '));
    }

    // Ensure features is a JSON string for database
    if (this.features && typeof this.features === 'object') {
      this.features = JSON.stringify(this.features);
    }

    if (this.id) {
      return await this.update();
    } else {
      return await this.create();
    }
  }

  /**
   * Create new estate
   */
  async create() {
    const estateData = {
      user_id: this.user_id,
      phase: this.phase,
      project: this.project,
      block: this.block,
      floor: this.floor,
      area: this.area,
      rooms: this.rooms,
      deed_type: this.deed_type,
      total_floors: this.total_floors,
      units_per_floor: this.units_per_floor,
      occupancy_status: this.occupancy_status,
      notes: this.notes,
      estate_type: this.estate_type,
      phone_number: this.phone_number,
      price: this.price,
      features: this.features
    };

    this.id = await db.insert('estates', estateData);
    
    // Fetch the complete record
    const created = await Estate.findById(this.id);
    Object.assign(this, created);
    
    return this;
  }

  /**
   * Update existing estate
   */
  async update() {
    const estateData = {
      phase: this.phase,
      project: this.project,
      block: this.block,
      floor: this.floor,
      area: this.area,
      rooms: this.rooms,
      deed_type: this.deed_type,
      total_floors: this.total_floors,
      units_per_floor: this.units_per_floor,
      occupancy_status: this.occupancy_status,
      notes: this.notes,
      estate_type: this.estate_type,
      phone_number: this.phone_number,
      price: this.price,
      features: this.features,
      updated_at: new Date()
    };

    await db.update('estates', estateData, { id: this.id, user_id: this.user_id });
    return this;
  }

  /**
   * Delete estate
   */
  async delete() {
    return await db.delete('estates', { id: this.id, user_id: this.user_id });
  }

  /**
   * Find estate by ID
   */
  static async findById(id) {
    const estate = await db.queryOne(
      `SELECT e.*, u.name as creator_name 
       FROM estates e
       LEFT JOIN users u ON e.user_id = u.id
       WHERE e.id = ?`,
      [id]
    );
    return estate ? new Estate(estate) : null;
  }

  /**
   * Find estates by user ID
   */
  static async findByUserId(userId, filters = {}) {
    let query = `
      SELECT e.*, u.name as creator_name 
      FROM estates e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.user_id = ?
    `;
    const params = [userId];

    this._applyFilters(query, params, filters);
    
    const estates = await db.query(query, params);
    return estates.map(estate => new Estate(estate));
  }

  /**
   * Find all estates with filters
   */
  static async findAll(filters = {}) {
    let query = `
      SELECT e.*, u.name as creator_name, u.phone_number as creator_phone
      FROM estates e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    this._applyFilters(query, params, filters);
    
    const estates = await db.query(query, params);
    return estates.map(estate => new Estate(estate));
  }

  /**
   * Apply filters to query
   */
  static _applyFilters(query, params, filters) {
    if (filters.phase) {
      query += ' AND e.phase = ?';
      params.push(filters.phase);
    }

    if (filters.project) {
      query += ' AND e.project LIKE ?';
      params.push(`%${filters.project}%`);
    }

    if (filters.estate_type) {
      query += ' AND e.estate_type = ?';
      params.push(filters.estate_type);
    }

    if (filters.min_price) {
      query += ' AND e.price >= ?';
      params.push(filters.min_price);
    }

    if (filters.max_price) {
      query += ' AND e.price <= ?';
      params.push(filters.max_price);
    }

    if (filters.min_area) {
      query += ' AND e.area >= ?';
      params.push(filters.min_area);
    }

    if (filters.max_area) {
      query += ' AND e.area <= ?';
      params.push(filters.max_area);
    }

    if (filters.rooms) {
      query += ' AND e.rooms = ?';
      params.push(filters.rooms);
    }

    if (filters.occupancy_status) {
      query += ' AND e.occupancy_status = ?';
      params.push(filters.occupancy_status);
    }

    if (filters.search) {
      query += ' AND (e.project LIKE ? OR e.notes LIKE ? OR e.block LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY e.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(parseInt(filters.offset));
    }
  }

  /**
   * Get estate statistics
   */
  static async getStatistics(userId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT project) as projects_count,
        COUNT(DISTINCT estate_type) as types_count,
        COALESCE(AVG(price), 0) as avg_price,
        COALESCE(AVG(area), 0) as avg_area,
        COALESCE(SUM(price), 0) as total_value,
        COALESCE(SUM(area), 0) as total_area
      FROM estates
    `;
    const params = [];

    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }

    const stats = await db.queryOne(query, params);
    
    // Add price range distribution
    const priceRangesQuery = `
      SELECT 
        CASE 
          WHEN price < 1000 THEN 'زیر ۱ میلیارد'
          WHEN price BETWEEN 1000 AND 2000 THEN '۱-۲ میلیارد'
          WHEN price BETWEEN 2000 AND 3000 THEN '۲-۳ میلیارد'
          WHEN price BETWEEN 3000 AND 5000 THEN '۳-۵ میلیارد'
          ELSE 'بالای ۵ میلیارد'
        END as price_range,
        COUNT(*) as count
      FROM estates
      ${userId ? 'WHERE user_id = ?' : ''}
      GROUP BY price_range
      ORDER BY MIN(price)
    `;
    
    const priceRanges = await db.query(
      priceRangesQuery,
      userId ? [userId] : []
    );

    // Add estate types distribution
    const typesQuery = `
      SELECT estate_type, COUNT(*) as count
      FROM estates
      ${userId ? 'WHERE user_id = ?' : ''}
      GROUP BY estate_type
      ORDER BY count DESC
    `;
    
    const typesDistribution = await db.query(
      typesQuery,
      userId ? [userId] : []
    );

    return {
      ...stats,
      price_ranges: priceRanges,
      types_distribution: typesDistribution
    };
  }

  /**
   * Search estates by features
   */
  static async searchByFeatures(features = {}) {
    let query = `
      SELECT e.*, u.name as creator_name 
      FROM estates e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // This is a simplified feature search
    // For production, you might want to use full-text search or a different approach
    if (Object.keys(features).length > 0) {
      query += ' AND JSON_CONTAINS(e.features, ?)';
      params.push(JSON.stringify(features));
    }

    query += ' ORDER BY e.created_at DESC LIMIT 50';
    
    const estates = await db.query(query, params);
    return estates.map(estate => new Estate(estate));
  }

  /**
   * Get similar estates
   */
  async getSimilar(limit = 5) {
    const query = `
      SELECT e.*, u.name as creator_name 
      FROM estates e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.id != ? 
        AND e.estate_type = ?
        AND e.phase = ?
        AND e.rooms = ?
        AND ABS(e.price - ?) / ? < 0.2  -- Within 20% price range
      ORDER BY ABS(e.price - ?)
      LIMIT ?
    `;
    
    const params = [
      this.id,
      this.estate_type,
      this.phase,
      this.rooms,
      this.price,
      this.price,
      this.price,
      limit
    ];
    
    const estates = await db.query(query, params);
    return estates.map(estate => new Estate(estate));
  }

  /**
   * Get estate owner
   */
  async getOwner() {
    const User = require('./User');
    return await User.findById(this.user_id);
  }

  /**
   * Sanitize phone number for non-owners
   */
  sanitizePhoneNumber(viewerUserId) {
    if (this.user_id !== viewerUserId) {
      // Mask phone number for non-owners
      this.phone_number = this.phone_number.replace(/.(?=.{4})/g, '*');
    }
  }

  /**
   * Convert to JSON for API response
   */
  toJSON() {
    return {
      id: this.id,
      user_id: this.user_id,
      phase: this.phase,
      project: this.project,
      block: this.block,
      floor: this.floor,
      area: this.area,
      rooms: this.rooms,
      deed_type: this.deed_type,
      total_floors: this.total_floors,
      units_per_floor: this.units_per_floor,
      occupancy_status: this.occupancy_status,
      notes: this.notes,
      estate_type: this.estate_type,
      phone_number: this.phone_number,
      price: this.price,
      features: typeof this.features === 'string' ? JSON.parse(this.features) : this.features,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = Estate;
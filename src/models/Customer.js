const db = require('../config/database');
const constants = require('../config/constants');

class Customer {
  constructor(data = {}) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.creator_name = data.creator_name;
    this.name = data.name;
    this.budget = data.budget || constants.DEFAULT_BUDGET;
    this.contact = data.contact || '';
    this.is_local = data.is_local || constants.CUSTOMER_TYPES.LOCAL;
    this.demands = data.demands || '';
    this.previous_deal = data.previous_deal || constants.DEAL_STATUS.REJECTED;
    this.notes = data.notes || '';
    this.estate_type = data.estate_type;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  /**
   * Validate customer data
   */
  validate() {
    const errors = [];

    if (!this.name || this.name.trim().length < 2) {
      errors.push(constants.ERRORS.VALIDATION.MIN_LENGTH('Name', 2));
    }

    if (!this.user_id) {
      errors.push('User ID is required');
    }

    if (this.budget && (isNaN(this.budget) || this.budget < 0)) {
      errors.push('Budget must be a positive number');
    }

    if (this.contact && this.contact.length > 500) {
      errors.push(constants.ERRORS.VALIDATION.MAX_LENGTH('Contact', 500));
    }

    if (this.demands && this.demands.length > 1000) {
      errors.push(constants.ERRORS.VALIDATION.MAX_LENGTH('Demands', 1000));
    }

    if (this.notes && this.notes.length > 2000) {
      errors.push(constants.ERRORS.VALIDATION.MAX_LENGTH('Notes', 2000));
    }

    return errors;
  }

  /**
   * Save customer to database
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
   * Create new customer
   */
  async create() {
    const customerData = {
      user_id: this.user_id,
      creator_name: this.creator_name,
      name: this.name,
      budget: this.budget,
      contact: this.contact,
      is_local: this.is_local,
      demands: this.demands,
      previous_deal: this.previous_deal,
      notes: this.notes,
      estate_type: this.estate_type
    };

    this.id = await db.insert('customers', customerData);
    
    // Fetch the complete record
    const created = await Customer.findById(this.id);
    Object.assign(this, created);
    
    return this;
  }

  /**
   * Update existing customer
   */
  async update() {
    const customerData = {
      name: this.name,
      budget: this.budget,
      contact: this.contact,
      is_local: this.is_local,
      demands: this.demands,
      previous_deal: this.previous_deal,
      notes: this.notes,
      estate_type: this.estate_type,
      updated_at: new Date()
    };

    await db.update('customers', customerData, { id: this.id, user_id: this.user_id });
    return this;
  }

  /**
   * Delete customer
   */
  async delete() {
    return await db.delete('customers', { id: this.id, user_id: this.user_id });
  }

  /**
   * Find customer by ID
   */
  static async findById(id) {
    const customer = await db.queryOne(
      `SELECT c.*, u.name as creator_name 
       FROM customers c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [id]
    );
    return customer ? new Customer(customer) : null;
  }

  /**
   * Find customers by user ID
   */
  static async findByUserId(userId, filters = {}) {
    let query = `
      SELECT c.*, u.name as creator_name 
      FROM customers c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.user_id = ?
    `;
    const params = [userId];

    if (filters.previous_deal) {
      query += ' AND c.previous_deal = ?';
      params.push(filters.previous_deal);
    }

    if (filters.is_local) {
      query += ' AND c.is_local = ?';
      params.push(filters.is_local);
    }

    if (filters.estate_type) {
      query += ' AND c.estate_type = ?';
      params.push(filters.estate_type);
    }

    if (filters.search) {
      query += ' AND (c.name LIKE ? OR c.contact LIKE ? OR c.demands LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.min_budget) {
      query += ' AND c.budget >= ?';
      params.push(filters.min_budget);
    }

    if (filters.max_budget) {
      query += ' AND c.budget <= ?';
      params.push(filters.max_budget);
    }

    query += ' ORDER BY c.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(parseInt(filters.offset));
    }

    const customers = await db.query(query, params);
    return customers.map(customer => new Customer(customer));
  }

  /**
   * Find all customers (admin only)
   */
  static async findAll(filters = {}) {
    let query = `
      SELECT c.*, u.name as creator_name, u.phone_number as creator_phone
      FROM customers c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.user_id) {
      query += ' AND c.user_id = ?';
      params.push(filters.user_id);
    }

    if (filters.previous_deal) {
      query += ' AND c.previous_deal = ?';
      params.push(filters.previous_deal);
    }

    if (filters.search) {
      query += ' AND (c.name LIKE ? OR c.contact LIKE ? OR u.name LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY c.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(parseInt(filters.offset));
    }

    const customers = await db.query(query, params);
    return customers.map(customer => new Customer(customer));
  }

  /**
   * Get customer statistics
   */
  static async getStatistics(userId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN previous_deal = 'successful' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN previous_deal = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN is_local = 'yes' THEN 1 ELSE 0 END) as local,
        SUM(CASE WHEN is_local = 'no' THEN 1 ELSE 0 END) as non_local,
        COALESCE(AVG(budget), 0) as avg_budget,
        COUNT(DISTINCT estate_type) as estate_types_count
      FROM customers
    `;
    const params = [];

    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }

    const stats = await db.queryOne(query, params);
    
    // Add monthly stats
    const monthlyQuery = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count
      FROM customers
      ${userId ? 'WHERE user_id = ?' : ''}
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
      LIMIT 6
    `;
    
    const monthlyStats = await db.query(
      monthlyQuery,
      userId ? [userId] : []
    );

    return {
      ...stats,
      monthly_stats: monthlyStats
    };
  }

  /**
   * Mark deal as successful
   */
  async markSuccessful() {
    this.previous_deal = constants.DEAL_STATUS.SUCCESSFUL;
    return await this.update();
  }

  /**
   * Mark deal as rejected
   */
  async markRejected() {
    this.previous_deal = constants.DEAL_STATUS.REJECTED;
    return await this.update();
  }

  /**
   * Get customer owner (user)
   */
  async getOwner() {
    const User = require('./User');
    return await User.findById(this.user_id);
  }

  /**
   * Convert to JSON for API response
   */
  toJSON() {
    return {
      id: this.id,
      user_id: this.user_id,
      creator_name: this.creator_name,
      name: this.name,
      budget: this.budget,
      contact: this.contact,
      is_local: this.is_local,
      demands: this.demands,
      previous_deal: this.previous_deal,
      notes: this.notes,
      estate_type: this.estate_type,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = Customer;
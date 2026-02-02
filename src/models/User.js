const db = require('../config/database');
const bcrypt = require('bcryptjs');
const constants = require('../config/constants');

class User {
  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.phone_number = data.phone_number;
    this.password = data.password;
    this.date_of_birth = data.date_of_birth;
    this.national_id = data.national_id;
    this.fathers_name = data.fathers_name;
    this.primary_residence = data.primary_residence;
    this.relative1_name = data.relative1_name;
    this.relative1_relation = data.relative1_relation;
    this.relative1_phone = data.relative1_phone;
    this.relative2_name = data.relative2_name;
    this.relative2_relation = data.relative2_relation;
    this.relative2_phone = data.relative2_phone;
    this.id_photo_path = data.id_photo_path;
    this.approved = data.approved || 0;
    this.approved_at = data.approved_at;
    this.is_admin = data.is_admin || 0;
    this.role = data.role || constants.ROLES.USER;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  /**
   * Validate user data
   */
  validate() {
    const errors = [];

    // Required fields
    if (!this.name || this.name.trim().length < 3) {
      errors.push(constants.ERRORS.VALIDATION.MIN_LENGTH('Name', 3));
    }

    if (!this.phone_number || !constants.REGEX.PHONE.test(this.phone_number)) {
      errors.push(constants.ERRORS.VALIDATION.INVALID_FORMAT('Phone number'));
    }

    if (!this.password || this.password.length < 6) {
      errors.push(constants.ERRORS.VALIDATION.MIN_LENGTH('Password', 6));
    }

    if (this.national_id && !constants.REGEX.NATIONAL_ID.test(this.national_id)) {
      errors.push(constants.ERRORS.VALIDATION.INVALID_FORMAT('National ID'));
    }

    // Date validation
    if (this.date_of_birth) {
      const dob = new Date(this.date_of_birth);
      if (isNaN(dob.getTime())) {
        errors.push('Invalid date of birth');
      } else {
        // Check if user is at least 18 years old
        const eighteenYearsAgo = new Date();
        eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
        if (dob > eighteenYearsAgo) {
          errors.push('User must be at least 18 years old');
        }
      }
    }

    return errors;
  }

  /**
   * Hash password before saving
   */
  async hashPassword() {
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }

  /**
   * Check if password matches
   */
  async comparePassword(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  }

  /**
   * Save user to database (create or update)
   */
  async save() {
    const validationErrors = this.validate();
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(', '));
    }

    await this.hashPassword();

    if (this.id) {
      // Update existing user
      return await this.update();
    } else {
      // Create new user
      return await this.create();
    }
  }

  /**
   * Create new user
   */
  async create() {
    const userData = {
      name: this.name,
      phone_number: this.phone_number,
      password: this.password,
      date_of_birth: this.date_of_birth,
      national_id: this.national_id,
      fathers_name: this.fathers_name,
      primary_residence: this.primary_residence,
      relative1_name: this.relative1_name,
      relative1_relation: this.relative1_relation,
      relative1_phone: this.relative1_phone,
      relative2_name: this.relative2_name,
      relative2_relation: this.relative2_relation,
      relative2_phone: this.relative2_phone,
      id_photo_path: this.id_photo_path,
      approved: this.approved,
      is_admin: this.is_admin,
      role: this.role
    };

    // Remove undefined values
    Object.keys(userData).forEach(key => {
      if (userData[key] === undefined) {
        delete userData[key];
      }
    });

    this.id = await db.insert('users', userData);
    return this;
  }

  /**
   * Update existing user
   */
  async update() {
    const userData = {
      name: this.name,
      phone_number: this.phone_number,
      date_of_birth: this.date_of_birth,
      national_id: this.national_id,
      fathers_name: this.fathers_name,
      primary_residence: this.primary_residence,
      relative1_name: this.relative1_name,
      relative1_relation: this.relative1_relation,
      relative1_phone: this.relative1_phone,
      relative2_name: this.relative2_name,
      relative2_relation: this.relative2_relation,
      relative2_phone: this.relative2_phone,
      approved: this.approved,
      approved_at: this.approved_at,
      is_admin: this.is_admin,
      role: this.role,
      updated_at: new Date()
    };

    // Only update password if provided
    if (this.password && !this.password.startsWith('$2b$')) {
      userData.password = await bcrypt.hash(this.password, 10);
    }

    // Remove undefined values
    Object.keys(userData).forEach(key => {
      if (userData[key] === undefined) {
        delete userData[key];
      }
    });

    await db.update('users', userData, { id: this.id });
    return this;
  }

  /**
   * Delete user
   */
  async delete() {
    return await db.delete('users', { id: this.id });
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    const user = await db.queryOne(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    return user ? new User(user) : null;
  }

  /**
   * Find user by field (name, phone, email, etc.)
   */
  static async findByField(field, value) {
    const user = await db.queryOne(
      `SELECT * FROM users WHERE ${field} = ?`,
      [value]
    );
    return user ? new User(user) : null;
  }

  /**
   * Find all users with optional filters
   */
  static async findAll(filters = {}) {
    let query = 'SELECT * FROM users WHERE 1=1';
    const params = [];

    if (filters.approved !== undefined) {
      query += ' AND approved = ?';
      params.push(filters.approved);
    }

    if (filters.is_admin !== undefined) {
      query += ' AND is_admin = ?';
      params.push(filters.is_admin);
    }

    if (filters.role) {
      query += ' AND role = ?';
      params.push(filters.role);
    }

    if (filters.search) {
      query += ' AND (name LIKE ? OR phone_number LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(parseInt(filters.offset));
    }

    const users = await db.query(query, params);
    return users.map(user => new User(user));
  }

  /**
   * Get pending users (not approved)
   */
  static async getPendingUsers() {
    return await this.findAll({ approved: 0 });
  }

  /**
   * Get approved users
   */
  static async getApprovedUsers() {
    return await this.findAll({ approved: 1 });
  }

  /**
   * Get users count
   */
  static async count(filters = {}) {
    let query = 'SELECT COUNT(*) as count FROM users WHERE 1=1';
    const params = [];

    if (filters.approved !== undefined) {
      query += ' AND approved = ?';
      params.push(filters.approved);
    }

    if (filters.is_admin !== undefined) {
      query += ' AND is_admin = ?';
      params.push(filters.is_admin);
    }

    const result = await db.queryOne(query, params);
    return result.count;
  }

  /**
   * Approve user
   */
  async approve() {
    this.approved = 1;
    this.approved_at = new Date();
    return await this.update();
  }

  /**
   * Reject user
   */
  async reject() {
    this.approved = 0;
    return await this.update();
  }

  /**
   * Promote to admin
   */
  async promoteToAdmin() {
    this.is_admin = 1;
    this.role = constants.ROLES.ADMIN;
    return await this.update();
  }

  /**
   * Demote from admin
   */
  async demoteFromAdmin() {
    this.is_admin = 0;
    this.role = constants.ROLES.USER;
    return await this.update();
  }

  /**
   * Get user's customers
   */
  async getCustomers() {
    const Customer = require('./Customer');
    return await Customer.findByUserId(this.id);
  }

  /**
   * Get user's estates
   */
  async getEstates() {
    const Estate = require('./Estate');
    return await Estate.findByUserId(this.id);
  }

  /**
   * Get user's maps
   */
  async getMaps() {
    const Map = require('./Map');
    return await Map.findByUserId(this.id);
  }

  /**
   * Sanitize user data for API response (remove sensitive info)
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      phone_number: this.phone_number,
      date_of_birth: this.date_of_birth,
      national_id: this.national_id,
      fathers_name: this.fathers_name,
      primary_residence: this.primary_residence,
      approved: this.approved,
      approved_at: this.approved_at,
      is_admin: this.is_admin,
      role: this.role,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  /**
   * Sanitize for admin view (includes more info)
   */
  toAdminJSON() {
    return {
      ...this.toJSON(),
      relative1_name: this.relative1_name,
      relative1_relation: this.relative1_relation,
      relative1_phone: this.relative1_phone,
      relative2_name: this.relative2_name,
      relative2_relation: this.relative2_relation,
      relative2_phone: this.relative2_phone,
      id_photo_path: this.id_photo_path
    };
  }
}

module.exports = User;
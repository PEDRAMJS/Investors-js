const mysql = require('mysql2');
const constants = require('./constants');

class Database {
  constructor() {
    this.pool = null;
    this.init();
  }

  init() {
    try {
      this.pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        timezone: '+00:00',
        dateStrings: true,
        charset: 'utf8mb4'
      });

      this.testConnection();
      console.log('✅ Database pool initialized');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      process.exit(1);
    }
  }

  async testConnection() {
    try {
      const connection = await this.pool.promise().getConnection();
      console.log('✅ Database connection test successful');
      connection.release();
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      process.exit(1);
    }
  }

  /**
   * Execute a query with parameters
   */
  async query(sql, params = []) {
    try {
      const [results] = await this.pool.promise().query(sql, params);
      return results;
    } catch (error) {
      console.error('Database query error:', {
        sql: sql.substring(0, 200) + '...',
        params,
        error: error.message
      });
      throw new Error(constants.ERRORS.DATABASE.QUERY);
    }
  }

  /**
   * Execute a query and return first result
   */
  async queryOne(sql, params = []) {
    const results = await this.query(sql, params);
    return results[0] || null;
  }

  /**
   * Execute an insert query and return the insert ID
   */
  async insert(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    
    const result = await this.query(sql, values);
    return result.insertId;
  }

  /**
   * Execute an update query
   */
  async update(table, data, where) {
    const setClause = Object.keys(data)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const whereClause = Object.keys(where)
      .map(key => `${key} = ?`)
      .join(' AND ');
    
    const values = [...Object.values(data), ...Object.values(where)];
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
    
    const result = await this.query(sql, values);
    return result.affectedRows;
  }

  /**
   * Execute a delete query
   */
  async delete(table, where) {
    const whereClause = Object.keys(where)
      .map(key => `${key} = ?`)
      .join(' AND ');
    
    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
    
    const result = await this.query(sql, Object.values(where));
    return result.affectedRows;
  }

  /**
   * Get a connection from the pool
   */
  async getConnection() {
    return await this.pool.promise().getConnection();
  }

  /**
   * Begin a transaction
   */
  async beginTransaction() {
    const connection = await this.getConnection();
    await connection.beginTransaction();
    return connection;
  }

  /**
   * Commit a transaction
   */
  async commit(connection) {
    await connection.commit();
    connection.release();
  }

  /**
   * Rollback a transaction
   */
  async rollback(connection) {
    await connection.rollback();
    connection.release();
  }

  /**
   * Close all connections
   */
  async close() {
    return new Promise((resolve, reject) => {
      this.pool.end(err => {
        if (err) {
          console.error('Error closing database pool:', err);
          reject(err);
        } else {
          console.log('Database pool closed');
          resolve();
        }
      });
    });
  }
}

// Create singleton instance
const database = new Database();

// Export both the instance and the class
module.exports = database;
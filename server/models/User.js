const db = require('../config/database');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

const User = {
  /**
   * Create a new user
   * @param {string} email - User email
   * @param {string} password - Plain text password
   * @param {string} displayName - Display name (optional)
   * @returns {Promise<Object>} Created user object (without password)
   */
  async create(email, password, displayName = null) {
    try {
      // Hash password
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      const query = `
        INSERT INTO users (email, password_hash, display_name)
        VALUES ($1, $2, $3)
        RETURNING id, email, display_name, created_at, is_active
      `;

      const result = await db.query(query, [email.toLowerCase(), password_hash, displayName]);
      logger.info(`User created: ${email}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  },

  /**
   * Find user by ID
   * @param {string} userId - User UUID
   * @returns {Promise<Object|null>} User object (without password)
   */
  async findById(userId) {
    try {
      const query = `
        SELECT id, email, display_name, created_at, updated_at, last_login, is_active
        FROM users
        WHERE id = $1 AND is_active = true
      `;

      const result = await db.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  },

  /**
   * Find user by email
   * @param {string} email - User email
   * @param {boolean} includePassword - Include password hash in result
   * @returns {Promise<Object|null>} User object
   */
  async findByEmail(email, includePassword = false) {
    try {
      const fields = includePassword
        ? 'id, email, password_hash, display_name, created_at, updated_at, is_active'
        : 'id, email, display_name, created_at, updated_at, is_active';

      const query = `
        SELECT ${fields}
        FROM users
        WHERE email = $1 AND is_active = true
      `;

      const result = await db.query(query, [email.toLowerCase()]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  },

  /**
   * Verify user password
   * @param {string} email - User email
   * @param {string} password - Plain text password to verify
   * @returns {Promise<Object|null>} User object if password matches, null otherwise
   */
  async verifyPassword(email, password) {
    try {
      const user = await this.findByEmail(email, true);
      if (!user) return null;

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return null;

      // Remove password hash before returning
      delete user.password_hash;
      return user;
    } catch (error) {
      logger.error('Error verifying password:', error);
      throw error;
    }
  },

  /**
   * Update user's last login timestamp
   * @param {string} userId - User UUID
   * @returns {Promise<void>}
   */
  async updateLastLogin(userId) {
    try {
      const query = `
        UPDATE users
        SET last_login = CURRENT_TIMESTAMP
        WHERE id = $1
      `;

      await db.query(query, [userId]);
    } catch (error) {
      logger.error('Error updating last login:', error);
      throw error;
    }
  },

  /**
   * Update user profile
   * @param {string} userId - User UUID
   * @param {Object} updates - Fields to update (display_name, email)
   * @returns {Promise<Object>} Updated user object
   */
  async update(userId, updates) {
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.display_name !== undefined) {
        fields.push(`display_name = $${paramIndex++}`);
        values.push(updates.display_name);
      }

      if (updates.email !== undefined) {
        fields.push(`email = $${paramIndex++}`);
        values.push(updates.email.toLowerCase());
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(userId);

      const query = `
        UPDATE users
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, email, display_name, created_at, updated_at, is_active
      `;

      const result = await db.query(query, values);
      logger.info(`User updated: ${userId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  },

  /**
   * Soft delete user (deactivate)
   * @param {string} userId - User UUID
   * @returns {Promise<void>}
   */
  async delete(userId) {
    try {
      const query = `
        UPDATE users
        SET is_active = false
        WHERE id = $1
      `;

      await db.query(query, [userId]);
      logger.info(`User deactivated: ${userId}`);
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }
};

module.exports = User;

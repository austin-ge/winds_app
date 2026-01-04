const db = require('../config/database');
const logger = require('../utils/logger');

const Dropzone = {
  /**
   * Create a new dropzone
   * @param {string} ownerId - User UUID who owns the dropzone
   * @param {Object} dropzoneData - Dropzone data (name, latitude, longitude, config, etc.)
   * @returns {Promise<Object>} Created dropzone object
   */
  async create(ownerId, dropzoneData) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const { name, identifier, latitude, longitude, config, is_public = false } = dropzoneData;

      // Insert dropzone
      const dropzoneQuery = `
        INSERT INTO dropzones (owner_id, name, identifier, latitude, longitude, config, is_public)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, owner_id, name, identifier, latitude, longitude, config, is_public, created_at, updated_at
      `;

      const dropzoneResult = await client.query(dropzoneQuery, [
        ownerId,
        name,
        identifier || null,
        latitude,
        longitude,
        JSON.stringify(config || {}),
        is_public
      ]);

      const dropzone = dropzoneResult.rows[0];

      // Create owner entry in user_dropzones
      const userDropzoneQuery = `
        INSERT INTO user_dropzones (user_id, dropzone_id, role)
        VALUES ($1, $2, 'owner')
      `;

      await client.query(userDropzoneQuery, [ownerId, dropzone.id]);

      await client.query('COMMIT');
      logger.info(`Dropzone created: ${name} (${dropzone.id}) by user ${ownerId}`);
      return dropzone;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating dropzone:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Find dropzone by ID
   * @param {string} dropzoneId - Dropzone UUID
   * @returns {Promise<Object|null>} Dropzone object
   */
  async findById(dropzoneId) {
    try {
      const query = `
        SELECT id, owner_id, name, identifier, latitude, longitude, config, is_public,
               created_at, updated_at, is_active
        FROM dropzones
        WHERE id = $1 AND is_active = true
      `;

      const result = await db.query(query, [dropzoneId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding dropzone by ID:', error);
      throw error;
    }
  },

  /**
   * Find all dropzones accessible to a user
   * @param {string} userId - User UUID
   * @returns {Promise<Array>} Array of dropzone objects with user role
   */
  async findByUserId(userId) {
    try {
      const query = `
        SELECT d.id, d.owner_id, d.name, d.identifier, d.latitude, d.longitude,
               d.config, d.is_public, d.created_at, d.updated_at, ud.role
        FROM dropzones d
        INNER JOIN user_dropzones ud ON d.id = ud.dropzone_id
        WHERE ud.user_id = $1 AND d.is_active = true
        ORDER BY d.updated_at DESC
      `;

      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      logger.error('Error finding dropzones by user ID:', error);
      throw error;
    }
  },

  /**
   * Find all public dropzones
   * @returns {Promise<Array>} Array of public dropzone objects
   */
  async findPublic() {
    try {
      const query = `
        SELECT id, owner_id, name, identifier, latitude, longitude, config,
               is_public, created_at, updated_at
        FROM dropzones
        WHERE is_public = true AND is_active = true
        ORDER BY name ASC
      `;

      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error finding public dropzones:', error);
      throw error;
    }
  },

  /**
   * Update dropzone
   * @param {string} dropzoneId - Dropzone UUID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated dropzone object
   */
  async update(dropzoneId, updates) {
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        fields.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }

      if (updates.identifier !== undefined) {
        fields.push(`identifier = $${paramIndex++}`);
        values.push(updates.identifier);
      }

      if (updates.latitude !== undefined) {
        fields.push(`latitude = $${paramIndex++}`);
        values.push(updates.latitude);
      }

      if (updates.longitude !== undefined) {
        fields.push(`longitude = $${paramIndex++}`);
        values.push(updates.longitude);
      }

      if (updates.config !== undefined) {
        fields.push(`config = $${paramIndex++}`);
        values.push(JSON.stringify(updates.config));
      }

      if (updates.is_public !== undefined) {
        fields.push(`is_public = $${paramIndex++}`);
        values.push(updates.is_public);
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(dropzoneId);

      const query = `
        UPDATE dropzones
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, owner_id, name, identifier, latitude, longitude, config, is_public,
                  created_at, updated_at
      `;

      const result = await db.query(query, values);
      logger.info(`Dropzone updated: ${dropzoneId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating dropzone:', error);
      throw error;
    }
  },

  /**
   * Soft delete dropzone (deactivate)
   * @param {string} dropzoneId - Dropzone UUID
   * @returns {Promise<void>}
   */
  async delete(dropzoneId) {
    try {
      const query = `
        UPDATE dropzones
        SET is_active = false
        WHERE id = $1
      `;

      await db.query(query, [dropzoneId]);
      logger.info(`Dropzone deactivated: ${dropzoneId}`);
    } catch (error) {
      logger.error('Error deleting dropzone:', error);
      throw error;
    }
  },

  /**
   * Check if user has permission to access dropzone
   * @param {string} userId - User UUID
   * @param {string} dropzoneId - Dropzone UUID
   * @param {string} requiredRole - Required role ('owner', 'editor', 'viewer')
   * @returns {Promise<boolean>} True if user has permission
   */
  async checkPermission(userId, dropzoneId, requiredRole = 'viewer') {
    try {
      const roleHierarchy = { owner: 3, editor: 2, viewer: 1 };
      const requiredLevel = roleHierarchy[requiredRole] || 1;

      const query = `
        SELECT role
        FROM user_dropzones
        WHERE user_id = $1 AND dropzone_id = $2
      `;

      const result = await db.query(query, [userId, dropzoneId]);

      if (result.rows.length === 0) {
        // Check if dropzone is public
        const dropzone = await this.findById(dropzoneId);
        return dropzone && dropzone.is_public && requiredLevel === 1;
      }

      const userRole = result.rows[0].role;
      const userLevel = roleHierarchy[userRole] || 0;

      return userLevel >= requiredLevel;
    } catch (error) {
      logger.error('Error checking permission:', error);
      throw error;
    }
  }
};

module.exports = Dropzone;

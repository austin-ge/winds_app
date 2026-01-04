const db = require('../config/database');
const logger = require('../utils/logger');

const UserDropzone = {
  /**
   * Add user to dropzone with specific role
   * @param {string} userId - User UUID
   * @param {string} dropzoneId - Dropzone UUID
   * @param {string} role - Role ('owner', 'editor', 'viewer')
   * @returns {Promise<Object>} Created user_dropzone entry
   */
  async add(userId, dropzoneId, role = 'viewer') {
    try {
      const query = `
        INSERT INTO user_dropzones (user_id, dropzone_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, dropzone_id)
        DO UPDATE SET role = $3
        RETURNING user_id, dropzone_id, role, created_at
      `;

      const result = await db.query(query, [userId, dropzoneId, role]);
      logger.info(`User ${userId} added to dropzone ${dropzoneId} with role ${role}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error adding user to dropzone:', error);
      throw error;
    }
  },

  /**
   * Remove user from dropzone
   * @param {string} userId - User UUID
   * @param {string} dropzoneId - Dropzone UUID
   * @returns {Promise<void>}
   */
  async remove(userId, dropzoneId) {
    try {
      const query = `
        DELETE FROM user_dropzones
        WHERE user_id = $1 AND dropzone_id = $2
      `;

      await db.query(query, [userId, dropzoneId]);
      logger.info(`User ${userId} removed from dropzone ${dropzoneId}`);
    } catch (error) {
      logger.error('Error removing user from dropzone:', error);
      throw error;
    }
  },

  /**
   * Get all users with access to a dropzone
   * @param {string} dropzoneId - Dropzone UUID
   * @returns {Promise<Array>} Array of users with their roles
   */
  async getUsersByDropzone(dropzoneId) {
    try {
      const query = `
        SELECT u.id, u.email, u.display_name, ud.role
        FROM user_dropzones ud
        INNER JOIN users u ON ud.user_id = u.id
        WHERE ud.dropzone_id = $1 AND u.is_active = true
        ORDER BY ud.role DESC, u.email ASC
      `;

      const result = await db.query(query, [dropzoneId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting users by dropzone:', error);
      throw error;
    }
  },

  /**
   * Update user's role in dropzone
   * @param {string} userId - User UUID
   * @param {string} dropzoneId - Dropzone UUID
   * @param {string} newRole - New role
   * @returns {Promise<Object>} Updated user_dropzone entry
   */
  async updateRole(userId, dropzoneId, newRole) {
    try {
      const query = `
        UPDATE user_dropzones
        SET role = $3
        WHERE user_id = $1 AND dropzone_id = $2
        RETURNING user_id, dropzone_id, role, created_at
      `;

      const result = await db.query(query, [userId, dropzoneId, newRole]);
      logger.info(`User ${userId} role updated to ${newRole} in dropzone ${dropzoneId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating user role:', error);
      throw error;
    }
  }
};

module.exports = UserDropzone;

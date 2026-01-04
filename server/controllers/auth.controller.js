const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const db = require('../config/database');
const jwtConfig = require('../config/jwt');
const logger = require('../utils/logger');
const { validateEmail, validatePassword } = require('../utils/validation');

/**
 * Generate access token
 */
const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId },
    jwtConfig.secret,
    {
      expiresIn: jwtConfig.accessTokenExpiry,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience
    }
  );
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    jwtConfig.secret,
    {
      expiresIn: jwtConfig.refreshTokenExpiry,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience
    }
  );
};

/**
 * Store refresh token in database
 */
const storeRefreshToken = async (userId, token) => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  const query = `
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    RETURNING id
  `;

  await db.query(query, [userId, tokenHash, expiresAt]);
};

/**
 * Register new user
 */
const register = async (req, res, next) => {
  try {
    const { email, password, display_name } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid email format'
      });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: passwordValidation.message
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User with this email already exists'
      });
    }

    // Create user
    const user = await User.create(email, password, display_name);

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token
    await storeRefreshToken(user.id, refreshToken);

    logger.info(`User registered: ${email}`);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required'
      });
    }

    // Verify credentials
    const user = await User.verifyPassword(email, password);
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token
    await storeRefreshToken(user.id, refreshToken);

    // Update last login
    await User.updateLastLogin(user.id);

    logger.info(`User logged in: ${email}`);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, jwtConfig.secret, {
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience
      });
    } catch (error) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token'
      });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token type'
      });
    }

    // Check if token exists in database and is not revoked
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const query = `
      SELECT * FROM refresh_tokens
      WHERE user_id = $1 AND token_hash = $2 AND revoked = false AND expires_at > NOW()
    `;

    const result = await db.query(query, [decoded.userId, tokenHash]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token not found or expired'
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken(decoded.userId);

    res.json({ accessToken });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user (revoke refresh token)
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const query = `
        UPDATE refresh_tokens
        SET revoked = true
        WHERE token_hash = $1
      `;

      await db.query(query, [tokenHash]);
    }

    logger.info(`User logged out: ${req.user?.id}`);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user
 */
const getCurrentUser = async (req, res, next) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        display_name: req.user.display_name,
        created_at: req.user.created_at
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getCurrentUser
};

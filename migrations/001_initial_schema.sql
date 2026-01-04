-- Winds App Database Schema
-- PostgreSQL database schema for user accounts, dropzone management, and collaboration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- USERS TABLE
-- ===========================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true,

  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);

-- ===========================================
-- DROPZONES TABLE
-- ===========================================
CREATE TABLE dropzones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  identifier VARCHAR(20),  -- e.g., "C89", "KOMH" from dropzones.json
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(11, 7) NOT NULL,

  -- Configuration JSON (stores all DZ-specific settings)
  config JSONB NOT NULL DEFAULT '{}'::jsonb,

  is_public BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_latitude CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT valid_longitude CHECK (longitude >= -180 AND longitude <= 180)
);

CREATE INDEX idx_dropzones_owner ON dropzones(owner_id);
CREATE INDEX idx_dropzones_identifier ON dropzones(identifier);
CREATE INDEX idx_dropzones_is_public ON dropzones(is_public) WHERE is_public = true;
CREATE INDEX idx_dropzones_is_active ON dropzones(is_active);

-- ===========================================
-- USER_DROPZONES TABLE (Junction)
-- ===========================================
CREATE TABLE user_dropzones (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dropzone_id UUID NOT NULL REFERENCES dropzones(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer',  -- 'owner', 'editor', 'viewer'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (user_id, dropzone_id),
  CONSTRAINT valid_role CHECK (role IN ('owner', 'editor', 'viewer'))
);

CREATE INDEX idx_user_dropzones_user ON user_dropzones(user_id);
CREATE INDEX idx_user_dropzones_dropzone ON user_dropzones(dropzone_id);

-- ===========================================
-- REFRESH_TOKENS TABLE
-- ===========================================
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked BOOLEAN DEFAULT false
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_revoked ON refresh_tokens(revoked) WHERE revoked = false;

-- ===========================================
-- USER_PREFERENCES TABLE
-- ===========================================
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_dropzone_id UUID REFERENCES dropzones(id) ON DELETE SET NULL,
  preferences JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dropzones_updated_at BEFORE UPDATE ON dropzones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- CLEANUP FUNCTION FOR EXPIRED TOKENS
-- ===========================================
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM refresh_tokens
  WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- COMMENTS FOR DOCUMENTATION
-- ===========================================
COMMENT ON TABLE users IS 'User accounts for authentication and authorization';
COMMENT ON TABLE dropzones IS 'Dropzone configurations with lat/lon and custom settings';
COMMENT ON TABLE user_dropzones IS 'Junction table for shared dropzone access and permissions';
COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for session management';
COMMENT ON TABLE user_preferences IS 'User-specific preferences and last viewed dropzone';

COMMENT ON COLUMN dropzones.config IS 'JSONB containing aircraft, jump_params, jump_run settings';
COMMENT ON COLUMN user_preferences.preferences IS 'JSONB containing UI state and custom settings';

// Input validation utilities

const validateEmail = (email) => {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
};

const validateLatitude = (lat) => {
  const latitude = parseFloat(lat);
  return !isNaN(latitude) && latitude >= -90 && latitude <= 90;
};

const validateLongitude = (lon) => {
  const longitude = parseFloat(lon);
  return !isNaN(longitude) && longitude >= -180 && longitude <= 180;
};

const validateUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const validateDropzoneConfig = (config) => {
  // Validate dropzone configuration object
  if (typeof config !== 'object' || config === null) {
    return { valid: false, message: 'Config must be a valid object' };
  }

  // Optional: Validate specific config fields if present
  if (config.aircraft && !Array.isArray(config.aircraft.jump_planes)) {
    return { valid: false, message: 'aircraft.jump_planes must be an array' };
  }

  if (config.jump_params) {
    const params = config.jump_params;
    if (params.exit_altitude_ft && (params.exit_altitude_ft < 0 || params.exit_altitude_ft > 30000)) {
      return { valid: false, message: 'exit_altitude_ft must be between 0 and 30000' };
    }
    if (params.opening_altitude_ft && (params.opening_altitude_ft < 0 || params.opening_altitude_ft > 30000)) {
      return { valid: false, message: 'opening_altitude_ft must be between 0 and 30000' };
    }
  }

  return { valid: true };
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  // Remove potentially dangerous characters
  return input.trim().replace(/[<>]/g, '');
};

module.exports = {
  validateEmail,
  validatePassword,
  validateLatitude,
  validateLongitude,
  validateUUID,
  validateDropzoneConfig,
  sanitizeInput
};

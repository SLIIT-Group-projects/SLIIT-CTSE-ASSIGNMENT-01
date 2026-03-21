const dotenv = require('dotenv');
dotenv.config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4003),
  mongodbUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  internalServiceToken: required('INTERNAL_SERVICE_TOKEN'),
  appointmentServiceBaseUrl: required('APPOINTMENT_SERVICE_BASE_URL'),
  labServiceBaseUrl: required('LAB_SERVICE_BASE_URL'),
  authServiceBaseUrl: required('AUTH_SERVICE_BASE_URL'),
};


const dotenv = require('dotenv');
dotenv.config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4005),
  mongodbUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  internalServiceToken: required('INTERNAL_SERVICE_TOKEN'),
  authServiceBaseUrl: process.env.AUTH_SERVICE_BASE_URL || 'https://auth-service-0vqx.onrender.com',
  appointmentServiceBaseUrl: required('APPOINTMENT_SERVICE_BASE_URL'),
  doctorServiceBaseUrl: process.env.DOCTOR_SERVICE_BASE_URL || 'https://doctor-service-7w9h.onrender.com',
  labServiceBaseUrl: required('LAB_SERVICE_BASE_URL'),
  publicServiceBaseUrl: process.env.PUBLIC_SERVICE_BASE_URL || '',
  defaultAppointmentAmount: Number(process.env.DEFAULT_APPOINTMENT_AMOUNT || 500),
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || '',
};


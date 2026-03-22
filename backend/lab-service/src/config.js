const dotenv = require('dotenv');
dotenv.config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const port = Number(process.env.PORT || 4004);
const publicFromEnv = (process.env.PUBLIC_SERVICE_BASE_URL || '').trim();

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port,
  mongodbUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  internalServiceToken: required('INTERNAL_SERVICE_TOKEN'),
  billingServiceBaseUrl: required('BILLING_SERVICE_BASE_URL'),
  authServiceBaseUrl: required('AUTH_SERVICE_BASE_URL'),
  defaultLabAmount: Number(process.env.DEFAULT_LAB_AMOUNT || 300),
  /** Browser-reachable base for /uploads; defaults to local lab port so report URLs are never path-only */
  publicServiceBaseUrl: publicFromEnv || `http://localhost:${port}`,

  /** Optional SMTP for patient email (see .env.example) */
  smtpHost: (process.env.SMTP_HOST || '').trim(),
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1',
  smtpUser: (process.env.SMTP_USER || '').trim(),
  smtpPass: (process.env.SMTP_PASS || '').trim(),
  mailFrom: (process.env.MAIL_FROM || 'noreply@hospital.local').trim(),
};


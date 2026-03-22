const dotenv = require('dotenv');

dotenv.config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4002),
  mongodbUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  internalServiceToken: required('INTERNAL_SERVICE_TOKEN'),
  billingServiceBaseUrl: required('BILLING_SERVICE_BASE_URL'),
  doctorServiceBaseUrl: process.env.DOCTOR_SERVICE_BASE_URL || 'https://doctor-service-7w9h.onrender.com',
  // Browser must reach this host:port for stored /uploads/... links (default = direct appointment port).
  publicServiceBaseUrl: process.env.PUBLIC_SERVICE_BASE_URL || 'https://appointment-service-t2lw.onrender.com',
  slotMinutes: Number(process.env.SLOT_MINUTES || 30),
  defaultAppointmentAmount: Number(process.env.DEFAULT_APPOINTMENT_AMOUNT || 500),
};


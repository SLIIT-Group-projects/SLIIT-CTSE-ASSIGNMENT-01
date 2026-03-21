const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 4000),
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://auth-service:4001',
  appointmentServiceUrl: process.env.APPOINTMENT_SERVICE_URL || 'http://appointment-service:4002',
  doctorServiceUrl: process.env.DOCTOR_SERVICE_URL || 'http://doctor-service:4003',
  labServiceUrl: process.env.LAB_SERVICE_URL || 'http://lab-service:4004',
  billingServiceUrl: process.env.BILLING_SERVICE_URL || 'http://billing-service:4005',
};

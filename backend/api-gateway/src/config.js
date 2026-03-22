const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 4000),
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'https://auth-service-0vqx.onrender.com',
  appointmentServiceUrl: process.env.APPOINTMENT_SERVICE_URL || 'https://appointment-service-t2lw.onrender.com',
  doctorServiceUrl: process.env.DOCTOR_SERVICE_URL || 'https://doctor-service-7w9h.onrender.com',
  labServiceUrl: process.env.LAB_SERVICE_URL || 'https://sliit-ctse-assignment-01-7.onrender.com',
  billingServiceUrl: process.env.BILLING_SERVICE_URL || 'https://billing-service-60xe.onrender.com',
};

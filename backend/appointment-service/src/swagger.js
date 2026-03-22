const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Appointment Service API',
    version: '1.0.0',
  },
  servers: [{ url: process.env.PUBLIC_API_BASE_URL || 'https://appointment-service-t2lw.onrender.com' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      internalAuth: { type: 'apiKey', in: 'header', name: 'x-internal-token' },
    },
  },
};

const options = {
  swaggerDefinition,
  apis: [path.join(__dirname, 'routes', '*.js')],
};

module.exports = swaggerJSDoc(options);


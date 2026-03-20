const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: { title: 'Doctor Service API', version: '1.0.0' },
  servers: [{ url: process.env.PUBLIC_API_BASE_URL || 'http://localhost:4003' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
};

const options = { swaggerDefinition, apis: [path.join(__dirname, 'routes', '*.js')] };
module.exports = swaggerJSDoc(options);


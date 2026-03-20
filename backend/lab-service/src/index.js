const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

require('dotenv').config();

const config = require('./config');
const swaggerSpec = require('./swagger');
const labRoutes = require('./routes/lab');

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

app.use(labRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/health', async (req, res) => res.json({ status: 'ok' }));

async function start() {
  await mongoose.connect(config.mongodbUri);
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Lab Service listening on port ${config.port}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start lab-service', err);
  process.exit(1);
});


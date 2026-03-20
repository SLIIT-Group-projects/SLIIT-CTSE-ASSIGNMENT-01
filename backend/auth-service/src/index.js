const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

const config = require('./config');
const swaggerSpec = require('./swagger');
const authRoutes = require('./routes/auth');

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.use('/auth', authRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/health', async (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  await mongoose.connect(config.mongodbUri, {});
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Auth Service listening on port ${config.port}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start auth-service', err);
  process.exit(1);
});


const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

require('dotenv').config();

const config = require('./config');
const swaggerSpec = require('./swagger');
const billingRoutes = require('./routes/billing');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

app.use(billingRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/health', async (req, res) => res.json({ status: 'ok' }));
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => res.status(204).end());

// Backward compatibility for old paymentSlipUrl values stored as plain filenames.
app.get(/^\/([^/]+\.(?:png|jpe?g|gif|webp|heic|heif|bmp|tif|tiff|pdf))$/i, (req, res, next) => {
  const filename = path.basename(req.params[0] || '');
  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) return next();
  return res.sendFile(filePath);
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large (max 10MB)' });
    }
    return res.status(400).json({ message: err.message || 'Upload failed' });
  }
  if (err && err.message === 'Only PDF/images are allowed') {
    return res.status(400).json({ message: err.message });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
});

async function start() {
  await mongoose.connect(config.mongodbUri);
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Billing Service listening on port ${config.port}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start billing-service', err);
  process.exit(1);
});


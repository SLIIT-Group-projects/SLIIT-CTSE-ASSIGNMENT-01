const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');

const config = require('./config');

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));

function serviceProxy(target, servicePrefix) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: {
      [`^/${servicePrefix}`]: '',
    },
    proxyTimeout: 15000,
    onError(err, req, res) {
      res.status(502).json({
        message: 'Gateway proxy error',
        service: servicePrefix,
        error: err.message,
        path: req.originalUrl,
      });
    },
  });
}

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    routes: [
      '/auth-service/*',
      '/appointment-service/*',
      '/doctor-service/*',
      '/lab-service/*',
      '/billing-service/*',
    ],
  });
});

app.use('/auth-service', serviceProxy(config.authServiceUrl, 'auth-service'));
app.use('/appointment-service', serviceProxy(config.appointmentServiceUrl, 'appointment-service'));
app.use('/doctor-service', serviceProxy(config.doctorServiceUrl, 'doctor-service'));
app.use('/lab-service', serviceProxy(config.labServiceUrl, 'lab-service'));
app.use('/billing-service', serviceProxy(config.billingServiceUrl, 'billing-service'));

app.listen(config.port, () => {
  console.log(`API Gateway running on port ${config.port}`);
});

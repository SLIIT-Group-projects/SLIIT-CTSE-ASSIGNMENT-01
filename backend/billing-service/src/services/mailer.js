const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function isMailerConfigured() {
  return Boolean(config.smtpHost && config.smtpFrom);
}

function getTransporter() {
  if (transporter) return transporter;

  const transportConfig = {
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
  };

  if (config.smtpUser) {
    transportConfig.auth = {
      user: config.smtpUser,
      pass: config.smtpPass,
    };
  }

  transporter = nodemailer.createTransport(transportConfig);
  return transporter;
}

async function sendBillingEmail({ to, subject, text, html }) {
  if (!isMailerConfigured()) {
    const err = new Error('Email is not configured on the billing service');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  const info = await getTransporter().sendMail({
    from: config.smtpFrom,
    to,
    subject,
    text,
    html,
  });

  return info;
}

module.exports = { isMailerConfigured, sendBillingEmail };

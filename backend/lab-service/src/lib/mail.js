const nodemailer = require('nodemailer');
const config = require('../config');

/**
 * Send "lab report ready" email. If SMTP_HOST is unset, logs only (dev/demo).
 * @returns {{ ok: boolean, devMode?: boolean, message?: string, error?: string }}
 */
async function sendLabReportReadyEmail({ to, patientName, testName, viewUrl }) {
  const subject = `Your lab report is ready: ${testName}`;
  const text = `Hello${patientName ? ` ${patientName}` : ''},\n\nYour lab report "${testName}" is available.\nView it here: ${viewUrl}\n\n— Hospital Lab`;

  if (!config.smtpHost) {
    // eslint-disable-next-line no-console
    console.log('[lab-mail] SMTP_HOST not set — would send email:', { to, subject, preview: text.slice(0, 120) });
    return { ok: true, devMode: true, message: 'Email simulated (configure SMTP_HOST in .env to send real mail)' };
  }

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    // Port 465: SSL — use SMTP_SECURE=true. Port 587: STARTTLS — use SMTP_SECURE=false.
    secure: config.smtpSecure,
    auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass || '' } : undefined,
    tls: { rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false' },
  });

  try {
    await transporter.sendMail({
      from: config.mailFrom,
      to,
      subject,
      text,
    });
    return { ok: true, devMode: false };
  } catch (err) {
    const smtpMsg = err.response || err.responseCode || err.command;
    const detail = [err.message, smtpMsg].filter(Boolean).join(' — ');
    return { ok: false, error: detail || 'Failed to send email' };
  }
}

module.exports = { sendLabReportReadyEmail };

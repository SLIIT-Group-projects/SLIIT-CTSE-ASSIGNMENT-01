const express = require('express');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { z } = require('zod');

const Bill = require('../models/Bill');
const { requireAuth, requireInternal, requireRole } = require('../middleware/auth');
const config = require('../config');
const { sendBillingEmail } = require('../services/mailer');

const router = express.Router();

function allowSlipImageOrPdf(file) {
  const mime = (file.mimetype || '').toLowerCase();
  const name = (file.originalname || '').toLowerCase();
  if (mime === 'application/pdf') return true;
  if (mime.startsWith('image/')) return true;
  if (mime === 'application/octet-stream' || mime === '') {
    return /\.(jpe?g|png|gif|webp|heic|heif|bmp|tif|tiff|pdf)$/i.test(name);
  }
  return false;
}

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowSlipImageOrPdf(file)) return cb(new Error('Only PDF/images are allowed'));
    return cb(null, true);
  },
}).fields([
  { name: 'slip', maxCount: 1 },
  { name: 'file', maxCount: 1 },
]);

const internalCreateAppointmentSchema = z.object({
  appointmentId: z.string().min(1),
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  amount: z.number().positive(),
});

const internalCreateLabSchema = z.object({
  labRequestId: z.string().min(1),
  appointmentId: z.string().min(1),
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  amount: z.number().positive(),
});

const verifySchema = z.object({
  verified: z.boolean(),
  method: z.enum(['BANK_TRANSFER', 'PHYSICAL']).optional(),
  adminNote: z.string().max(5000).optional(),
});

async function resolveAppointmentAmount(doctorId, authHeader) {
  try {
    const resp = await axios.get(`${config.doctorServiceBaseUrl}/doctor/profiles`, {
      params: { ids: String(doctorId) },
      headers: { Authorization: authHeader },
      timeout: 10000,
    });
    const profile = resp.data?.profiles?.[0];
    const charge = Number(profile?.consultationCharge);
    if (Number.isFinite(charge) && charge >= 0) return charge;
  } catch {
    // Fall back to the shared default if doctor profile lookup is unavailable.
  }
  return config.defaultAppointmentAmount;
}

async function ensureAppointmentBill({ appointmentId, patientId, authHeader }) {
  const existing = await Bill.findOne({
    billType: 'APPOINTMENT',
    referenceId: appointmentId,
    patientId,
  });
  if (existing) {
    if (!existing.patientName || !existing.patientEmail) {
      const snapshot = await lookupPatientSnapshot(patientId);
      existing.patientName = existing.patientName || snapshot.patientName;
      existing.patientEmail = existing.patientEmail || snapshot.patientEmail;
      await existing.save();
    }
    return existing;
  }

  const resp = await axios.get(`${config.appointmentServiceBaseUrl}/appointments/${appointmentId}`, {
    headers: { Authorization: authHeader },
    timeout: 10000,
  });
  const appointment = resp.data?.appointment;
  if (!appointment) return null;

  const amount = await resolveAppointmentAmount(appointment.doctorId, authHeader);
  const snapshot = await lookupPatientSnapshot(patientId);

  return Bill.findOneAndUpdate(
    {
      billType: 'APPOINTMENT',
      referenceId: appointmentId,
    },
    {
      $setOnInsert: {
        patientId,
        patientName: snapshot.patientName,
        patientEmail: snapshot.patientEmail,
        doctorId: appointment.doctorId,
        amount,
        status: 'PENDING_PAYMENT',
      },
    },
    { new: true, upsert: true }
  );
}

function getSlipFile(req) {
  const f = (req.files && (req.files.slip?.[0] || req.files.file?.[0])) || null;
  return f;
}

function slipUrl(filename) {
  // Frontend can use the same origin when running behind one gateway; for local dev it's OK to return relative.
  return config.publicServiceBaseUrl ? `${config.publicServiceBaseUrl}/uploads/${filename}` : `/uploads/${filename}`;
}

async function lookupUsersByIds(ids) {
  if (!ids.length) return [];
  const resp = await axios.post(
    `${config.authServiceBaseUrl}/auth/users/bulk`,
    { ids },
    {
      headers: {
        'x-internal-token': config.internalServiceToken,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );
  return resp.data?.users || [];
}

async function lookupPatientSnapshot(patientId) {
  try {
    const users = await lookupUsersByIds([String(patientId)]);
    const patient = users.find((u) => u.id === String(patientId)) || null;
    return {
      patientName: patient?.name || '',
      patientEmail: patient?.email || '',
    };
  } catch {
    return {
      patientName: '',
      patientEmail: '',
    };
  }
}

async function lookupDoctorProfile(doctorId, authHeader) {
  if (!doctorId) return null;
  const resp = await axios.get(`${config.doctorServiceBaseUrl}/doctor/profiles`, {
    params: { ids: String(doctorId) },
    headers: { Authorization: authHeader },
    timeout: 10000,
  });
  return resp.data?.profiles?.[0] || null;
}

async function lookupBillContext(bill, authHeader) {
  let patient = null;
  try {
    const users = await lookupUsersByIds([String(bill.patientId)]);
    patient = users.find((u) => u.id === String(bill.patientId)) || null;
  } catch {
    patient = null;
  }
  if (!patient && (bill.patientName || bill.patientEmail)) {
    patient = {
      id: String(bill.patientId),
      name: bill.patientName || '',
      email: bill.patientEmail || '',
    };
  }
  const doctorProfile = bill.doctorId ? await lookupDoctorProfile(bill.doctorId, authHeader) : null;

  let related = null;
  if (bill.billType === 'APPOINTMENT') {
    const resp = await axios.get(`${config.appointmentServiceBaseUrl}/appointments/${bill.referenceId}`, {
      headers: { Authorization: authHeader },
      timeout: 10000,
    });
    related = resp.data?.appointment || null;
  } else {
    const resp = await axios.get(`${config.labServiceBaseUrl}/lab/requests/${bill.referenceId}`, {
      headers: { Authorization: authHeader },
      timeout: 10000,
    });
    related = resp.data?.labRequest || null;
  }

  return { patient, doctorProfile, related };
}

function buildBillEmailContent(bill, patient, doctorProfile, related) {
  const patientName = patient?.name || bill.patientName || String(bill.patientId);
  const patientEmail = patient?.email || bill.patientEmail || '—';
  const doctorName = doctorProfile?.name || (bill.doctorId ? String(bill.doctorId) : '—');
  const lines = [
    `Billing details for ${bill.billType === 'APPOINTMENT' ? 'appointment' : 'lab'} ${bill.referenceId}`,
    '',
    `Patient: ${patientName}`,
    `Patient email: ${patientEmail}`,
    `Doctor: ${doctorName}`,
    `Amount: ${bill.amount} ${bill.currency || 'LKR'}`,
    `Status: ${bill.status}`,
    `Payment method: ${bill.paymentMethod || '—'}`,
    `Created: ${bill.createdAt ? new Date(bill.createdAt).toLocaleString() : '—'}`,
  ];

  if (bill.billType === 'APPOINTMENT' && related) {
    lines.push(`Appointment date: ${related.date || '—'}`);
    lines.push(`Appointment time: ${related.startTime || '—'} - ${related.endTime || '—'}`);
    lines.push(`Appointment status: ${related.status || '—'}`);
  }

  if (bill.billType === 'LAB' && related) {
    lines.push(`Test: ${related.testName || '—'}`);
    lines.push(`Lab payment status: ${related.paymentStatus || '—'}`);
    lines.push(`Lab notes: ${related.notes || '—'}`);
  }

  const text = lines.join('\n');
  const html = `
    <h1>Billing Details</h1>
    <p><strong>Reference:</strong> ${bill.referenceId}</p>
    <p><strong>Patient:</strong> ${patientName}</p>
    <p><strong>Patient email:</strong> ${patientEmail}</p>
    <p><strong>Doctor:</strong> ${doctorName}</p>
    <p><strong>Amount:</strong> ${bill.amount} ${bill.currency || 'LKR'}</p>
    <p><strong>Status:</strong> ${bill.status}</p>
    <p><strong>Payment method:</strong> ${bill.paymentMethod || '—'}</p>
    ${bill.billType === 'APPOINTMENT' && related ? `<p><strong>Appointment:</strong> ${related.date || '—'} ${related.startTime || '—'} - ${related.endTime || '—'}</p>` : ''}
    ${bill.billType === 'LAB' && related ? `<p><strong>Test:</strong> ${related.testName || '—'}</p>` : ''}
  `;

  return { text, html };
}

/**
 * POST /billing/appointments/bills
 * Internal: create a bill for an appointment.
 */
router.post('/billing/appointments/bills', requireInternal, async (req, res) => {
  const parsed = internalCreateAppointmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const { appointmentId, patientId, doctorId, amount } = parsed.data;
  const snapshot = await lookupPatientSnapshot(patientId);

  const bill = await Bill.create({
    billType: 'APPOINTMENT',
    referenceId: appointmentId,
    patientId,
    patientName: snapshot.patientName,
    patientEmail: snapshot.patientEmail,
    doctorId,
    amount,
    status: 'PENDING_PAYMENT',
  });

  return res.status(201).json({ billId: bill._id.toString(), bill });
});

/**
 * POST /billing/lab/bills
 * Internal: create a bill for a lab request.
 */
router.post('/billing/lab/bills', requireInternal, async (req, res) => {
  const parsed = internalCreateLabSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const { labRequestId, patientId, doctorId, amount } = parsed.data;
  const snapshot = await lookupPatientSnapshot(patientId);

  const bill = await Bill.create({
    billType: 'LAB',
    referenceId: labRequestId,
    patientId,
    patientName: snapshot.patientName,
    patientEmail: snapshot.patientEmail,
    doctorId,
    amount,
    status: 'PENDING_PAYMENT',
  });

  return res.status(201).json({ billId: bill._id.toString(), bill });
});

/**
 * POST /billing/appointments/:appointmentId/upload-slip
 * Patient uploads payment slip (bank transfer).
 */
router.post(
  '/billing/appointments/:appointmentId/upload-slip',
  requireAuth,
  requireRole('PATIENT'),
  upload,
  async (req, res) => {
    const appointmentId = req.params.appointmentId;
    const slip = getSlipFile(req);
    if (!slip) return res.status(400).json({ message: 'Missing file' });

    let bill = await ensureAppointmentBill({
      appointmentId,
      patientId: req.user.userId,
      authHeader: req.headers.authorization,
    });

    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    if (bill.status !== 'PENDING_PAYMENT') return res.status(409).json({ message: `Cannot upload slip when bill is ${bill.status}` });

    bill.paymentMethod = 'BANK_TRANSFER';
    bill.paymentSlipUrl = slipUrl(slip.filename);
    bill.paymentSlipFileName = slip.filename;
    bill.status = 'PENDING_PAYMENT';
    await bill.save();

    return res.json({ ok: true, bill });
  }
);

/**
 * PUT /billing/appointments/:appointmentId/verify
 * Admin verifies payment. If verified, billing triggers appointment confirmation.
 */
router.put('/billing/appointments/:appointmentId/verify', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const appointmentId = req.params.appointmentId;
  const parsed = verifySchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const { verified, method } = parsed.data;

  const bill = await Bill.findOne({ billType: 'APPOINTMENT', referenceId: appointmentId });
  if (!bill) return res.status(404).json({ message: 'Bill not found' });

  if (!verified) {
    bill.status = 'REJECTED';
    await bill.save();
    return res.json({ ok: true, bill });
  }

  bill.status = 'PAID';
  bill.paymentMethod = method || 'PHYSICAL';
  bill.verifiedAt = new Date();
  bill.verifiedByAdminId = req.user.userId;
  await bill.save();

  // Confirm appointment in Appointment Service.
  await axios.put(
    `${config.appointmentServiceBaseUrl}/appointments/confirm/${appointmentId}`,
    {},
    { headers: { 'x-internal-token': config.internalServiceToken }, timeout: 10000 }
  );

  return res.json({ ok: true, bill });
});

/**
 * POST /billing/lab/:labRequestId/upload-slip
 * Patient uploads lab payment slip (bank transfer).
 */
router.post(
  '/billing/lab/:labRequestId/upload-slip',
  requireAuth,
  requireRole('PATIENT'),
  upload,
  async (req, res) => {
    const labRequestId = req.params.labRequestId;
    const slip = getSlipFile(req);
    if (!slip) return res.status(400).json({ message: 'Missing file' });

    const bill = await Bill.findOne({
      billType: 'LAB',
      referenceId: labRequestId,
      patientId: req.user.userId,
    });

    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    if (bill.status !== 'PENDING_PAYMENT') return res.status(409).json({ message: `Cannot upload slip when bill is ${bill.status}` });

    bill.paymentMethod = 'BANK_TRANSFER';
    bill.paymentSlipUrl = slipUrl(slip.filename);
    bill.paymentSlipFileName = slip.filename;
    bill.status = 'PENDING_PAYMENT';
    await bill.save();

    return res.json({ ok: true, bill });
  }
);

/**
 * PUT /billing/lab/:labRequestId/verify
 * Admin verifies lab payment. If verified, billing triggers lab payment confirmation.
 */
router.put('/billing/lab/:labRequestId/verify', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const labRequestId = req.params.labRequestId;
  const parsed = verifySchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const { verified, method } = parsed.data;

  const bill = await Bill.findOne({ billType: 'LAB', referenceId: labRequestId });
  if (!bill) return res.status(404).json({ message: 'Bill not found' });

  if (!verified) {
    bill.status = 'REJECTED';
    await bill.save();
    return res.json({ ok: true, bill });
  }

  bill.status = 'PAID';
  bill.paymentMethod = method || 'PHYSICAL';
  bill.verifiedAt = new Date();
  bill.verifiedByAdminId = req.user.userId;
  await bill.save();

  await axios.put(
    `${config.labServiceBaseUrl}/lab/confirm-payment/${labRequestId}`,
    {},
    { headers: { 'x-internal-token': config.internalServiceToken }, timeout: 10000 }
  );

  return res.json({ ok: true, bill });
});

/**
 * GET /billing/admin/bills
 * Admin views all bills.
 */
router.get('/billing/admin/bills', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const bills = await Bill.find().sort({ createdAt: -1 }).lean();
  return res.json({ bills });
});

/**
 * POST /billing/admin/bills/:id/email
 * Admin emails bill details to the patient.
 */
router.post('/billing/admin/bills/:id/email', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const bill = await Bill.findById(req.params.id).lean();
  if (!bill) return res.status(404).json({ message: 'Bill not found' });

  const { patient, doctorProfile, related } = await lookupBillContext(bill, req.headers.authorization);
  if (!patient?.email) {
    return res.status(400).json({ message: 'Patient email is not available for this bill' });
  }

  const subject = `Billing details for ${bill.billType === 'APPOINTMENT' ? 'appointment' : 'lab'} ${bill.referenceId}`;
  const { text, html } = buildBillEmailContent(bill, patient, doctorProfile, related);

  try {
    const info = await sendBillingEmail({
      to: patient.email,
      subject,
      text,
      html,
    });
    return res.json({ ok: true, messageId: info.messageId || null });
  } catch (err) {
    if (err.code === 'EMAIL_NOT_CONFIGURED') {
      return res.status(503).json({ message: 'Email is not configured on the billing service' });
    }
    return res.status(500).json({ message: 'Failed to send email' });
  }
});

/**
 * GET /billing/patient/bills
 * Patient views their bills.
 */
router.get('/billing/patient/bills', requireAuth, requireRole('PATIENT'), async (req, res) => {
  const bills = await Bill.find({ patientId: req.user.userId }).sort({ createdAt: -1 }).lean();
  return res.json({ bills });
});

module.exports = router;


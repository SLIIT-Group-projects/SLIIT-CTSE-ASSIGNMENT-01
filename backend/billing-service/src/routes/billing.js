const express = require('express');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { z } = require('zod');

const Bill = require('../models/Bill');
const { requireAuth, requireInternal, requireRole } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

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
    // Allow common slip formats
    const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    if (!ok) return cb(new Error('Only PDF/images are allowed'));
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

function getSlipFile(req) {
  const f = (req.files && (req.files.slip?.[0] || req.files.file?.[0])) || null;
  return f;
}

function slipUrl(filename) {
  // Frontend can use the same origin when running behind one gateway; for local dev it's OK to return relative.
  return config.publicServiceBaseUrl ? `${config.publicServiceBaseUrl}/uploads/${filename}` : `/uploads/${filename}`;
}

/**
 * POST /billing/appointments/bills
 * Internal: create a bill for an appointment.
 */
router.post('/billing/appointments/bills', requireInternal, async (req, res) => {
  const parsed = internalCreateAppointmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const { appointmentId, patientId, doctorId, amount } = parsed.data;

  const bill = await Bill.create({
    billType: 'APPOINTMENT',
    referenceId: appointmentId,
    patientId,
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

  const bill = await Bill.create({
    billType: 'LAB',
    referenceId: labRequestId,
    patientId,
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

    const bill = await Bill.findOne({
      billType: 'APPOINTMENT',
      referenceId: appointmentId,
      patientId: req.user.userId,
    });

    if (!bill) return res.status(404).json({ message: 'Bill not found' });

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
 * GET /billing/patient/bills
 * Patient views their bills.
 */
router.get('/billing/patient/bills', requireAuth, requireRole('PATIENT'), async (req, res) => {
  const bills = await Bill.find({ patientId: req.user.userId }).sort({ createdAt: -1 }).lean();
  return res.json({ bills });
});

module.exports = router;


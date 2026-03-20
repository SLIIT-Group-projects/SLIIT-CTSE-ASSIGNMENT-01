const express = require('express');
const axios = require('axios');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { z } = require('zod');

const LabRequest = require('../models/LabRequest');
const { requireAuth, requireRole, requireInternal } = require('../middleware/auth');
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
    const ok =
      file.mimetype === 'application/pdf' ||
      file.mimetype.startsWith('image/');
    if (!ok) return cb(new Error('Only PDF/images are allowed'));
    return cb(null, true);
  },
});

/**
 * POST /lab/requests
 * Internal endpoint called by doctor-service. Creates lab request and its bill.
 */
router.post('/lab/requests', requireInternal, async (req, res) => {
  const schema = z.object({
    appointmentId: z.string().min(1),
    patientId: z.string().min(1),
    doctorId: z.string().min(1),
    testName: z.string().min(2).max(200),
    notes: z.string().max(20000).optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const { appointmentId, patientId, doctorId, testName, notes } = parsed.data;

  const labRequest = await LabRequest.create({
    appointmentId,
    patientId,
    doctorId,
    testName,
    notes,
    paymentStatus: 'PENDING_PAYMENT',
  });

  // Create the lab bill in Billing Service.
  const billResp = await axios.post(
    `${config.billingServiceBaseUrl}/billing/lab/bills`,
    {
      labRequestId: labRequest._id.toString(),
      appointmentId,
      patientId,
      doctorId,
      amount: config.defaultLabAmount,
    },
    {
      headers: {
        'x-internal-token': config.internalServiceToken,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  const { billId } = billResp.data || {};
  if (billId) {
    labRequest.billingBillId = billId;
    await labRequest.save();
  }

  return res.status(201).json({ labRequest, bill: billResp.data || null });
});

/**
 * PUT /lab/confirm-payment/:id
 * Internal endpoint called by Billing Service after payment verification.
 */
router.put('/lab/confirm-payment/:id', requireInternal, async (req, res) => {
  const labRequest = await LabRequest.findById(req.params.id);
  if (!labRequest) return res.status(404).json({ message: 'Lab request not found' });
  if (labRequest.paymentStatus !== 'PENDING_PAYMENT') return res.status(409).json({ message: 'Payment already confirmed' });

  labRequest.paymentStatus = 'PAID';
  await labRequest.save();
  return res.json({ ok: true, labRequest });
});

/**
 * GET /lab/requests
 * LAB_TECH view of lab requests.
 */
router.get('/lab/requests', requireAuth, requireRole('LAB_TECH'), async (req, res) => {
  const requests = await LabRequest.find().sort({ createdAt: -1 }).lean();
  return res.json({ labRequests: requests });
});

/**
 * POST /lab/requests/:id/report
 * Upload lab report (only if payment is confirmed).
 */
router.post('/lab/requests/:id/report', requireAuth, requireRole('LAB_TECH'), upload.single('report'), async (req, res) => {
  const labRequest = await LabRequest.findById(req.params.id);
  if (!labRequest) return res.status(404).json({ message: 'Lab request not found' });
  if (labRequest.paymentStatus !== 'PAID') return res.status(403).json({ message: 'Payment not confirmed yet' });

  if (!req.file) return res.status(400).json({ message: 'Missing report file' });

  const filename = req.file.filename;
  const reportUrl = config.publicServiceBaseUrl ? `${config.publicServiceBaseUrl}/uploads/${filename}` : `/uploads/${filename}`;

  labRequest.reportUrl = reportUrl;
  labRequest.reportFileName = filename;
  await labRequest.save();

  return res.json({ ok: true, labRequest });
});

/**
 * GET /lab/reports
 * Patient can view lab reports.
 */
router.get('/lab/reports', requireAuth, requireRole('PATIENT'), async (req, res) => {
  const requests = await LabRequest.find({
    patientId: req.user.userId,
    reportUrl: { $ne: null },
  })
    .sort({ createdAt: -1 })
    .lean();

  return res.json({ labReports: requests.map((r) => ({ id: r._id, appointmentId: r.appointmentId, testName: r.testName, reportUrl: r.reportUrl, createdAt: r.createdAt })) });
});

module.exports = router;


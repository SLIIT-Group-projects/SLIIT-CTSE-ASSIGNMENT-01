const express = require('express');
const axios = require('axios');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const mongoose = require('mongoose');
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
    const ok = file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/');
    if (!ok) return cb(new Error('Only PDF/images are allowed'));
    return cb(null, true);
  },
});

function handleMulterUpload(mw) {
  return (req, res, next) => {
    mw(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File too large (max 10MB)' });
        }
        return res.status(400).json({ message: err.message });
      }
      if (err) return res.status(400).json({ message: err.message || 'Invalid file' });
      return next();
    });
  };
}

function buildRequestsQuery(query) {
  const filter = {};
  if (query.paymentStatus === 'PAID' || query.paymentStatus === 'PENDING_PAYMENT') {
    filter.paymentStatus = query.paymentStatus;
  }
  if (query.hasReport === 'yes') filter.reportUrl = { $ne: null };
  if (query.hasReport === 'no') filter.reportUrl = null;

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const or = [{ testName: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }];
    if (mongoose.Types.ObjectId.isValid(search) && String(search).length === 24) {
      or.push({ patientId: search });
    }
    filter.$or = or;
  }
  return filter;
}

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
    labStatus: 'QUEUED',
    priority: 'NORMAL',
  });

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
 * @openapi
 * /lab/requests:
 *   get:
 *     summary: LAB_TECH list lab requests (optional filters)
 *     security: [ { bearerAuth: [] } ]
 */
router.get('/lab/requests', requireAuth, requireRole('LAB_TECH'), async (req, res) => {
  const filter = buildRequestsQuery(req.query);
  const requests = await LabRequest.find(filter).sort({ priority: -1, createdAt: -1 }).lean();
  const normalized = requests.map((r) => ({
    ...r,
    labStatus: r.labStatus || 'QUEUED',
    priority: r.priority || 'NORMAL',
  }));
  return res.json({ labRequests: normalized });
});

/**
 * @openapi
 * /lab/requests/{id}/status:
 *   put:
 *     summary: LAB_TECH move request between QUEUED and IN_PROGRESS (requires PAID)
 */
router.put('/lab/requests/:id/status', requireAuth, requireRole('LAB_TECH'), async (req, res) => {
  const bodySchema = z.object({
    status: z.enum(['QUEUED', 'IN_PROGRESS']),
  });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body', errors: parsed.error.flatten() });

  const labRequest = await LabRequest.findById(req.params.id);
  if (!labRequest) return res.status(404).json({ message: 'Lab request not found' });
  if (labRequest.paymentStatus !== 'PAID') {
    return res.status(403).json({ message: 'Payment must be confirmed before processing' });
  }
  if (labRequest.reportUrl && parsed.data.status === 'IN_PROGRESS') {
    return res.status(409).json({ message: 'Report already uploaded; use replace upload flow' });
  }

  const next = parsed.data.status;
  const current = labRequest.labStatus || 'QUEUED';

  if (next === 'IN_PROGRESS') {
    if (current !== 'QUEUED') return res.status(409).json({ message: `Cannot start from ${current}` });
    labRequest.labStatus = 'IN_PROGRESS';
  } else if (next === 'QUEUED') {
    if (current !== 'IN_PROGRESS') return res.status(409).json({ message: `Cannot reset from ${current}` });
    labRequest.labStatus = 'QUEUED';
  }

  await labRequest.save();
  return res.json({ ok: true, labRequest });
});

/**
 * @openapi
 * /lab/requests/{id}:
 *   patch:
 *     summary: LAB_TECH set priority (NORMAL / URGENT)
 */
router.patch('/lab/requests/:id', requireAuth, requireRole('LAB_TECH'), async (req, res) => {
  const bodySchema = z.object({
    priority: z.enum(['NORMAL', 'URGENT']),
  });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body', errors: parsed.error.flatten() });

  const labRequest = await LabRequest.findById(req.params.id);
  if (!labRequest) return res.status(404).json({ message: 'Lab request not found' });

  labRequest.priority = parsed.data.priority;
  await labRequest.save();
  return res.json({ ok: true, labRequest });
});

/**
 * @openapi
 * /lab/requests/{id}/report:
 *   post:
 *     summary: Upload lab report (PDF/image). First upload requires IN_PROGRESS; replacement when COMPLETED.
 */
router.post(
  '/lab/requests/:id/report',
  requireAuth,
  requireRole('LAB_TECH'),
  handleMulterUpload(upload.single('report')),
  async (req, res) => {
    const remarksSchema = z.string().max(500).optional().default('');
    const remarksParsed = remarksSchema.safeParse(req.body?.remarks ?? '');
    if (!remarksParsed.success) return res.status(400).json({ message: 'Invalid remarks' });

    const labRequest = await LabRequest.findById(req.params.id);
    if (!labRequest) return res.status(404).json({ message: 'Lab request not found' });
    if (labRequest.paymentStatus !== 'PAID') return res.status(403).json({ message: 'Payment not confirmed yet' });

    if (!req.file) return res.status(400).json({ message: 'Missing report file' });

    const currentStatus = labRequest.labStatus || 'QUEUED';
    const isReplacement = Boolean(labRequest.reportUrl);

    if (!isReplacement) {
      if (currentStatus !== 'IN_PROGRESS') {
        return res.status(403).json({ message: 'Mark request as In progress before uploading' });
      }
    } else {
      if (currentStatus !== 'COMPLETED') {
        return res.status(409).json({ message: 'Invalid state for report replacement' });
      }
      labRequest.replacedAt = new Date();
    }

    const filename = req.file.filename;
    const base = String(config.publicServiceBaseUrl || '').replace(/\/$/, '');
    const reportUrl = `${base}/uploads/${filename}`;

    labRequest.reportUrl = reportUrl;
    labRequest.reportFileName = filename;
    labRequest.reportRemarks = remarksParsed.data;
    labRequest.labStatus = 'COMPLETED';
    labRequest.uploadedAt = new Date();
    labRequest.uploadedBy = req.user.userId;
    // Stub: in production, enqueue email/SMS/push to patient
    labRequest.patientNotified = true;

    await labRequest.save();

    return res.json({ ok: true, labRequest });
  }
);

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

  return res.json({
    labReports: requests.map((r) => ({
      id: r._id,
      appointmentId: r.appointmentId,
      testName: r.testName,
      reportUrl: r.reportUrl,
      reportRemarks: r.reportRemarks || '',
      uploadedAt: r.uploadedAt,
      createdAt: r.createdAt,
    })),
  });
});

/**
 * GET /lab/internal/doctor-reports/:doctorId
 * Internal endpoint for doctor-service to fetch completed reports of one doctor.
 */
router.get('/lab/internal/doctor-reports/:doctorId', requireInternal, async (req, res) => {
  const doctorId = String(req.params.doctorId || '').trim();
  if (!doctorId) return res.status(400).json({ message: 'doctorId is required' });

  const requests = await LabRequest.find({
    doctorId,
    reportUrl: { $ne: null },
    labStatus: 'COMPLETED',
  })
    .sort({ uploadedAt: -1, createdAt: -1 })
    .lean();

  return res.json({
    labReports: requests.map((r) => ({
      id: r._id.toString(),
      appointmentId: r.appointmentId,
      patientId: r.patientId,
      doctorId: r.doctorId,
      testName: r.testName,
      reportUrl: r.reportUrl,
      reportRemarks: r.reportRemarks || '',
      uploadedAt: r.uploadedAt,
      createdAt: r.createdAt,
      paymentStatus: r.paymentStatus,
      labStatus: r.labStatus || 'COMPLETED',
    })),
  });
});

module.exports = router;

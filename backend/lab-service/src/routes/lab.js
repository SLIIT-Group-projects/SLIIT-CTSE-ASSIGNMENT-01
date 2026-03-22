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
const { sendLabReportReadyEmail } = require('../lib/mail');

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

function buildRequestsQuery(query, patientIdsFromNameSearch = []) {
  const filter = {};

  if (['QUEUED', 'IN_PROGRESS', 'COMPLETED'].includes(query.labStatus)) {
    filter.labStatus = query.labStatus;
  }

  if (query.priority === 'URGENT' || query.priority === 'NORMAL') {
    filter.priority = query.priority;
  }

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const or = [{ testName: new RegExp(escaped, 'i') }];
    if (mongoose.Types.ObjectId.isValid(search) && String(search).length === 24) {
      or.push({ patientId: search });
    }
    const validNameIds = patientIdsFromNameSearch.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validNameIds.length) {
      or.push({ patientId: { $in: validNameIds } });
    }
    filter.$or = or;
  }
  return filter;
}

async function fetchPatientIdsMatchingName(search) {
  const q = String(search || '').trim();
  if (q.length < 2) return [];
  try {
    const base = String(config.authServiceBaseUrl || '').replace(/\/$/, '');
    const resp = await axios.get(`${base}/auth/internal/patients/search`, {
      params: { q },
      headers: { 'x-internal-token': config.internalServiceToken },
      timeout: 10000,
    });
    return Array.isArray(resp.data.ids) ? resp.data.ids : [];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('lab-service: auth patient name search failed', err.response?.data || err.message);
    return [];
  }
}

/**
 * Resolve patient name + email via auth-service (internal bulk API).
 */
async function fetchPatientUsersByIds(ids) {
  const unique = [...new Set(ids.map((id) => String(id)).filter(Boolean))];
  if (unique.length === 0) return new Map();
  try {
    const base = String(config.authServiceBaseUrl || '').replace(/\/$/, '');
    const resp = await axios.post(
      `${base}/auth/users/bulk`,
      { ids: unique },
      {
        headers: {
          'x-internal-token': config.internalServiceToken,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    const map = new Map();
    for (const u of resp.data.users || []) {
      if (u && u.id) {
        map.set(String(u.id), { name: u.name || '', email: u.email || '' });
      }
    }
    return map;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('lab-service: auth users/bulk failed', err.response?.data || err.message);
    return new Map();
  }
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
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  let namePatientIds = [];
  if (search.length >= 2) {
    namePatientIds = await fetchPatientIdsMatchingName(search);
  }
  const filter = buildRequestsQuery(req.query, namePatientIds);
  const sortDir = req.query.sort === 'oldest' ? 1 : -1;
  const requests = await LabRequest.find(filter).sort({ createdAt: sortDir }).lean();
  const userMap = await fetchPatientUsersByIds(requests.map((r) => r.patientId));
  const normalized = requests.map((r) => {
    const pid = String(r.patientId);
    const u = userMap.get(pid);
    return {
      ...r,
      labStatus: r.labStatus || 'QUEUED',
      priority: r.priority || 'NORMAL',
      patientName: u?.name || null,
      patientEmail: u?.email || null,
    };
  });
  return res.json({ labRequests: normalized });
});

/**
 * GET /lab/dashboard/summary
 * LAB_TECH aggregate counts (not affected by list filters).
 */
router.get('/lab/dashboard/summary', requireAuth, requireRole('LAB_TECH'), async (req, res) => {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const noReport = { $or: [{ reportUrl: null }, { reportUrl: '' }, { reportUrl: { $exists: false } }] };
  const hasReport = { reportUrl: { $exists: true, $nin: [null, ''] } };

  const [openWorkQueue, completedThisWeek, urgentOpen, pendingPayment] = await Promise.all([
    LabRequest.countDocuments(noReport),
    LabRequest.countDocuments({
      ...hasReport,
      uploadedAt: { $gte: weekAgo },
    }),
    LabRequest.countDocuments({ ...noReport, priority: 'URGENT' }),
    LabRequest.countDocuments({ paymentStatus: 'PENDING_PAYMENT' }),
  ]);

  let oldestOpenHours = null;
  const oldest = await LabRequest.findOne(noReport).sort({ createdAt: 1 }).select('createdAt').lean();
  if (oldest?.createdAt) {
    oldestOpenHours = Math.floor((now.getTime() - new Date(oldest.createdAt).getTime()) / (1000 * 60 * 60));
  }

  return res.json({
    openWorkQueue,
    completedThisWeek,
    urgentOpen,
    pendingPayment,
    oldestOpenHours,
  });
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
 * POST /lab/requests/:id/notify-email
 * LAB_TECH emails the patient a link to the completed report (uses auth user email).
 */
router.post('/lab/requests/:id/notify-email', requireAuth, requireRole('LAB_TECH'), async (req, res) => {
  const labRequest = await LabRequest.findById(req.params.id);
  if (!labRequest) return res.status(404).json({ message: 'Lab request not found' });
  if (!labRequest.reportUrl) return res.status(400).json({ message: 'No report uploaded yet' });
  if ((labRequest.labStatus || 'QUEUED') !== 'COMPLETED') {
    return res.status(400).json({ message: 'Report must be completed before notifying' });
  }

  const userMap = await fetchPatientUsersByIds([labRequest.patientId]);
  const patient = userMap.get(String(labRequest.patientId));
  if (!patient?.email) return res.status(400).json({ message: 'Could not resolve patient email' });

  const viewUrl = /^https?:\/\//i.test(String(labRequest.reportUrl))
    ? labRequest.reportUrl
    : `${String(config.publicServiceBaseUrl || '').replace(/\/$/, '')}${labRequest.reportUrl}`;

  const mailResult = await sendLabReportReadyEmail({
    to: patient.email,
    patientName: patient.name,
    testName: labRequest.testName,
    viewUrl,
  });

  if (!mailResult.ok) {
    return res.status(502).json({ message: mailResult.error || 'Email failed' });
  }

  labRequest.emailNotifiedAt = new Date();
  await labRequest.save();

  return res.json({ ok: true, labRequest, mail: mailResult });
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

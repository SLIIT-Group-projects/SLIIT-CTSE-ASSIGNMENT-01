const express = require('express');
const axios = require('axios');
const { z } = require('zod');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Appointment = require('../models/Appointment');
const DoctorSchedule = require('../models/DoctorSchedule');
const { requireAuth, requireRole, requireInternal } = require('../middleware/auth');
const config = require('../config');
const { addMinutesToHHMM, buildSlotsForRange, normalizeDateString, toMinutes } = require('../utils/timeSlots');
const uploadPaymentSlip = require('../middleware/uploadPaymentSlip');

const router = express.Router();
const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'previous-reports');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext || '.bin';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

function allowImageOrPdf(file) {
  const mime = (file.mimetype || '').toLowerCase();
  const name = (file.originalname || '').toLowerCase();
  if (mime === 'application/pdf') return true;
  if (mime.startsWith('image/')) return true;
  if (mime === 'application/octet-stream' || mime === '') {
    return /\.(jpe?g|png|gif|webp|heic|heif|bmp|tif|tiff|pdf)$/i.test(name);
  }
  return false;
}

const uploadReport = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowImageOrPdf(file)) return cb(new Error('Only PDF or image files are allowed'));
    return cb(null, true);
  },
});

const scheduleSchema = z.object({
  slots: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        start: z.string().regex(/^\d{2}:\d{2}$/),
        end: z.string().regex(/^\d{2}:\d{2}$/),
        plannedPatientCount: z.number().int().min(1).optional(),
      })
    )
    .min(1),
});

async function resolveAppointmentAmount(doctorId, authHeader) {
  try {
    const resp = await axios.get(`${config.doctorServiceBaseUrl}/doctor/profiles`, {
      params: { ids: doctorId },
      headers: { Authorization: authHeader },
      timeout: 10000,
    });
    const profile = resp.data?.profiles?.[0];
    const charge = Number(profile?.consultationCharge);
    if (Number.isFinite(charge) && charge >= 0) return charge;
  } catch {
    // Fallback to default amount when doctor profile is unavailable.
  }
  return config.defaultAppointmentAmount;
}

function minutesForRange(range) {
  return Math.max(toMinutes(range.end) - toMinutes(range.start), 0);
}

function rangeContainsStart(range, slotStart) {
  const s = toMinutes(slotStart);
  return s >= toMinutes(range.start) && s < toMinutes(range.end);
}

/**
 * GET /doctor/schedule
 * Doctor fetches current weekly available time ranges.
 */
router.get('/doctor/schedule', requireAuth, requireRole('DOCTOR'), async (req, res) => {
  const doctorId = req.user.userId;
  const schedule = await DoctorSchedule.findOne({ doctorId }).lean();
  if (!schedule) return res.json({ hasSchedule: false, schedule: null });
  return res.json({ hasSchedule: true, schedule });
});

/**
 * POST /doctor/schedule
 * Doctors define weekly available time ranges (initial setup only).
 */
router.post('/doctor/schedule', requireAuth, requireRole('DOCTOR'), async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const doctorId = req.user.userId;
  const { slots } = parsed.data;

  const exists = await DoctorSchedule.exists({ doctorId });
  if (exists) {
    return res
      .status(409)
      .json({ message: 'Weekly schedule already exists. Use update endpoint to edit your schedule.' });
  }

  await DoctorSchedule.create({ doctorId, slots });
  return res.status(201).json({ ok: true, created: true });
});

/**
 * PUT /doctor/schedule
 * Doctors edit an existing weekly schedule.
 */
router.put('/doctor/schedule', requireAuth, requireRole('DOCTOR'), async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const doctorId = req.user.userId;
  const { slots } = parsed.data;

  const updated = await DoctorSchedule.findOneAndUpdate(
    { doctorId },
    { $set: { slots } },
    { new: true }
  );
  if (!updated) return res.status(404).json({ message: 'Weekly schedule not found. Create it first.' });

  return res.json({ ok: true, updated: true, schedule: updated });
});

/**
 * GET /doctors
 * Returns doctor IDs that have a weekly schedule configured.
 * This keeps the demo simple (no separate "doctor directory" service).
 */
router.get('/doctors', requireAuth, async (req, res) => {
  const doctorIds = await DoctorSchedule.find().distinct('doctorId');
  return res.json({ doctors: doctorIds });
});

/**
 * GET /doctors/:doctorId/available-slots?date=YYYY-MM-DD
 * Patients can view available slots based on schedules and existing bookings.
 */
router.get('/doctors/:doctorId/available-slots', requireAuth, requireRole('PATIENT'), async (req, res) => {
  const date = normalizeDateString(req.query.date);
  if (!date) return res.status(400).json({ message: 'Invalid date format (expected YYYY-MM-DD)' });

  const doctorId = req.params.doctorId;
  const schedule = await DoctorSchedule.findOne({ doctorId }).lean();
  if (!schedule) return res.json({ date, slots: [] });

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  const daySlots = schedule.slots.filter((s) => s.dayOfWeek === dayOfWeek);

  const availableSlots = [];
  for (const range of daySlots) {
    availableSlots.push(...buildSlotsForRange(range, config.slotMinutes).map((slot) => ({ ...slot, range })));
  }

  const existing = await Appointment.find({
    doctorId,
    date,
    status: { $in: ['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED'] },
  }).select('startTime');

  const bookedStartTimes = new Set(existing.map((a) => a.startTime));
  const freeSlots = [];
  for (const range of daySlots) {
    const slotsForRange = buildSlotsForRange(range, config.slotMinutes).filter((s) => !bookedStartTimes.has(s.start));
    const bookedInRange = existing.filter((a) => rangeContainsStart(range, a.startTime)).length;
    const plannedCount =
      Number.isInteger(range.plannedPatientCount) && range.plannedPatientCount > 0
        ? range.plannedPatientCount
        : buildSlotsForRange(range, config.slotMinutes).length;
    const remaining = Math.max(plannedCount - bookedInRange, 0);
    freeSlots.push(...slotsForRange.slice(0, remaining));
  }

  return res.json({ date, slots: freeSlots });
});

/**
 * GET /appointments/quote?doctorId=...&date=YYYY-MM-DD&slotStart=HH:MM
 * Patient preview before confirming booking.
 */
router.get('/appointments/quote', requireAuth, requireRole('PATIENT'), async (req, res) => {
  const schema = z.object({
    doctorId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    slotStart: z.string().regex(/^\d{2}:\d{2}$/),
  });
  const parsed = schema.safeParse(req.query || {});
  if (!parsed.success) return res.status(400).json({ message: 'Invalid query', errors: parsed.error.flatten() });

  const { doctorId, date, slotStart } = parsed.data;

  const schedule = await DoctorSchedule.findOne({ doctorId }).lean();
  if (!schedule) return res.status(400).json({ message: 'Doctor has no schedule' });

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  const dayRanges = schedule.slots.filter((s) => s.dayOfWeek === dayOfWeek);
  const availableSlots = [];
  for (const range of dayRanges) {
    availableSlots.push(...buildSlotsForRange(range, config.slotMinutes).map((slot) => ({ ...slot, range })));
  }

  const requested = availableSlots.find((s) => s.start === slotStart);
  if (!requested) return res.status(400).json({ message: 'Requested slot is not available' });

  const exists = await Appointment.findOne({ doctorId, date, startTime: slotStart });
  if (exists) return res.status(409).json({ message: 'Slot already booked' });

  const amount = await resolveAppointmentAmount(doctorId, req.headers.authorization);
  const matchedRange = requested.range;
  const durationMinutes = minutesForRange(matchedRange);
  const slotsForDuration = Math.max(Math.floor(durationMinutes / config.slotMinutes), 1);
  const totalPatientsPlanned =
    Number.isInteger(matchedRange?.plannedPatientCount) && matchedRange.plannedPatientCount > 0
      ? matchedRange.plannedPatientCount
      : slotsForDuration;

  const currentCount = await Appointment.countDocuments({
    doctorId,
    date,
    startTime: {
      $gte: matchedRange.start,
      $lt: matchedRange.end,
    },
    status: { $in: ['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED'] },
  });
  if (currentCount >= totalPatientsPlanned) {
    return res.status(409).json({ message: 'Planned patient limit reached for this doctor session' });
  }
  const patientNumber = currentCount + 1;
  const remainingPatientCount = Math.max(totalPatientsPlanned - patientNumber, 0);
  const effectivePatientCount = Math.max(totalPatientsPlanned, 1);
  const estimatedTimeMinutes = Math.max(Math.round(durationMinutes / effectivePatientCount), 1);
  const estimatedWaitMinutes = Math.max((patientNumber - 1) * estimatedTimeMinutes, 0);
  const estimatedAppointmentTime = addMinutesToHHMM(matchedRange.start, estimatedWaitMinutes);

  return res.json({
    quote: {
      amount,
      currency: 'LKR',
      patientNumber,
      remainingPatientCount,
      estimatedTimeMinutes,
      estimatedWaitMinutes,
      estimatedAppointmentTime,
      totalPatientsPlanned,
      sessionDurationMinutes: durationMinutes,
      slotsForDuration,
      requiredAppointmentTimeMinutes: config.slotMinutes,
      slot: requested,
      doctorId,
      date,
    },
  });
});

/**
 * POST /appointments
 * Create an appointment with status PENDING_PAYMENT and request a bill from Billing Service.
 */
router.post('/appointments', requireAuth, requireRole('PATIENT'), async (req, res) => {
  const schema = z.object({
    doctorId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    slotStart: z.string().regex(/^\d{2}:\d{2}$/),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const { doctorId, date, slotStart } = parsed.data;
  const patientId = req.user.userId;
  const authHeader = req.headers.authorization;

  const schedule = await DoctorSchedule.findOne({ doctorId });
  if (!schedule) return res.status(400).json({ message: 'Doctor has no schedule' });

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  const dayRanges = schedule.slots.filter((s) => s.dayOfWeek === dayOfWeek);

  const availableSlots = [];
  for (const r of dayRanges) {
    availableSlots.push(...buildSlotsForRange(r, config.slotMinutes).map((slot) => ({ ...slot, range: r })));
  }
  const requested = availableSlots.find((s) => s.start === slotStart);
  if (!requested) return res.status(400).json({ message: 'Requested slot is not available' });

  const exists = await Appointment.findOne({ doctorId, date, startTime: slotStart });
  if (exists) return res.status(409).json({ message: 'Slot already booked' });

  const matchedRange = requested.range;
  const durationMinutes = minutesForRange(matchedRange);
  const slotsForDuration = Math.max(Math.floor(durationMinutes / config.slotMinutes), 1);
  const totalPatientsPlanned =
    Number.isInteger(matchedRange?.plannedPatientCount) && matchedRange.plannedPatientCount > 0
      ? matchedRange.plannedPatientCount
      : slotsForDuration;
  const currentCount = await Appointment.countDocuments({
    doctorId,
    date,
    startTime: {
      $gte: matchedRange.start,
      $lt: matchedRange.end,
    },
    status: { $in: ['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED'] },
  });
  if (currentCount >= totalPatientsPlanned) {
    return res.status(409).json({ message: 'Planned patient limit reached for this doctor session' });
  }
  const patientNumber = currentCount + 1;
  const remainingPatientCount = Math.max(totalPatientsPlanned - patientNumber, 0);
  const effectivePatientCount = Math.max(totalPatientsPlanned, 1);
  const estimatedTimeMinutes = Math.max(Math.round(durationMinutes / effectivePatientCount), 1);
  const estimatedWaitMinutes = Math.max((patientNumber - 1) * estimatedTimeMinutes, 0);
  const estimatedAppointmentTime = addMinutesToHHMM(matchedRange.start, estimatedWaitMinutes);

  const amount = await resolveAppointmentAmount(doctorId, authHeader);

  const appointment = await Appointment.create({
    patientId,
    doctorId,
    date,
    startTime: requested.start,
    endTime: requested.end,
    status: 'PENDING_PAYMENT',
    patientNumber,
    remainingPatientCount,
    estimatedTimeMinutes,
    estimatedWaitMinutes,
    estimatedAppointmentTime,
  });

  // Create the bill in Billing Service.
  const billResp = await axios.post(
    `${config.billingServiceBaseUrl}/billing/appointments/bills`,
    {
      appointmentId: appointment._id.toString(),
      patientId,
      doctorId,
      amount,
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
    appointment.billingBillId = billId;
    await appointment.save();
  }

  return res.status(201).json({ appointment, bill: billResp.data || null });
});

/**
 * POST /appointments/:id/previous-reports
 * Patient adds prior medical reports/notes for the appointment.
 */
router.post('/appointments/:id/previous-reports', requireAuth, requireRole('PATIENT'), async (req, res) => {
  const schema = z.object({
    title: z.string().trim().min(2).max(160),
    summary: z.string().max(4000).optional().default(''),
    reportUrl: z.string().url().max(2048).optional().or(z.literal('')).default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
  if (appointment.patientId.toString() !== req.user.userId) return res.status(403).json({ message: 'Forbidden' });

  appointment.previousReports.push({
    title: parsed.data.title,
    summary: parsed.data.summary,
    reportUrl: parsed.data.reportUrl,
  });
  await appointment.save();

  return res.status(201).json({ ok: true, appointment });
});

/**
 * POST /appointments/:id/previous-reports/upload
 * Patient uploads a previous report file (PDF/image) for doctor review.
 */
router.post(
  '/appointments/:id/previous-reports/upload',
  requireAuth,
  requireRole('PATIENT'),
  uploadReport.single('report'),
  async (req, res) => {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
    if (appointment.patientId.toString() !== req.user.userId) return res.status(403).json({ message: 'Forbidden' });
    if (!req.file) return res.status(400).json({ message: 'Report file is required' });

    const reportUrl = `${config.publicServiceBaseUrl}/uploads/previous-reports/${req.file.filename}`;
    appointment.previousReports.push({
      title: req.file.originalname || 'Uploaded report',
      summary: '',
      reportUrl,
    });
    await appointment.save();
    return res.status(201).json({ ok: true, appointment });
  }
);

/**
 * POST /appointments/:id/payment-slip
 * Patient uploads payment slip after billing
 */
router.post(
  '/appointments/:id/payment-slip',
  requireAuth,
  requireRole('PATIENT'),
  uploadPaymentSlip.single('paymentSlip'),
  async (req, res) => {

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment)
      return res.status(404).json({ message: 'Appointment not found' });

    if (appointment.patientId.toString() !== req.user.userId)
      return res.status(403).json({ message: 'Forbidden' });

    if (!req.file)
      return res.status(400).json({ message: 'Payment slip required' });

    const paymentSlipUrl =
      `${config.publicServiceBaseUrl}/uploads/payment-slips/${req.file.filename}`;

    return res.status(201).json({
      message: "Payment slip uploaded",
      paymentSlipUrl
    });
  }
);

/**
 * PUT /appointments/confirm/:id
 * Internal endpoint called by Billing Service after payment verification.
 */
router.put('/appointments/confirm/:id', requireInternal, async (req, res) => {
  const appointmentId = req.params.id;
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
  if (appointment.status !== 'PENDING_PAYMENT') return res.status(409).json({ message: `Cannot confirm from status ${appointment.status}` });

  appointment.status = 'CONFIRMED';
  await appointment.save();
  return res.json({ ok: true, appointment });
});

/**
 * PUT /appointments/:id/complete
 * Mark appointment as completed after consultation (Doctor Service will call this).
 */
router.put('/appointments/:id/complete', requireAuth, requireRole('DOCTOR'), async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
  if (appointment.doctorId.toString() !== req.user.userId) return res.status(403).json({ message: 'Forbidden' });
  if (appointment.status !== 'CONFIRMED') return res.status(409).json({ message: `Cannot complete from status ${appointment.status}` });

  appointment.status = 'COMPLETED';
  await appointment.save();
  return res.json({ ok: true, appointment });
});

/**
 * GET /patients/appointments
 * Patient view of appointments by status.
 */
router.get('/patients/appointments', requireAuth, requireRole('PATIENT'), async (req, res) => {
  const appointments = await Appointment.find({ patientId: req.user.userId }).sort({ date: 1, startTime: 1 }).lean();
  return res.json({ appointments });
});

/**
 * GET /doctor/appointments
 * Doctor view of confirmed appointments only.
 */
router.get('/doctor/appointments', requireAuth, requireRole('DOCTOR'), async (req, res) => {
  const doctorId = req.user.userId;
  const appointments = await Appointment.find({
    doctorId,
    status: 'CONFIRMED',
  }).sort({ date: 1, startTime: 1 }).lean();

  return res.json({ appointments });
});

/**
 * GET /appointments/:id
 * Shared for doctor and patient to view appointment details.
 */
router.get('/appointments/:id', requireAuth, async (req, res) => {
  const appointment = await Appointment.findById(req.params.id).lean();
  if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

  const role = req.user.role;
  if (role === 'PATIENT' && appointment.patientId.toString() !== req.user.userId) return res.status(403).json({ message: 'Forbidden' });
  if (role === 'DOCTOR' && appointment.doctorId.toString() !== req.user.userId) return res.status(403).json({ message: 'Forbidden' });

  return res.json({ appointment });
});

module.exports = router;


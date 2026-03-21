const express = require('express');
const axios = require('axios');
const { z } = require('zod');

const ClinicalRecord = require('../models/ClinicalRecord');
const DoctorProfile = require('../models/DoctorProfile');
const { requireAuth, requireRole } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

function normalizeId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.$oid) return String(value.$oid);
  if (typeof value === 'object' && value._bsontype === 'ObjectId') return value.toString();
  if (typeof value === 'object' && value._id && value._id !== value) return normalizeId(value._id);
  try {
    return String(value);
  } catch {
    return '';
  }
}

const clinicalSchema = z.object({
  notes: z.string().max(20000).optional().default(''),
  prescription: z.string().max(20000).optional().default(''),
});

const doctorProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  workingHospital: z.string().trim().min(2).max(160),
  speciality: z.string().trim().min(2).max(120),
  consultationCharge: z.number().min(0).max(1000000),
  bio: z.string().max(2000).optional().default(''),
  phone: z.string().max(40).optional().default(''),
});

const patientMedicalSchema = z.object({
  age: z.number().int().min(0).max(130),
  heightCm: z.number().min(30).max(300),
  weightKg: z.number().min(1).max(500),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
});

/**
 * GET /doctor/profiles
 * Patient reads doctor profiles (optionally filtered by doctor IDs).
 * Query:
 *   - ids=comma,separated,doctorIds
 */
router.get('/doctor/profiles', requireAuth, requireRole('PATIENT'), async (req, res) => {
  const idsRaw = String(req.query.ids || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const ids = idsRaw.filter((id) => /^[a-fA-F0-9]{24}$/.test(id));

  const query = ids.length > 0 ? { doctorId: { $in: ids } } : {};
  const profiles = await DoctorProfile.find(query).sort({ updatedAt: -1 }).lean();

  return res.json({
    profiles: profiles.map((p) => ({
      doctorId: p.doctorId.toString(),
      name: p.name,
      workingHospital: p.workingHospital,
      speciality: p.speciality,
      consultationCharge:
        typeof p.consultationCharge === 'number' && Number.isFinite(p.consultationCharge)
          ? p.consultationCharge
          : 500,
      bio: p.bio || '',
      phone: p.phone || '',
      updatedAt: p.updatedAt,
    })),
  });
});

/**
 * GET /doctor/profile
 * Doctor reads own profile details.
 */
router.get('/doctor/profile', requireAuth, requireRole('DOCTOR'), async (req, res) => {
  const profile = await DoctorProfile.findOne({ doctorId: req.user.userId }).lean();
  return res.json({ profile });
});

/**
 * PUT /doctor/profile
 * Doctor creates/updates own profile details.
 */
router.put('/doctor/profile', requireAuth, requireRole('DOCTOR'), async (req, res) => {
  const parsed = doctorProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const payload = parsed.data;
  const profile = await DoctorProfile.findOneAndUpdate(
    { doctorId: req.user.userId },
    {
      doctorId: req.user.userId,
      name: payload.name,
      workingHospital: payload.workingHospital,
      speciality: payload.speciality,
      consultationCharge: payload.consultationCharge,
      bio: payload.bio,
      phone: payload.phone,
    },
    { new: true, upsert: true }
  );

  return res.json({ profile });
});

/**
 * GET /doctor/appointments
 * Doctor views confirmed appointments.
 */
router.get('/doctor/appointments', requireAuth, requireRole('DOCTOR'), async (req, res) => {
  const authHeader = req.headers.authorization;
  const resp = await axios.get(`${config.appointmentServiceBaseUrl}/doctor/appointments`, {
    headers: { Authorization: authHeader },
    timeout: 10000,
  });
  const appointments = resp.data?.appointments || [];

  // Enrich patient details for doctor UI.
  const patientIds = [...new Set(appointments.map((a) => normalizeId(a.patientId)).filter(Boolean))];
  let patientMap = {};
  if (patientIds.length > 0) {
    try {
      const usersResp = await axios.post(
        `${config.authServiceBaseUrl}/auth/users/bulk`,
        { ids: patientIds },
        {
          headers: {
            'x-internal-token': config.internalServiceToken,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
      const users = usersResp.data?.users || [];
      patientMap = Object.fromEntries(users.map((u) => [normalizeId(u.id), u]));
    } catch {
      // Keep endpoint resilient; UI can still show patientId fallback.
      patientMap = {};
    }
  }

  const enriched = appointments.map((a) => ({
    ...a,
    patient: patientMap[normalizeId(a.patientId)] || null,
  }));

  return res.json({ appointments: enriched });
});

/**
 * PUT /doctor/patients/:id/medical
 * Doctor updates patient medical details in Auth Service.
 */
router.put('/doctor/patients/:id/medical', requireAuth, requireRole('DOCTOR'), async (req, res) => {
  const parsed = patientMedicalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const resp = await axios.put(
    `${config.authServiceBaseUrl}/auth/users/${req.params.id}/medical`,
    parsed.data,
    {
      headers: {
        'x-internal-token': config.internalServiceToken,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  return res.json(resp.data);
});

/**
 * PUT /doctor/appointments/:id/clinical
 * Doctor adds notes and prescription; only allowed for CONFIRMED appointments.
 * Then marks appointment as COMPLETED via appointment-service.
 */
router.put('/doctor/appointments/:id/clinical', requireAuth, requireRole('DOCTOR'), async (req, res) => {
  const parsed = clinicalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const appointmentId = req.params.id;
  const authHeader = req.headers.authorization;

  const apptResp = await axios.get(`${config.appointmentServiceBaseUrl}/appointments/${appointmentId}`, {
    headers: { Authorization: authHeader },
    timeout: 10000,
  });

  const appointment = apptResp.data.appointment;
  if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
  if (appointment.doctorId.toString() !== req.user.userId) return res.status(403).json({ message: 'Forbidden' });
  if (appointment.status !== 'CONFIRMED') return res.status(409).json({ message: `Cannot attend status ${appointment.status}` });

  const payload = parsed.data;
  const record = await ClinicalRecord.findOneAndUpdate(
    { appointmentId },
    {
      appointmentId,
      doctorId: req.user.userId,
      patientId: appointment.patientId,
      notes: payload.notes,
      prescription: payload.prescription,
    },
    { new: true, upsert: true }
  );

  // Mark completed.
  const completeResp = await axios.put(
    `${config.appointmentServiceBaseUrl}/appointments/${appointmentId}/complete`,
    {},
    { headers: { Authorization: authHeader }, timeout: 10000 }
  );

  return res.json({ clinical: record, appointment: completeResp.data.appointment || completeResp.data });
});

/**
 * POST /doctor/appointments/:id/lab-request
 * Doctor requests lab tests for a confirmed appointment.
 */
router.post('/doctor/appointments/:id/lab-request', requireAuth, requireRole('DOCTOR'), async (req, res) => {
  const schema = z.object({
    testName: z.string().min(2).max(200),
    notes: z.string().max(20000).optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const appointmentId = req.params.id;
  const authHeader = req.headers.authorization;

  const apptResp = await axios.get(`${config.appointmentServiceBaseUrl}/appointments/${appointmentId}`, {
    headers: { Authorization: authHeader },
    timeout: 10000,
  });
  const appointment = apptResp.data.appointment;

  if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
  if (appointment.doctorId.toString() !== req.user.userId) return res.status(403).json({ message: 'Forbidden' });
  if (appointment.status !== 'CONFIRMED') return res.status(409).json({ message: `Lab requests only allowed after CONFIRMED, got ${appointment.status}` });

  const labResp = await axios.post(
    `${config.labServiceBaseUrl}/lab/requests`,
    {
      appointmentId,
      patientId: appointment.patientId.toString(),
      doctorId: appointment.doctorId.toString(),
      testName: parsed.data.testName,
      notes: parsed.data.notes,
    },
    {
      headers: {
        'x-internal-token': config.internalServiceToken,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  return res.status(201).json(labResp.data);
});

/**
 * GET /doctor/history
 * Doctor views previously updated clinical records with patient details.
 */
router.get('/doctor/history', requireAuth, requireRole('DOCTOR'), async (req, res) => {
  const records = await ClinicalRecord.find({ doctorId: req.user.userId }).sort({ createdAt: -1 }).lean();

  const patientIds = [...new Set(records.map((r) => normalizeId(r.patientId)).filter(Boolean))];
  let patientMap = {};
  if (patientIds.length > 0) {
    try {
      const usersResp = await axios.post(
        `${config.authServiceBaseUrl}/auth/users/bulk`,
        { ids: patientIds },
        {
          headers: {
            'x-internal-token': config.internalServiceToken,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
      const users = usersResp.data?.users || [];
      patientMap = Object.fromEntries(users.map((u) => [normalizeId(u.id), u]));
    } catch {
      patientMap = {};
    }
  }

  return res.json({
    records: records.map((r) => ({
      id: r._id.toString(),
      appointmentId: normalizeId(r.appointmentId),
      patientId: normalizeId(r.patientId),
      patient: patientMap[normalizeId(r.patientId)] || null,
      notes: r.notes || '',
      prescription: r.prescription || '',
      consultedAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  });
});

/**
 * GET /doctor/lab-reports
 * Doctor views completed lab reports created from their requested tests.
 */
router.get('/doctor/lab-reports', requireAuth, requireRole('DOCTOR'), async (req, res) => {
  const doctorId = req.user.userId;

  const labResp = await axios.get(`${config.labServiceBaseUrl}/lab/internal/doctor-reports/${doctorId}`, {
    headers: {
      'x-internal-token': config.internalServiceToken,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });

  const reports = labResp.data?.labReports || [];
  const userIds = [...new Set([doctorId, ...reports.map((r) => normalizeId(r.patientId)).filter(Boolean)])];

  let userMap = {};
  if (userIds.length > 0) {
    try {
      const usersResp = await axios.post(
        `${config.authServiceBaseUrl}/auth/users/bulk`,
        { ids: userIds },
        {
          headers: {
            'x-internal-token': config.internalServiceToken,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
      const users = usersResp.data?.users || [];
      userMap = Object.fromEntries(users.map((u) => [normalizeId(u.id), u]));
    } catch {
      userMap = {};
    }
  }

  return res.json({
    labReports: reports.map((r) => ({
      ...r,
      patient: userMap[normalizeId(r.patientId)] || null,
      doctor: userMap[normalizeId(r.doctorId)] || null,
    })),
  });
});

/**
 * GET /doctor/clinical/patient
 * Patient views prescriptions (clinical records).
 */
router.get('/doctor/clinical/patient', requireAuth, requireRole('PATIENT'), async (req, res) => {
  const records = await ClinicalRecord.find({ patientId: req.user.userId })
    .sort({ createdAt: -1 })
    .lean();
  return res.json({ clinical: records });
});

module.exports = router;


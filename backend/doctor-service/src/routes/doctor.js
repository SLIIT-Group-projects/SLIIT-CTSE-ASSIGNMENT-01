const express = require('express');
const axios = require('axios');
const { z } = require('zod');

const ClinicalRecord = require('../models/ClinicalRecord');
const DoctorProfile = require('../models/DoctorProfile');
const { requireAuth, requireRole } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

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


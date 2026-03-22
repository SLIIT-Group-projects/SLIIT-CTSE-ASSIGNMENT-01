const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const User = require('../models/User');
const { requireAuth, requireRole, requireInternal } = require('../middleware/auth');
const { jwtSecret, jwtExpiresIn } = require('../config');

const router = express.Router();

const roles = ['PATIENT', 'DOCTOR', 'LAB_TECH', 'ADMIN'];
const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(150),
  password: z.string().min(8).max(256),
  role: z.enum(roles),
  medicalProfile: z
    .object({
      age: z.number().int().min(0).max(130),
      heightCm: z.number().min(30).max(300),
      weightKg: z.number().min(1).max(500),
      bloodGroup: z.enum(bloodGroups),
    })
    .optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(150),
  password: z.string().min(1).max(256),
});

/**
 * POST /auth/register
 * Create a new user (patient/doctor/lab tech/admin).
 */
router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const { name, email, password, role, medicalProfile } = parsed.data;

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ message: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    passwordHash,
    role,
    medicalProfile: role === 'PATIENT' ? medicalProfile : undefined,
  });

  return res.status(201).json({ id: user._id, role: user.role, name: user.name });
});

/**
 * POST /auth/login
 * Authenticate and return a JWT.
 */
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, jwtSecret, {
    expiresIn: jwtExpiresIn,
  });

  return res.json({
    token,
    user: { id: user._id, role: user.role, name: user.name, email: user.email },
  });
});

/**
 * POST /auth/verify
 * Verify JWT and return authenticated user + role.
 */
router.post('/verify', requireAuth, async (req, res) => {
  const { userId, role } = req.user;
  const user = await User.findById(userId).select('_id name email role medicalProfile');
  if (!user) return res.status(401).json({ message: 'User not found' });
  return res.json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role,
      medicalProfile: user.medicalProfile || null,
    },
  });
});

// Convenience for service debugging (not used by the frontend).
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.userId).select('_id name email role');
  if (!user) return res.status(404).json({ message: 'Not found' });
  return res.json({ user });
});

/**
 * Example protected endpoint for swagger/testing:
 * GET /auth/admin/ping
 */
router.get('/admin/ping', requireAuth, requireRole('ADMIN'), (req, res) => res.json({ ok: true }));

/**

 * GET /auth/internal/patients/search?q=
 * Internal: patient user ids whose name matches (for lab dashboard search, etc.).
 */
router.get('/internal/patients/search', requireInternal, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ ids: [] });
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(safe, 'i');
  const users = await User.find({ role: 'PATIENT', name: regex }).select('_id').limit(100).lean();
  return res.json({ ids: users.map((u) => u._id.toString()) });
});

/**
 * POST /auth/users/lookup
 * Admin: resolve user ids to names (billing review UI).
 */
router.post('/users/lookup', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const schema = z.object({
    ids: z.array(z.string().min(1)).max(200),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const ids = parsed.data.ids;
  const users = await User.find({ _id: { $in: ids } }).select('_id name email role').lean();
  return res.json({
    users: users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
    })),
  });

});

/**
 * POST /auth/users/bulk
 * Internal endpoint for service-to-service user lookup.
 */
router.post('/users/bulk', requireInternal, async (req, res) => {
  const schema = z.object({
    ids: z.array(z.string().min(1)).max(200),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const ids = parsed.data.ids;
  const users = await User.find({ _id: { $in: ids } }).select('_id name email role medicalProfile').lean();
  return res.json({
    users: users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      medicalProfile: u.medicalProfile || null,
    })),
  });
});

/**
 * PUT /auth/users/:id/medical
 * Internal endpoint to update patient medical details.
 */
router.put('/users/:id/medical', requireInternal, async (req, res) => {
  const schema = z.object({
    age: z.number().int().min(0).max(130),
    heightCm: z.number().min(30).max(300),
    weightKg: z.number().min(1).max(500),
    bloodGroup: z.enum(bloodGroups),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.role !== 'PATIENT') return res.status(400).json({ message: 'Medical profile is only applicable for PATIENT role' });

  user.medicalProfile = parsed.data;
  await user.save();
  return res.json({ ok: true, user: { id: user._id.toString(), medicalProfile: user.medicalProfile } });
});

module.exports = router;


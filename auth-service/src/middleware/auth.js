const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (!token) return res.status(401).json({ message: 'Missing Bearer token' });

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = { userId: payload.sub, role: payload.role };
    return next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return function roleMiddleware(req, res, next) {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
    return next();
  };
}

module.exports = { requireAuth, requireRole };


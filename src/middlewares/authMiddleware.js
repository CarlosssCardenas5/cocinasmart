'use strict';
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const { AppError, asyncHandler } = require('./errorMiddleware');

function readToken(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

async function loadUser(token) {
  let payload;
  try { payload = jwt.verify(token, env.JWT_SECRET); }
  catch { throw new AppError(401, 'Sesión inválida o expirada. Inicia sesión de nuevo.', 'AUTH'); }
  const user = await User.findById(payload.sub);
  if (!user || !user.active) throw new AppError(401, 'Cuenta no disponible.', 'AUTH');
  return user;
}

const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = readToken(req);
  if (!token) throw new AppError(401, 'Necesitas iniciar sesión.', 'AUTH');
  req.user = await loadUser(token);
  next();
});

// Para rutas públicas que se enriquecen si hay sesión (p. ej. alertas de alérgenos).
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = readToken(req);
  if (token) { try { req.user = await loadUser(token); } catch { /* se ignora: ruta pública */ } }
  next();
});

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

module.exports = { requireAuth, optionalAuth, signToken };

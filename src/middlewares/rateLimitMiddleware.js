'use strict';
const rateLimit = require('express-rate-limit');

const make = (opts) => rateLimit({
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({
    ok: false, code: 'RATE_LIMIT', message: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
  }),
  ...opts,
});

// Límite general por IP para toda la API.
const apiLimiter = make({ windowMs: 15 * 60 * 1000, limit: 400 });
// Fuerza bruta en login/registro: solo cuentan los intentos fallidos.
const authLimiter = make({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true });
// Endpoints que consumen Gemini: por usuario (requireAuth debe ir antes).
const geminiLimiter = make({
  windowMs: 60 * 60 * 1000, limit: 20,
  keyGenerator: (req) => `u:${req.user ? req.user.id : 'anon'}`,
});

module.exports = { apiLimiter, authLimiter, geminiLimiter };

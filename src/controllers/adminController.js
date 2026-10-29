'use strict';
const { z } = require('zod');
const User = require('../models/User');
const ApiUsageLog = require('../models/ApiUsageLog');
const ApiCache = require('../models/ApiCache');
const { AppError, asyncHandler } = require('../middlewares/errorMiddleware');

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, q } = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().max(60).optional(),
  }).parse(req.query);
  const filter = q ? { $or: [{ name: new RegExp(escapeRe(q), 'i') }, { email: new RegExp(escapeRe(q), 'i') }] } : {};
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ ok: true, page, limit, total, users });
});

const setUserActive = asyncHandler(async (req, res) => {
  const { active } = z.object({ active: z.boolean() }).strict().parse(req.body);
  if (String(req.user._id) === req.params.id) throw new AppError(400, 'No puedes desactivar tu propia cuenta.', 'VALIDATION');
  const user = await User.findByIdAndUpdate(req.params.id, { active }, { new: true });
  if (!user) throw new AppError(404, 'Usuario no encontrado.', 'NOT_FOUND');
  res.json({ ok: true, user });
});

const usage = asyncHandler(async (req, res) => {
  const { days } = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) }).parse(req.query);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const rows = await ApiUsageLog.aggregate([
    { $match: { time: { $gte: since } } },
    { $group: {
      _id: { provider: '$provider', endpoint: '$endpoint' },
      total: { $sum: 1 },
      cacheHits: { $sum: { $cond: ['$cacheHit', 1, 0] } },
      errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
      stale: { $sum: { $cond: [{ $eq: ['$status', 'stale'] }, 1, 0] } },
      fallbacks: { $sum: { $cond: [{ $eq: ['$status', 'fallback'] }, 1, 0] } },
      avgLatencyMs: { $avg: '$latencyMs' },
    } },
    { $sort: { '_id.provider': 1, total: -1 } },
  ]);
  const cacheEntries = await ApiCache.aggregate([{ $group: { _id: '$provider', entries: { $sum: 1 } } }]);
  res.json({
    ok: true, days,
    usage: rows.map((r) => ({ provider: r._id.provider, endpoint: r._id.endpoint, total: r.total, cacheHits: r.cacheHits, errors: r.errors, stale: r.stale, fallbacks: r.fallbacks, avgLatencyMs: Math.round(r.avgLatencyMs || 0) })),
    cacheEntries: cacheEntries.map((c) => ({ provider: c._id, entries: c.entries })),
  });
});

const clearCache = asyncHandler(async (req, res) => {
  const { provider } = z.object({ provider: z.enum(['themealdb', 'openfoodfacts', 'gemini']).optional() }).parse(req.query);
  const r = await ApiCache.deleteMany(provider ? { provider } : {});
  res.json({ ok: true, deleted: r.deletedCount, provider: provider || 'todos' });
});

module.exports = { listUsers, setUserActive, usage, clearCache };

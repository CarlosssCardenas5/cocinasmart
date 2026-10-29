'use strict';
const MealPlan = require('../models/MealPlan');
const PantryItem = require('../models/PantryItem');
const ApiUsageLog = require('../models/ApiUsageLog');
const env = require('../config/env');
const gemini = require('../services/geminiService');
const fallback = require('../services/planFallbackService');
const { logUsage } = require('../services/cacheService');
const { AppError, asyncHandler } = require('../middlewares/errorMiddleware');
const schemas = require('../validators/planSchemas');

const getPlan = asyncHandler(async (req, res) => {
  const weekStart = schemas.weekStart.parse(req.params.weekStart);
  const plan = await MealPlan.findOne({ userId: req.user._id, weekStart }).lean();
  res.json({ ok: true, plan: plan || { weekStart, entries: [] } });
});

const putPlan = asyncHandler(async (req, res) => {
  const weekStart = schemas.weekStart.parse(req.params.weekStart);
  const { entries } = schemas.putPlan.parse(req.body);
  const plan = await MealPlan.findOneAndUpdate(
    { userId: req.user._id, weekStart },
    { $set: { entries }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: true },
  );
  res.json({ ok: true, plan });
});

async function geminiUsedToday(userId) {
  return ApiUsageLog.countDocuments({
    userId, provider: 'gemini', endpoint: 'plans/generate',
    status: { $in: ['ok', 'error', 'invalid'] },
    time: { $gte: new Date(Date.now() - 24 * 3600 * 1000) },
  });
}

/**
 * POST /api/plans/generate
 *  1) Se arma un "pool" de recetas reales de TheMealDB ya filtradas por dieta/alergias.
 *  2) Gemini ordena el menú SOLO con esos IDs; se valida con Zod y contra el pool.
 *  3) Si Gemini falla, se acaba la cuota diaria/RPM o no hay red => planFallbackService (reglas locales).
 */
const generate = asyncHandler(async (req, res) => {
  const { weekStart, useAI } = schemas.generate.parse(req.body);
  const prefs = req.user.preferences.toObject ? req.user.preferences.toObject() : req.user.preferences;
  const pantry = await PantryItem.find({ userId: req.user._id }).select('name').lean();
  const pantryNames = pantry.map((p) => p.name);
  const ctx = { userId: req.user._id };

  let pool = null;
  let entries;
  let source = 'reglas';
  const warnings = [];

  try {
    const built = await fallback.buildPool({ prefs, pantryNames, ctx });
    pool = built.pool;
    if (built.degraded) warnings.push('Algunas recetas provienen de datos guardados porque TheMealDB no respondió.');
  } catch (err) {
    if (err.code !== 'EXTERNAL_UNAVAILABLE') throw err;
    entries = fallback.emergencyPlan(prefs); // lanza 503 amigable si el usuario tiene restricciones
    warnings.push('Sin conexión con el catálogo de recetas: armamos un menú básico de emergencia.');
  }

  if (pool) {
    let aiReason = null;
    if (!useAI) aiReason = 'Elegiste el generador por reglas.';
    else if (await geminiUsedToday(req.user._id) >= env.GEMINI_DAILY_LIMIT_PER_USER) {
      aiReason = `Alcanzaste el límite diario de ${env.GEMINI_DAILY_LIMIT_PER_USER} menús con IA.`;
      logUsage({ userId: req.user._id, provider: 'gemini', endpoint: 'plans/generate', status: 'limit' });
    } else {
      const t0 = Date.now();
      try {
        const ai = await gemini.generatePlan({ pool, prefs });
        const byId = new Map(pool.map((r) => [r.idMeal, r]));
        entries = ai.map((e) => ({ day: e.day, slot: e.slot, idMeal: e.idMeal, name: byId.get(e.idMeal).name, thumbnail: byId.get(e.idMeal).thumbnail, source: 'ia' }));
        source = 'ia';
        logUsage({ userId: req.user._id, provider: 'gemini', endpoint: 'plans/generate', status: 'ok', latencyMs: Date.now() - t0 });
      } catch (err) {
        if (!(err instanceof gemini.GeminiUnavailable)) throw err;
        aiReason = gemini.friendlyReason(err.reason);
        logUsage({ userId: req.user._id, provider: 'gemini', endpoint: 'plans/generate', status: err.reason === 'invalid' ? 'invalid' : 'error', latencyMs: Date.now() - t0 });
      }
    }
    if (aiReason) {
      entries = fallback.arrange(pool, 'reglas');
      logUsage({ userId: req.user._id, provider: 'gemini', endpoint: 'plans/fallback', status: 'fallback' });
      if (useAI) warnings.push(`${aiReason} Generamos tu menú con el método de respaldo por reglas.`);
    }
  }

  const plan = await MealPlan.findOneAndUpdate(
    { userId: req.user._id, weekStart },
    { $set: { entries }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: true },
  );
  res.json({ ok: true, source, warning: warnings.join(' ') || null, plan });
});

module.exports = { getPlan, putPlan, generate };

'use strict';
const env = require('../config/env');
const ApiCache = require('../models/ApiCache');
const ApiUsageLog = require('../models/ApiUsageLog');
const { AppError } = require('../middlewares/errorMiddleware');

const DAY = 24 * 3600 * 1000;

function logUsage({ userId = null, provider, endpoint, status, latencyMs = 0, cacheHit = false }) {
  // Nunca debe romper la petición: se dispara y se ignora cualquier fallo.
  ApiUsageLog.create({ userId, provider, endpoint, status, latencyMs, cacheHit }).catch(() => {});
}

async function readCache(key) {
  try { return await ApiCache.findOne({ key }).lean(); } catch { return null; }
}

async function writeCache(key, provider, payload, ttlMs) {
  const freshUntil = new Date(Date.now() + ttlMs);
  const expiresAt = new Date(freshUntil.getTime() + env.CACHE_STALE_GRACE_DAYS * DAY);
  try {
    await ApiCache.updateOne({ key }, { $set: { provider, payload, freshUntil, expiresAt } }, { upsert: true });
  } catch (err) {
    console.warn('[cache] no se pudo guardar', key, err.message);
  }
}

/**
 * Estrategia: caché fresca -> API externa -> caché vencida (modo degradado) -> error amigable.
 * El `fetcher` debe lanzar AppError(404, ..., 'NOT_FOUND') cuando el recurso no existe (eso NO es una caída).
 * Cualquier otro error (timeout, ECONNREFUSED, 429/5xx, cola saturada, JSON roto) activa la degradación.
 */
async function cached({ key, provider, endpoint, ttlMs, ctx = {}, fetcher }) {
  const t0 = Date.now();
  const doc = await readCache(key);

  if (doc && doc.freshUntil > new Date()) {
    logUsage({ userId: ctx.userId, provider, endpoint, status: 'ok', latencyMs: Date.now() - t0, cacheHit: true });
    return { data: doc.payload, source: 'cache' };
  }

  try {
    const data = await fetcher();
    writeCache(key, provider, data, ttlMs);
    logUsage({ userId: ctx.userId, provider, endpoint, status: 'ok', latencyMs: Date.now() - t0 });
    return { data, source: 'api' };
  } catch (err) {
    if (err.code === 'NOT_FOUND') throw err;
    const reason = err.name === 'AbortError' ? 'timeout' : (err.status ? `HTTP ${err.status}` : (err.cause?.code || err.code || err.message));
    console.warn(`[${provider}] ${endpoint} falló (${reason})`);

    if (doc) {
      logUsage({ userId: ctx.userId, provider, endpoint, status: 'stale', latencyMs: Date.now() - t0, cacheHit: true });
      return {
        data: doc.payload,
        source: 'cache-stale',
        warning: 'El servicio externo no responde. Te mostramos datos guardados anteriormente; pueden no estar actualizados.',
      };
    }

    logUsage({ userId: ctx.userId, provider, endpoint, status: 'error', latencyMs: Date.now() - t0 });
    throw new AppError(
      503,
      'No pudimos conectar con el servicio externo y aún no tenemos datos guardados de esta consulta. Revisa tu conexión e inténtalo de nuevo en unos minutos.',
      'EXTERNAL_UNAVAILABLE',
    );
  }
}

module.exports = { cached, logUsage, readCache, writeCache, DAY };

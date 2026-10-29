'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { store, logs } = require('./helpers/stubs').install();
const { cached } = require('../src/services/cacheService');
const { AppError } = require('../src/middlewares/errorMiddleware');

const base = { key: 'k1', provider: 'themealdb', endpoint: 't', ttlMs: 1000 };
const reset = () => { store.clear(); logs.length = 0; };

test('caché vigente: no llama a la API', async () => {
  reset();
  store.set('k1', { key: 'k1', payload: { a: 1 }, freshUntil: new Date(Date.now() + 5000) });
  let called = false;
  const r = await cached({ ...base, fetcher: async () => { called = true; return {}; } });
  assert.equal(called, false); assert.equal(r.source, 'cache'); assert.deepEqual(r.data, { a: 1 });
});

test('sin caché: consulta la API y guarda el resultado', async () => {
  reset();
  const r = await cached({ ...base, fetcher: async () => ({ b: 2 }) });
  assert.equal(r.source, 'api');
  await new Promise((s) => setTimeout(s, 10));
  assert.deepEqual(store.get('k1').payload, { b: 2 });
});

test('API caída + caché vencida: devuelve dato guardado con aviso', async () => {
  reset();
  store.set('k1', { key: 'k1', payload: { old: true }, freshUntil: new Date(Date.now() - 1000) });
  const r = await cached({ ...base, fetcher: async () => { const e = new Error('connect ECONNREFUSED'); e.code = 'ECONNREFUSED'; throw e; } });
  assert.equal(r.source, 'cache-stale'); assert.deepEqual(r.data, { old: true }); assert.ok(r.warning);
});

test('API caída y sin caché: error 503 amigable (no rompe)', async () => {
  reset();
  await assert.rejects(
    cached({ ...base, fetcher: async () => { const e = new Error('timeout'); e.name = 'AbortError'; throw e; } }),
    (e) => e instanceof AppError && e.status === 503 && e.code === 'EXTERNAL_UNAVAILABLE',
  );
});

test('cuota agotada (HTTP 429) también degrada a caché', async () => {
  reset();
  store.set('k1', { key: 'k1', payload: 'x', freshUntil: new Date(0) });
  const r = await cached({ ...base, fetcher: async () => { const e = new Error('HTTP 429'); e.status = 429; throw e; } });
  assert.equal(r.source, 'cache-stale');
});

test('NOT_FOUND no se trata como caída', async () => {
  reset();
  store.set('k1', { key: 'k1', payload: 'x', freshUntil: new Date(0) });
  await assert.rejects(cached({ ...base, fetcher: async () => { throw new AppError(404, 'no existe', 'NOT_FOUND'); } }), (e) => e.status === 404);
});

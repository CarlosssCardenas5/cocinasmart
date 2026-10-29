'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { RequestQueue } = require('../src/utils/requestQueue');

test('respeta el límite por ventana y encola el excedente', async () => {
  const q = new RequestQueue({ limit: 2, windowMs: 200, maxWaitMs: 2000 });
  const t0 = Date.now();
  const times = await Promise.all([1, 2, 3, 4].map(() => q.schedule(async () => Date.now() - t0)));
  assert.ok(times[0] < 100 && times[1] < 100, 'las dos primeras salen de inmediato');
  assert.ok(times[2] >= 190 && times[3] >= 190, 'las otras esperan a la siguiente ventana');
});

test('rechaza con 429 si espera más de maxWaitMs', async () => {
  const q = new RequestQueue({ limit: 1, windowMs: 1000, maxWaitMs: 100 });
  await q.schedule(async () => 1);
  await assert.rejects(q.schedule(async () => 2), (e) => e.status === 429);
});

test('propaga errores de la tarea', async () => {
  const q = new RequestQueue({ limit: 5 });
  await assert.rejects(q.schedule(async () => { throw new Error('boom'); }), /boom/);
});

'use strict';
// Sustituye env y modelos de Mongoose por dobles en memoria para probar la lógica sin BD ni red.
const path = require('path');
const root = path.join(__dirname, '..', '..', 'src');

function stub(rel, exports) {
  const file = path.join(root, rel);
  require.cache[file] = { id: file, filename: file, loaded: true, exports, children: [], paths: [] };
}

function install() {
  const store = new Map();
  const logs = [];
  stub('config/env.js', {
    CACHE_STALE_GRACE_DAYS: 30, CACHE_TTL_MEALDB_HOURS: 24, CACHE_TTL_OFF_DAYS: 7, HTTP_TIMEOUT_MS: 1000,
    MEALDB_BASE_URL: 'http://mealdb.test', OFF_BASE_URL: 'http://off.test', OFF_USER_AGENT: 'test',
  });
  stub('models/ApiCache.js', {
    findOne: ({ key }) => ({ lean: async () => store.get(key) || null }),
    updateOne: async ({ key }, { $set }) => { store.set(key, { key, ...$set }); },
  });
  stub('models/ApiUsageLog.js', { create: async (d) => { logs.push(d); } });
  return { store, logs };
}

module.exports = { install, stub };

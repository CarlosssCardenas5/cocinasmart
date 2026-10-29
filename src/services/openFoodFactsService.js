'use strict';
const env = require('../config/env');
const { cached } = require('./cacheService');
const { fetchJson } = require('../utils/http');
const { RequestQueue } = require('../utils/requestQueue');
const { AppError } = require('../middlewares/errorMiddleware');

// Límites de Open Food Facts por IP: 15 lecturas/min (producto) y 10 búsquedas/min.
const readQueue = new RequestQueue({ limit: 15, name: 'off-lectura' });
const searchQueue = new RequestQueue({ limit: 10, name: 'off-busqueda' });

const FIELDS = 'code,product_name,brands,nutriscore_grade,nova_group,nutriments,allergens_tags,image_front_small_url';
const ttl = () => env.CACHE_TTL_OFF_DAYS * 24 * 3600 * 1000;
const headers = () => ({ 'User-Agent': env.OFF_USER_AGENT, Accept: 'application/json' });

function normalize(p) {
  const kcal = p.nutriments ? p.nutriments['energy-kcal_100g'] : null;
  const grade = String(p.nutriscore_grade || '').toUpperCase();
  return {
    barcode: String(p.code || ''),
    name: String(p.product_name || '').trim() || '(sin nombre)',
    brand: String(p.brands || '').split(',')[0].trim(),
    nutriScore: /^[A-E]$/.test(grade) ? grade : null,
    nova: Number.isInteger(p.nova_group) ? p.nova_group : null,
    kcalPer100g: typeof kcal === 'number' ? Math.round(kcal) : null,
    allergens: (p.allergens_tags || []).map((t) => String(t).replace(/^[a-z]{2}:/, '')),
    image: /^https:\/\//.test(p.image_front_small_url || '') ? p.image_front_small_url : '',
  };
}

const search = (q, ctx) => cached({
  key: `off:search:${String(q).toLowerCase().trim()}`, provider: 'openfoodfacts', endpoint: 'search', ttlMs: ttl(), ctx,
  fetcher: () => searchQueue.schedule(async () => {
    const url = `${env.OFF_BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=10&fields=${FIELDS}`;
    const j = await fetchJson(url, { headers: headers() });
    return (j.products || []).filter((p) => p.code).map(normalize);
  }),
});

const byBarcode = (barcode, ctx) => {
  if (!/^\d{8,14}$/.test(String(barcode))) throw new AppError(400, 'Código de barras inválido (8 a 14 dígitos).', 'VALIDATION');
  return cached({
    key: `off:product:${barcode}`, provider: 'openfoodfacts', endpoint: 'product', ttlMs: ttl(), ctx,
    fetcher: () => readQueue.schedule(async () => {
      let j;
      try { j = await fetchJson(`${env.OFF_BASE_URL}/api/v2/product/${barcode}.json?fields=${FIELDS}`, { headers: headers() }); }
      catch (err) {
        if (err.status === 404) throw new AppError(404, 'Producto no encontrado en Open Food Facts.', 'NOT_FOUND');
        throw err;
      }
      if (!j.product || j.status === 0) throw new AppError(404, 'Producto no encontrado en Open Food Facts.', 'NOT_FOUND');
      return normalize({ ...j.product, code: j.product.code || barcode });
    }),
  });
};

module.exports = { search, byBarcode, normalize, readQueue, searchQueue };

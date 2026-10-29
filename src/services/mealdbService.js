'use strict';
const env = require('../config/env');
const { cached } = require('./cacheService');
const { fetchJson } = require('../utils/http');
const { parseIngredients } = require('../utils/ingredientParser');
const { AppError } = require('../middlewares/errorMiddleware');

const ttl = () => env.CACHE_TTL_MEALDB_HOURS * 3600 * 1000;
const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, ' ');
const get = (path) => fetchJson(`${env.MEALDB_BASE_URL}/${path}`);
const run = (opts) => cached({ provider: 'themealdb', ttlMs: ttl(), ...opts });

const full = (m) => ({
  idMeal: m.idMeal, name: m.strMeal, category: m.strCategory || '', area: m.strArea || '',
  instructions: m.strInstructions || '', thumbnail: m.strMealThumb || '', youtube: m.strYoutube || '',
  ingredients: parseIngredients(m),
});
const short = (m) => ({ idMeal: m.idMeal, name: m.strMeal, thumbnail: m.strMealThumb || '' });
const list = (j) => (j && Array.isArray(j.meals) ? j.meals : []);

const search = (q, ctx) => run({
  key: `mealdb:search:${norm(q)}`, endpoint: 'search', ctx,
  fetcher: async () => list(await get(`search.php?s=${encodeURIComponent(q)}`)).map(full),
});

// TheMealDB (plan gratuito) filtra por UN solo criterio: c (categoría), a (área) o i (ingrediente).
const filter = ({ c, a, i }, ctx) => {
  const [k, v] = Object.entries({ c, a, i }).find(([, val]) => val) || [];
  if (!k) throw new AppError(400, 'Indica una categoría (c), un área (a) o un ingrediente (i).', 'VALIDATION');
  return run({
    key: `mealdb:filter:${k}:${norm(v)}`, endpoint: 'filter', ctx,
    fetcher: async () => list(await get(`filter.php?${k}=${encodeURIComponent(norm(v).replace(/ /g, '_'))}`)).map(short),
  });
};

const lookup = (idMeal, ctx) => {
  if (!/^\d{3,8}$/.test(String(idMeal))) throw new AppError(400, 'idMeal inválido', 'VALIDATION');
  return run({
    key: `mealdb:lookup:${idMeal}`, endpoint: 'lookup', ctx,
    fetcher: async () => {
      const [m] = list(await get(`lookup.php?i=${idMeal}`));
      return m ? full(m) : null;
    },
  });
};

const categories = (ctx) => run({
  key: 'mealdb:categories', endpoint: 'categories', ctx,
  fetcher: async () => list(await get('list.php?c=list')).map((m) => m.strCategory),
});

module.exports = { search, filter, lookup, categories };

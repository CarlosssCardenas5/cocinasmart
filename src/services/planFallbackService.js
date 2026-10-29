'use strict';
const mealdb = require('./mealdbService');
const { recipeConflicts } = require('./allergenService');
const { normalizeName, toEnglish } = require('../utils/ingredientParser');
const { AppError } = require('../middlewares/errorMiddleware');
const { DAYS, SLOTS } = require('../validators/planSchemas');

const ROTATION = ['Chicken', 'Beef', 'Seafood', 'Pasta', 'Vegetarian', 'Pork', 'Lamb', 'Vegan'];

// Último recurso (TheMealDB caído y sin caché): solo para usuarios SIN dieta ni alergias,
// porque no podemos verificar ingredientes. Verifica estos IDs en TheMealDB antes de publicar.
const EMERGENCY = [
  ['52772', 'Teriyaki Chicken Casserole'], ['52874', 'Beef and Mustard Pie'], ['52959', 'Baked salmon with fennel & tomatoes'],
  ['52771', 'Spicy Arrabiata Penne'], ['52844', 'Lasagne'], ['52977', 'Corba'], ['52940', 'Brown Stew Chicken'],
  ['52795', 'Chicken Handi'], ['52802', 'Fish pie'], ['52785', 'Dal fry'], ['52776', 'Chicken Congee'],
  ['52819', 'Cajun spiced fish tacos'], ['52948', 'Wontons'], ['52773', 'Honey Teriyaki Salmon'],
].map(([idMeal, name]) => ({ idMeal, name, thumbnail: '', category: 'Emergencia', ingredients: [], pantryMatches: 0 }));

function categoriesFor(prefs) {
  const excluded = new Set((prefs.excludedCategories || []).map((c) => c.toLowerCase()));
  const byDiet = {
    vegano: ['Vegan'],
    vegetariano: ['Vegetarian', 'Vegan'],
    pescetariano: ['Seafood', 'Vegetarian', 'Vegan'],
  };
  return (byDiet[prefs.diet] || ROTATION).filter((c) => !excluded.has(c.toLowerCase()));
}

const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

function pantryScore(ingredients, pantryNames) {
  if (!pantryNames.length) return 0;
  const pantry = pantryNames.map((p) => normalizeName(toEnglish(p))).filter((p) => p.length >= 3);
  return ingredients.filter((ing) => {
    const n = normalizeName(ing.name);
    return pantry.some((p) => n.includes(p) || p.includes(n));
  }).length;
}

/**
 * Construye un conjunto de recetas reales de TheMealDB, ya filtradas por dieta, categorías excluidas
 * y alérgenos del usuario. Tanto la IA como las reglas eligen SOLO de aquí => las alergias siempre se respetan.
 */
async function buildPool({ prefs, pantryNames = [], ctx }) {
  const cats = categoriesFor(prefs);
  if (!cats.length) throw new AppError(422, 'Tus categorías excluidas no dejan recetas disponibles. Ajusta tus preferencias.', 'NO_OPTIONS');

  const lists = await Promise.all(cats.map((c) => mealdb.filter({ c }, ctx).catch(() => null)));
  const candidates = lists.flatMap((l, i) => (l ? shuffle(l.data).slice(0, 6).map((m) => ({ ...m, category: cats[i] })) : []));
  if (!candidates.length) throw new AppError(503, 'No pudimos consultar las recetas y no hay datos guardados. Inténtalo en unos minutos.', 'EXTERNAL_UNAVAILABLE');

  let degraded = lists.some((l) => l && l.source === 'cache-stale');
  const details = await mapLimit(candidates, 5, (c) => mealdb.lookup(c.idMeal, ctx).catch(() => null));

  const pool = [];
  details.forEach((d, i) => {
    if (!d || !d.data) return;
    if (d.source === 'cache-stale') degraded = true;
    const r = d.data;
    if (recipeConflicts(r.ingredients, prefs.allergies || []).length) return;
    pool.push({
      idMeal: r.idMeal, name: r.name, thumbnail: r.thumbnail, category: candidates[i].category,
      ingredients: r.ingredients, pantryMatches: pantryScore(r.ingredients, pantryNames),
    });
  });

  if (pool.length < 4) throw new AppError(422, 'Con tus restricciones encontramos muy pocas recetas. Prueba relajando alguna preferencia.', 'NO_OPTIONS');
  return { pool, degraded };
}

// Reglas locales: reparte categorías en rotación y prioriza lo que ya hay en la despensa.
function arrange(pool, source = 'reglas') {
  const groups = new Map();
  for (const r of pool) {
    if (!groups.has(r.category)) groups.set(r.category, []);
    groups.get(r.category).push(r);
  }
  for (const g of groups.values()) g.sort((a, b) => b.pantryMatches - a.pantryMatches);

  const ordered = [];
  const lists = [...groups.values()];
  for (let round = 0; ordered.length < pool.length; round++) {
    for (const g of lists) if (g[round]) ordered.push(g[round]);
  }

  const entries = [];
  let n = 0;
  for (const day of DAYS) {
    for (const slot of SLOTS) {
      const r = ordered[n % ordered.length]; // si hay menos de 14 recetas, se recicla
      n++;
      entries.push({ day, slot, idMeal: r.idMeal, name: r.name, thumbnail: r.thumbnail, source });
    }
  }
  return entries;
}

function emergencyPlan(prefs) {
  const restricted = (prefs.allergies || []).length > 0 || (prefs.diet && prefs.diet !== 'omnivoro') || (prefs.excludedCategories || []).length > 0;
  if (restricted) {
    throw new AppError(503, 'No podemos verificar recetas seguras para tus restricciones sin conexión. Inténtalo más tarde.', 'EXTERNAL_UNAVAILABLE');
  }
  return arrange(EMERGENCY, 'reglas');
}

module.exports = { buildPool, arrange, emergencyPlan, categoriesFor };

'use strict';
const { z } = require('zod');
const mealdb = require('../services/mealdbService');
const gemini = require('../services/geminiService');
const { recipeConflicts } = require('../services/allergenService');
const { toEnglishQuery, toEnglish } = require('../utils/ingredientParser');
const PantryItem = require('../models/PantryItem');
const Favorite = require('../models/Favorite');
const { AppError, asyncHandler } = require('../middlewares/errorMiddleware');

const ctxOf = (req) => ({ userId: req.user ? req.user._id : null });
const wrap = (r, extra = {}) => ({ ok: true, source: r.source, warning: r.warning || null, ...extra });

const search = asyncHandler(async (req, res) => {
  const { q } = z.object({ q: z.string().trim().min(2).max(60) }).parse(req.query);
  const r = await mealdb.search(toEnglishQuery(q), ctxOf(req));
  res.json(wrap(r, { recipes: r.data }));
});

const filter = asyncHandler(async (req, res) => {
  const f = z.object({
    c: z.string().trim().max(40).optional(), a: z.string().trim().max(40).optional(), i: z.string().trim().max(40).optional(),
  }).parse(req.query);
  if (f.i) f.i = toEnglish(f.i);
  const r = await mealdb.filter(f, ctxOf(req));
  res.json(wrap(r, { recipes: r.data }));
});

const categories = asyncHandler(async (req, res) => {
  const r = await mealdb.categories(ctxOf(req));
  res.json(wrap(r, { categories: r.data }));
});

const getRecipe = asyncHandler(async (req, res) => {
  const r = await mealdb.lookup(req.params.idMeal, ctxOf(req));
  if (!r.data) throw new AppError(404, 'Receta no encontrada.', 'NOT_FOUND');
  const conflicts = req.user ? recipeConflicts(r.data.ingredients, req.user.preferences.allergies) : [];
  const isFavorite = req.user ? !!(await Favorite.exists({ userId: req.user._id, idMeal: r.data.idMeal })) : false;
  res.json(wrap(r, { recipe: r.data, conflicts, isFavorite }));
});

// TheMealDB (plan gratuito) filtra por un ingrediente a la vez: consultamos hasta 5 de la despensa y
// ordenamos las recetas por cuántos de esos ingredientes comparten.
const suggestFromPantry = asyncHandler(async (req, res) => {
  const items = await PantryItem.find({ userId: req.user._id }).sort({ addedAt: -1 }).limit(30).lean();
  const names = [...new Set(items.filter((p) => p.type === 'manual').map((p) => toEnglish(p.name)))].slice(0, 5);
  if (!names.length) return res.json({ ok: true, recipes: [], warning: 'Agrega ingredientes manuales a tu despensa para ver sugerencias.' });

  const results = await Promise.all(names.map((i) => mealdb.filter({ i }, ctxOf(req)).catch(() => null)));
  const score = new Map();
  let warning = null;
  results.forEach((r, idx) => {
    if (!r) return;
    if (r.warning) warning = r.warning;
    for (const m of r.data) {
      const cur = score.get(m.idMeal) || { ...m, matches: [] };
      cur.matches.push(names[idx]);
      score.set(m.idMeal, cur);
    }
  });
  if (!results.some(Boolean)) throw new AppError(503, 'No pudimos consultar recetas ahora mismo. Inténtalo más tarde.', 'EXTERNAL_UNAVAILABLE');
  const recipes = [...score.values()].sort((a, b) => b.matches.length - a.matches.length).slice(0, 12);
  res.json({ ok: true, warning, recipes });
});

const translate = asyncHandler(async (req, res) => {
  const r = await mealdb.lookup(req.params.idMeal, ctxOf(req));
  if (!r.data) throw new AppError(404, 'Receta no encontrada.', 'NOT_FOUND');
  try {
    // Solo se envía texto de la receta a Gemini (nunca datos del usuario).
    const t = await gemini.translateRecipe(r.data, ctxOf(req));
    res.json({ ok: true, translated: true, warning: t.warning || null, translation: t.data });
  } catch (err) {
    const reason = err.reason ? gemini.friendlyReason(err.reason) : 'La traducción no está disponible ahora.';
    res.json({
      ok: true, translated: false,
      warning: `${reason} Te mostramos la receta original en inglés.`,
      translation: { name: r.data.name, instructions: r.data.instructions, ingredients: r.data.ingredients },
    });
  }
});

// ---------- Favoritos (montados en /api/favorites) ----------
const favSchema = z.object({
  idMeal: z.string().regex(/^\d{3,8}$/),
  name: z.string().trim().min(1).max(200),
  thumbnail: z.string().max(500).refine((u) => u === '' || /^https:\/\//.test(u)).default(''),
}).strict();

const listFavorites = asyncHandler(async (req, res) => {
  res.json({ ok: true, favorites: await Favorite.find({ userId: req.user._id }).sort({ addedAt: -1 }).lean() });
});

const addFavorite = asyncHandler(async (req, res) => {
  const data = favSchema.parse(req.body);
  const fav = await Favorite.findOneAndUpdate(
    { userId: req.user._id, idMeal: data.idMeal },
    { $setOnInsert: { ...data, userId: req.user._id, addedAt: new Date() } },
    { upsert: true, new: true },
  );
  res.status(201).json({ ok: true, favorite: fav });
});

const removeFavorite = asyncHandler(async (req, res) => {
  await Favorite.deleteOne({ userId: req.user._id, idMeal: String(req.params.idMeal) });
  res.json({ ok: true });
});

module.exports = { search, filter, categories, getRecipe, suggestFromPantry, translate, listFavorites, addFavorite, removeFavorite };

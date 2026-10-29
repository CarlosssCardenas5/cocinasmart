'use strict';
const MealPlan = require('../models/MealPlan');
const PantryItem = require('../models/PantryItem');
const ShoppingList = require('../models/ShoppingList');
const { generateFromPlan } = require('../services/shoppingService');
const { AppError, asyncHandler } = require('../middlewares/errorMiddleware');
const schemas = require('../validators/planSchemas');

const generate = asyncHandler(async (req, res) => {
  const { weekStart } = schemas.generateShopping.parse(req.body);
  const plan = await MealPlan.findOne({ userId: req.user._id, weekStart });
  if (!plan || !plan.entries.length) throw new AppError(422, 'Primero crea o genera el menú de esa semana.', 'NO_PLAN');
  const pantryItems = await PantryItem.find({ userId: req.user._id }).select('name').lean();
  const { list, missingRecipes } = await generateFromPlan({ userId: req.user._id, plan, pantryItems });
  res.status(201).json({
    ok: true, list,
    warning: missingRecipes ? `No pudimos obtener ${missingRecipes} receta(s); su lista puede estar incompleta.` : null,
  });
});

const latest = asyncHandler(async (req, res) => {
  const list = await ShoppingList.findOne({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, list: list || null });
});

const getOne = asyncHandler(async (req, res) => {
  const list = await ShoppingList.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!list) throw new AppError(404, 'Lista no encontrada.', 'NOT_FOUND');
  res.json({ ok: true, list });
});

const patch = asyncHandler(async (req, res) => {
  const { itemId, checked } = schemas.patchShopping.parse(req.body);
  const list = await ShoppingList.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id, 'items._id': itemId },
    { $set: { 'items.$.checked': checked } },
    { new: true },
  );
  if (!list) throw new AppError(404, 'Lista o elemento no encontrado.', 'NOT_FOUND');
  res.json({ ok: true, list });
});

module.exports = { generate, latest, getOne, patch };

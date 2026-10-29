'use strict';
const { z } = require('zod');
const PantryItem = require('../models/PantryItem');
const off = require('../services/openFoodFactsService');
const { productConflicts } = require('../services/allergenService');
const { AppError, asyncHandler } = require('../middlewares/errorMiddleware');

const MAX_ITEMS = 200;

const addSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('manual'), name: z.string().trim().min(2).max(120) }).strict(),
  z.object({
    type: z.literal('packaged'),
    barcode: z.string().regex(/^\d{8,14}$/),
    name: z.string().trim().min(1).max(120).optional(), // respaldo si Open Food Facts no responde
  }).strict(),
]);

const list = asyncHandler(async (req, res) => {
  const items = await PantryItem.find({ userId: req.user._id }).sort({ addedAt: -1 }).lean();
  const allergies = req.user.preferences.allergies;
  res.json({ ok: true, items: items.map((i) => ({ ...i, conflicts: productConflicts(i.allergens, allergies) })) });
});

const add = asyncHandler(async (req, res) => {
  const body = addSchema.parse(req.body);
  if (await PantryItem.countDocuments({ userId: req.user._id }) >= MAX_ITEMS) {
    throw new AppError(422, `Tu despensa alcanzó el máximo de ${MAX_ITEMS} elementos.`, 'LIMIT');
  }

  let data;
  let warning = null;
  if (body.type === 'manual') {
    data = { type: 'manual', name: body.name };
  } else {
    try {
      const r = await off.byBarcode(body.barcode, { userId: req.user._id });
      const p = r.data;
      warning = r.warning || null;
      data = { type: 'packaged', name: p.brand ? `${p.name} (${p.brand})` : p.name, barcode: p.barcode, nutriScore: p.nutriScore, nova: p.nova, kcalPer100g: p.kcalPer100g, allergens: p.allergens };
    } catch (err) {
      // Open Food Facts caído/saturado: se guarda con el nombre dado para no perder el dato.
      if (err.code === 'NOT_FOUND' || !body.name) throw err;
      data = { type: 'packaged', name: body.name, barcode: body.barcode };
      warning = 'No pudimos consultar Open Food Facts; guardamos el producto sin datos nutricionales.';
    }
  }

  const item = await PantryItem.create({ ...data, userId: req.user._id });
  res.status(201).json({ ok: true, warning, item, conflicts: productConflicts(item.allergens, req.user.preferences.allergies) });
});

const remove = asyncHandler(async (req, res) => {
  const r = await PantryItem.deleteOne({ _id: req.params.id, userId: req.user._id });
  if (!r.deletedCount) throw new AppError(404, 'Elemento no encontrado.', 'NOT_FOUND');
  res.json({ ok: true });
});

module.exports = { list, add, remove };

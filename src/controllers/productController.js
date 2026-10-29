'use strict';
const { z } = require('zod');
const off = require('../services/openFoodFactsService');
const { productConflicts } = require('../services/allergenService');
const { asyncHandler } = require('../middlewares/errorMiddleware');

const ctxOf = (req) => ({ userId: req.user ? req.user._id : null });

const search = asyncHandler(async (req, res) => {
  const { q } = z.object({ q: z.string().trim().min(2).max(60) }).parse(req.query);
  const r = await off.search(q, ctxOf(req));
  const allergies = req.user ? req.user.preferences.allergies : [];
  res.json({
    ok: true, source: r.source, warning: r.warning || null,
    products: r.data.map((p) => ({ ...p, conflicts: productConflicts(p.allergens, allergies) })),
  });
});

const getByBarcode = asyncHandler(async (req, res) => {
  const r = await off.byBarcode(req.params.barcode, ctxOf(req));
  const allergies = req.user ? req.user.preferences.allergies : [];
  res.json({
    ok: true, source: r.source, warning: r.warning || null,
    product: r.data, conflicts: productConflicts(r.data.allergens, allergies),
  });
});

module.exports = { search, getByBarcode };

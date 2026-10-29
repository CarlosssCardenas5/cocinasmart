'use strict';
const { Schema, model } = require('mongoose');

const pantrySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['manual', 'packaged'], required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  barcode: { type: String, default: null },
  nutriScore: { type: String, default: null },
  nova: { type: Number, default: null },
  kcalPer100g: { type: Number, default: null },
  allergens: { type: [String], default: [] },
  addedAt: { type: Date, default: Date.now },
});

pantrySchema.index({ userId: 1, name: 1 });

module.exports = model('PantryItem', pantrySchema);

'use strict';
const { Schema, model } = require('mongoose');

const itemSchema = new Schema({
  name: { type: String, required: true, maxlength: 120 },
  quantityText: { type: String, default: '' },
  category: { type: String, default: 'Otros' },
  inPantry: { type: Boolean, default: false },
  checked: { type: Boolean, default: false },
});

const listSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: Schema.Types.ObjectId, ref: 'MealPlan', required: true },
  items: { type: [itemSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

listSchema.index({ userId: 1, createdAt: -1 });

module.exports = model('ShoppingList', listSchema);

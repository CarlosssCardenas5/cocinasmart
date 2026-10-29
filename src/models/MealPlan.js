'use strict';
const { Schema, model } = require('mongoose');

const entrySchema = new Schema({
  day: { type: String, enum: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'], required: true },
  slot: { type: String, enum: ['almuerzo', 'cena'], required: true },
  idMeal: { type: String, required: true },
  name: { type: String, required: true, maxlength: 200 },
  thumbnail: { type: String, default: '' },
  source: { type: String, enum: ['manual', 'ia', 'reglas'], default: 'manual' },
}, { _id: false });

const planSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  weekStart: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // lunes de la semana (YYYY-MM-DD)
  entries: { type: [entrySchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

planSchema.index({ userId: 1, weekStart: 1 }, { unique: true });

module.exports = model('MealPlan', planSchema);

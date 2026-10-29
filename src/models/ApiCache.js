'use strict';
const { Schema, model } = require('mongoose');

// freshUntil = vigencia "lógica" (24 h TheMealDB / 7 días Open Food Facts).
// expiresAt  = borrado físico (TTL de MongoDB) = freshUntil + periodo de gracia.
// Así, si la API externa cae, aún podemos servir el dato vencido (modo degradado).
const cacheSchema = new Schema({
  key: { type: String, required: true },
  provider: { type: String, enum: ['themealdb', 'openfoodfacts', 'gemini'], required: true },
  payload: { type: Schema.Types.Mixed },
  freshUntil: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

cacheSchema.index({ key: 1 }, { unique: true });
cacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = model('ApiCache', cacheSchema);

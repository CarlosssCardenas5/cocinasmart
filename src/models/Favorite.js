'use strict';
const { Schema, model } = require('mongoose');

const favoriteSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  idMeal: { type: String, required: true },
  name: { type: String, required: true, maxlength: 200 },
  thumbnail: { type: String, default: '' },
  addedAt: { type: Date, default: Date.now },
});

favoriteSchema.index({ userId: 1, idMeal: 1 }, { unique: true });

module.exports = model('Favorite', favoriteSchema);

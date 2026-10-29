'use strict';
const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 160 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['usuario', 'administrador'], default: 'usuario' },
  preferences: {
    diet: { type: String, enum: ['omnivoro', 'vegetariano', 'vegano', 'pescetariano'], default: 'omnivoro' },
    allergies: { type: [String], default: [] },
    servings: { type: Number, min: 1, max: 12, default: 2 },
    excludedCategories: { type: [String], default: [] },
  },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

userSchema.index({ email: 1 }, { unique: true });

userSchema.set('toJSON', {
  transform: (_doc, ret) => { delete ret.passwordHash; delete ret.__v; return ret; },
});

module.exports = model('User', userSchema);

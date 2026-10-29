'use strict';
const { Schema, model } = require('mongoose');

const logSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  provider: { type: String, enum: ['themealdb', 'openfoodfacts', 'gemini'], required: true },
  endpoint: { type: String, required: true },
  status: { type: String, required: true }, // ok | stale | error | invalid | fallback
  latencyMs: { type: Number, default: 0 },
  cacheHit: { type: Boolean, default: false },
  time: { type: Date, default: Date.now },
});

logSchema.index({ provider: 1, time: -1 });
logSchema.index({ userId: 1, provider: 1, endpoint: 1, time: -1 });
logSchema.index({ time: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // 90 días

module.exports = model('ApiUsageLog', logSchema);

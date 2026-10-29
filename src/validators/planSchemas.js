'use strict';
const { z } = require('zod');

const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const SLOTS = ['almuerzo', 'cena'];

// weekStart debe ser una fecha real y caer en lunes.
const weekStart = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && d.getUTCDay() === 1;
}, 'weekStart debe ser un lunes válido');

const safeThumb = z.string().max(500).refine((u) => u === '' || /^https:\/\//.test(u), 'Miniatura debe ser https').default('');

const entry = z.object({
  day: z.enum(DAYS),
  slot: z.enum(SLOTS),
  idMeal: z.string().regex(/^\d{3,8}$/),
  name: z.string().trim().min(1).max(200),
  thumbnail: safeThumb,
  source: z.enum(['manual', 'ia', 'reglas']).default('manual'),
}).strict();

const putPlan = z.object({
  entries: z.array(entry).max(DAYS.length * SLOTS.length)
    .refine((arr) => new Set(arr.map((e) => `${e.day}|${e.slot}`)).size === arr.length, 'Hay casillas repetidas'),
}).strict();

const generate = z.object({ weekStart, useAI: z.boolean().default(true) }).strict();

const generateShopping = z.object({ weekStart }).strict();
const patchShopping = z.object({ itemId: z.string().regex(/^[a-f0-9]{24}$/), checked: z.boolean() }).strict();

module.exports = { DAYS, SLOTS, weekStart, putPlan, generate, generateShopping, patchShopping };

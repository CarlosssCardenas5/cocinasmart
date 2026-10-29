'use strict';
const { z } = require('zod');
const { DAYS, SLOTS } = require('./planSchemas');

// Elimina etiquetas HTML, caracteres de control y recorta. Lo que venga de la IA es texto, nunca HTML.
function sanitizeText(value, max = 4000) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/&(lt|gt|amp|quot|#\d+);/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
}

const geminiPlan = z.object({
  entries: z.array(z.object({
    day: z.enum(DAYS),
    slot: z.enum(SLOTS),
    idMeal: z.union([z.string(), z.number()]).transform((v) => String(v)).pipe(z.string().regex(/^\d{3,8}$/)),
  })).min(1).max(DAYS.length * SLOTS.length),
});

const geminiTranslation = z.object({
  name: z.string().min(1).transform((s) => sanitizeText(s, 200)),
  instructions: z.string().min(1).transform((s) => sanitizeText(s, 8000)),
  ingredients: z.array(z.object({
    name: z.string().transform((s) => sanitizeText(s, 120)),
    measure: z.string().default('').transform((s) => sanitizeText(s, 60)),
  })).max(30),
});

module.exports = { sanitizeText, geminiPlan, geminiTranslation };

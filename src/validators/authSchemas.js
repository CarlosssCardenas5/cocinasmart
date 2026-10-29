'use strict';
const { z } = require('zod');

const ALLERGIES = ['gluten', 'lactosa', 'huevo', 'frutos_secos', 'mani', 'pescado', 'mariscos', 'soya', 'sesamo'];

const register = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(8, 'Mínimo 8 caracteres').max(72, 'Máximo 72 caracteres')
    .regex(/[A-Za-z]/, 'Debe incluir una letra').regex(/\d/, 'Debe incluir un número'),
}).strict();

const login = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(1).max(72),
}).strict();

const profileUpdate = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  preferences: z.object({
    diet: z.enum(['omnivoro', 'vegetariano', 'vegano', 'pescetariano']).optional(),
    allergies: z.array(z.enum(ALLERGIES)).max(ALLERGIES.length).optional(),
    servings: z.number().int().min(1).max(12).optional(),
    excludedCategories: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
  }).strict().optional(),
}).strict();

module.exports = { register, login, profileUpdate, ALLERGIES };

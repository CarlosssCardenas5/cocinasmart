'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { install, stub } = require('./helpers/stubs');
install();
// El esquema real usa zod; aquí solo se necesitan las constantes.
stub('validators/planSchemas.js', {
  DAYS: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'],
  SLOTS: ['almuerzo', 'cena'],
});
const { arrange, emergencyPlan, categoriesFor } = require('../src/services/planFallbackService');

const mk = (id, cat, p = 0) => ({ idMeal: String(id), name: `R${id}`, thumbnail: '', category: cat, ingredients: [], pantryMatches: p });

test('arrange llena 14 casillas, alterna categorías y recicla si hay pocas recetas', () => {
  const pool = [mk(1001, 'Chicken'), mk(1002, 'Beef'), mk(1003, 'Seafood'), mk(1004, 'Chicken', 3)];
  const e = arrange(pool);
  assert.equal(e.length, 14);
  assert.equal(new Set(e.map((x) => `${x.day}|${x.slot}`)).size, 14);
  assert.ok(e.every((x) => x.source === 'reglas'));
  assert.equal(e[0].idMeal, '1004'); // dentro de la categoría, prioriza lo que hay en despensa
});
test('categorías según dieta y exclusiones', () => {
  assert.deepEqual(categoriesFor({ diet: 'vegano' }), ['Vegan']);
  assert.ok(!categoriesFor({ diet: 'omnivoro', excludedCategories: ['pork'] }).includes('Pork'));
});
test('plan de emergencia se niega si hay alergias (no puede verificar)', () => {
  assert.equal(emergencyPlan({ allergies: [], diet: 'omnivoro' }).length, 14);
  assert.throws(() => emergencyPlan({ allergies: ['gluten'], diet: 'omnivoro' }), (e) => e.status === 503);
});

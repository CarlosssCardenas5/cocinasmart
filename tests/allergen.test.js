'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { recipeConflicts, productConflicts, canon } = require('../src/services/allergenService');
const { parseIngredients, toEnglishQuery, normalizeName } = require('../src/utils/ingredientParser');

test('detecta alérgenos en ingredientes de TheMealDB', () => {
  const ing = [{ name: 'Plain Flour' }, { name: 'Eggs' }, { name: 'Prawns' }];
  assert.deepEqual(recipeConflicts(ing, ['gluten', 'huevo', 'mariscos', 'soya']).sort(), ['gluten', 'huevo', 'mariscos']);
});
test('berenjena (eggplant) no cuenta como huevo', () => {
  assert.deepEqual(recipeConflicts([{ name: 'Eggplant' }], ['huevo']), []);
});
test('alias en español y etiquetas de Open Food Facts', () => {
  assert.equal(canon('Lácteos'), 'lactosa'); assert.equal(canon('Frutos secos'), 'frutos_secos');
  assert.deepEqual(productConflicts(['en:milk', 'en:gluten'], ['lactosa', 'mani']), ['lactosa']);
});
test('parseIngredients ignora campos vacíos', () => {
  const m = { strIngredient1: 'Rice', strMeasure1: '1 cup', strIngredient2: '', strMeasure2: ' ', strIngredient3: 'Salt', strMeasure3: '' };
  assert.deepEqual(parseIngredients(m), [{ name: 'Rice', measure: '1 cup' }, { name: 'Salt', measure: '' }]);
});
test('traduce búsquedas ES→EN y normaliza nombres', () => {
  assert.equal(toEnglishQuery('pollo con arroz'), 'chicken con rice');
  assert.equal(normalizeName('Tomatoes'), 'tomato'); assert.equal(normalizeName('Anchovies'), 'anchovy');
});

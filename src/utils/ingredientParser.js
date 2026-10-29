'use strict';

// TheMealDB devuelve strIngredient1..20 y strMeasure1..20 en campos planos.
function parseIngredients(meal) {
  const out = [];
  for (let i = 1; i <= 20; i++) {
    const name = String(meal[`strIngredient${i}`] || '').trim();
    if (!name) continue;
    out.push({ name, measure: String(meal[`strMeasure${i}`] || '').trim() });
  }
  return out;
}

// Normaliza para comparar: minúsculas, sin acentos, singular simple.
function normalizeName(s) {
  let n = String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (n.endsWith('ies')) n = n.slice(0, -3) + 'y';
  else if (n.endsWith('oes')) n = n.slice(0, -2);
  else if (n.length > 3 && n.endsWith('s') && !n.endsWith('ss')) n = n.slice(0, -1);
  return n;
}

// TheMealDB está en inglés: diccionario mínimo ES→EN para búsquedas y despensa.
const ES_EN = {
  pollo: 'chicken', 'carne de res': 'beef', res: 'beef', carne: 'beef', cerdo: 'pork', cordero: 'lamb', pescado: 'fish',
  salmon: 'salmon', atun: 'tuna', camaron: 'prawns', camarones: 'prawns', arroz: 'rice', pasta: 'pasta', fideos: 'noodles',
  tomate: 'tomato', cebolla: 'onion', ajo: 'garlic', papa: 'potato', papas: 'potato', patata: 'potato', zanahoria: 'carrot',
  huevo: 'egg', huevos: 'egg', leche: 'milk', queso: 'cheese', mantequilla: 'butter', crema: 'cream', yogur: 'yogurt',
  harina: 'flour', pan: 'bread', limon: 'lemon', naranja: 'orange', manzana: 'apple', platano: 'banana', champinones: 'mushrooms',
  hongos: 'mushrooms', pimiento: 'pepper', aji: 'chilli', maiz: 'corn', frijoles: 'beans', lentejas: 'lentils', garbanzos: 'chickpeas',
  espinaca: 'spinach', lechuga: 'lettuce', pepino: 'cucumber', calabaza: 'pumpkin', aceite: 'oil', sal: 'salt', azucar: 'sugar',
  chocolate: 'chocolate', coco: 'coconut', palta: 'avocado', aguacate: 'avocado', cilantro: 'coriander', perejil: 'parsley',
  tofu: 'tofu', jamon: 'ham', tocino: 'bacon', salchicha: 'sausage', pavo: 'turkey', pato: 'duck',
};

function toEnglish(word) {
  const k = normalizeName(word);
  return ES_EN[k] || ES_EN[k + 's'] || word.toLowerCase().trim();
}

// Traduce palabra por palabra lo que conozca (para q= de búsquedas).
function toEnglishQuery(q) {
  return String(q).trim().split(/\s+/).map(toEnglish).join(' ');
}

module.exports = { parseIngredients, normalizeName, toEnglish, toEnglishQuery };

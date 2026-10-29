'use strict';
const mealdb = require('./mealdbService');
const ShoppingList = require('../models/ShoppingList');
const { normalizeName, toEnglish } = require('../utils/ingredientParser');

const CATEGORIES = [
  ['Carnes', ['chicken', 'beef', 'pork', 'lamb', 'bacon', 'sausage', 'ham', 'turkey', 'duck', 'mince', 'steak', 'veal']],
  ['Pescados y mariscos', ['salmon', 'tuna', 'cod', 'fish', 'prawn', 'shrimp', 'crab', 'mussel', 'squid', 'anchov', 'haddock']],
  ['Lácteos y huevos', ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'egg', 'parmesan', 'mozzarella', 'cheddar']],
  ['Condimentos y despensa', ['salt', 'black pepper', 'white pepper', 'cumin', 'paprika', 'cinnamon', 'turmeric', 'oregano', 'nutmeg', 'clove', 'vinegar', 'sauce', 'oil', 'sugar', 'honey', 'stock', 'paste', 'powder', 'mustard', 'soy']],
  ['Frutas', ['lemon', 'lime', 'apple', 'banana', 'orange', 'berry', 'berries', 'avocado', 'mango', 'pineapple', 'coconut', 'raisin', 'grape']],
  ['Granos y pastas', ['rice', 'pasta', 'spaghetti', 'noodle', 'flour', 'bread', 'oat', 'couscous', 'lentil', 'chickpea', 'penne', 'lasagne', 'bean']],
  ['Verduras y hierbas', ['onion', 'garlic', 'tomato', 'potato', 'carrot', 'pepper', 'spinach', 'lettuce', 'cucumber', 'mushroom', 'celery', 'broccoli', 'cabbage', 'pumpkin', 'courgette', 'zucchini', 'aubergine', 'leek', 'pea', 'corn', 'ginger', 'chilli', 'parsley', 'coriander', 'basil', 'thyme', 'mint', 'rosemary', 'herb', 'shallot', 'spring onion']],
];

function categorize(name) {
  const n = name.toLowerCase();
  for (const [cat, kws] of CATEGORIES) if (kws.some((k) => n.includes(k))) return cat;
  return 'Otros';
}

function inPantry(name, pantryNames) {
  const n = normalizeName(name);
  return pantryNames.some((p) => {
    const q = normalizeName(toEnglish(p));
    return q.length >= 3 && (n.includes(q) || q.includes(n));
  });
}

/** Consolida los ingredientes de todas las recetas del plan, descontando lo que hay en la despensa. */
async function generateFromPlan({ userId, plan, pantryItems }) {
  const ids = [...new Set(plan.entries.map((e) => e.idMeal))];
  const results = await Promise.all(ids.map((id) => mealdb.lookup(id, { userId }).catch(() => null)));
  const missing = ids.filter((_, i) => !results[i] || !results[i].data).length;

  // Cada receta cuenta por cada vez que aparece en el plan (si se repite, se compra de nuevo).
  const byId = new Map(ids.map((id, i) => [id, results[i] && results[i].data]));
  const agg = new Map();
  for (const e of plan.entries) {
    const recipe = byId.get(e.idMeal);
    if (!recipe) continue;
    for (const ing of recipe.ingredients) {
      const key = normalizeName(ing.name);
      if (!agg.has(key)) agg.set(key, { name: ing.name, measures: [] });
      if (ing.measure) agg.get(key).measures.push(ing.measure);
    }
  }

  const pantryNames = pantryItems.map((p) => p.name);
  const items = [...agg.values()]
    .map((a) => ({
      name: a.name,
      quantityText: a.measures.join(' + ').slice(0, 200),
      category: categorize(a.name),
      inPantry: inPantry(a.name, pantryNames),
      checked: false,
    }))
    .sort((x, y) => x.category.localeCompare(y.category) || x.name.localeCompare(y.name));

  const list = await ShoppingList.create({ userId, planId: plan._id, items });
  return { list, missingRecipes: missing };
}

module.exports = { generateFromPlan, categorize };

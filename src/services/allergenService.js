'use strict';

// Palabras clave en inglés (TheMealDB) y etiquetas de Open Food Facts por alérgeno.
// La comparación es deliberadamente conservadora: ante la duda, se avisa.
const RULES = {
  gluten: { kw: ['flour', 'bread', 'pasta', 'spaghetti', 'noodle', 'wheat', 'barley', 'rye', 'couscous', 'breadcrumb', 'lasagne', 'tortilla', 'pastry', 'biscuit', 'soy sauce', 'semolina', 'macaroni', 'penne', 'filo', 'pitta', 'bun', 'cracker'], off: ['gluten'] },
  lactosa: { kw: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'parmesan', 'mozzarella', 'cheddar', 'ghee', 'custard', 'feta', 'ricotta', 'mascarpone'], off: ['milk'] },
  huevo: { kw: ['egg', 'mayonnaise'], off: ['eggs'] },
  frutos_secos: { kw: ['almond', 'walnut', 'cashew', 'pistachio', 'hazelnut', 'pecan', 'macadamia', 'nut '], off: ['nuts'] },
  mani: { kw: ['peanut'], off: ['peanuts'] },
  pescado: { kw: ['salmon', 'tuna', 'cod', 'haddock', 'anchov', 'mackerel', 'sardine', 'trout', 'fish', 'sea bass', 'herring', 'tilapia'], off: ['fish'] },
  mariscos: { kw: ['prawn', 'shrimp', 'crab', 'lobster', 'mussel', 'clam', 'squid', 'oyster', 'scallop', 'octopus'], off: ['crustaceans', 'molluscs'] },
  soya: { kw: ['soy', 'tofu', 'edamame', 'miso', 'tempeh'], off: ['soybeans'] },
  sesamo: { kw: ['sesame', 'tahini'], off: ['sesame-seeds'] },
};
for (const r of Object.values(RULES)) r.re = r.kw.map((k) => new RegExp(`\\b${k}`));

const ALIASES = {
  lacteos: 'lactosa', leche: 'lactosa', nueces: 'frutos_secos', 'frutos secos': 'frutos_secos', cacahuate: 'mani',
  cacahuete: 'mani', soja: 'soya', ajonjoli: 'sesamo', crustaceos: 'mariscos', trigo: 'gluten',
};

function canon(a) {
  const k = String(a).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
  const snake = k.replace(/ /g, '_');
  return RULES[snake] ? snake : (ALIASES[k] || snake);
}

// Devuelve las claves de alérgenos del usuario que aparecen en los ingredientes.
function recipeConflicts(ingredients = [], allergies = []) {
  const text = ingredients.map((i) => String(i.name).toLowerCase()).join(' | ').replace(/eggplant/g, 'aubergine');
  return [...new Set(allergies.map(canon))].filter((a) => RULES[a] && RULES[a].re.some((re) => re.test(`${text} `)));
}

// Etiquetas de Open Food Facts (p. ej. "gluten", "milk").
function productConflicts(allergenTags = [], allergies = []) {
  const tags = allergenTags.map((t) => String(t).replace(/^[a-z]{2}:/, '').toLowerCase());
  return [...new Set(allergies.map(canon))].filter((a) => RULES[a] && RULES[a].off.some((o) => tags.includes(o)));
}

module.exports = { recipeConflicts, productConflicts, canon, RULES };

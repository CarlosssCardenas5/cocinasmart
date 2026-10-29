'use strict';
const express = require('express');
const c = require('../controllers/recipeController');
const { requireAuth, optionalAuth } = require('../middlewares/authMiddleware');
const { geminiLimiter } = require('../middlewares/rateLimitMiddleware');

// /api/recipes  (búsqueda y detalle públicos; sugerencias y traducción requieren sesión)
const recipeRouter = express.Router();
recipeRouter.get('/search', optionalAuth, c.search);
recipeRouter.get('/filter', optionalAuth, c.filter);
recipeRouter.get('/categories', optionalAuth, c.categories);
recipeRouter.get('/suggest/pantry', requireAuth, c.suggestFromPantry);
recipeRouter.get('/:idMeal', optionalAuth, c.getRecipe);
recipeRouter.post('/:idMeal/translate', requireAuth, geminiLimiter, c.translate);

// /api/favorites
const favoriteRouter = express.Router();
favoriteRouter.use(requireAuth);
favoriteRouter.get('/', c.listFavorites);
favoriteRouter.post('/', c.addFavorite);
favoriteRouter.delete('/:idMeal', c.removeFavorite);

module.exports = { recipeRouter, favoriteRouter };

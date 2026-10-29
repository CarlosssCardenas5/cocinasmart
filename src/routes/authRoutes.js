'use strict';
const express = require('express');
const c = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { authLimiter } = require('../middlewares/rateLimitMiddleware');

const authRouter = express.Router();
authRouter.post('/register', authLimiter, c.register);
authRouter.post('/login', authLimiter, c.login);

// Montado en /api/profile
const profileRouter = express.Router();
profileRouter.use(requireAuth);
profileRouter.get('/', c.getProfile);
profileRouter.put('/', c.updateProfile);

module.exports = { authRouter, profileRouter };

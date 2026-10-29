'use strict';
const express = require('express');
const c = require('../controllers/planController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { geminiLimiter } = require('../middlewares/rateLimitMiddleware');

const router = express.Router();
router.use(requireAuth);
router.post('/generate', geminiLimiter, c.generate); // antes de /:weekStart
router.get('/:weekStart', c.getPlan);
router.put('/:weekStart', c.putPlan);

module.exports = router;

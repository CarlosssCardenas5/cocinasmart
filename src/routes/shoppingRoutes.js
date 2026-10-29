'use strict';
const express = require('express');
const c = require('../controllers/shoppingController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(requireAuth);
router.get('/', c.latest); // última lista del usuario
router.post('/generate', c.generate);
router.get('/:id', c.getOne);
router.patch('/:id', c.patch);

module.exports = router;

'use strict';
const express = require('express');
const c = require('../controllers/pantryController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(requireAuth);
router.get('/', c.list);
router.post('/', c.add);
router.delete('/:id', c.remove);

module.exports = router;

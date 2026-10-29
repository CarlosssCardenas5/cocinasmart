'use strict';
const express = require('express');
const c = require('../controllers/adminController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requireAdmin } = require('../middlewares/roleMiddleware');

const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get('/users', c.listUsers);
router.patch('/users/:id', c.setUserActive);
router.get('/usage', c.usage);
router.delete('/cache', c.clearCache);

module.exports = router;

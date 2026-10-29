'use strict';
const express = require('express');
const c = require('../controllers/productController');
const { optionalAuth } = require('../middlewares/authMiddleware');

const router = express.Router();
router.get('/search', optionalAuth, c.search);
router.get('/:barcode', optionalAuth, c.getByBarcode);

module.exports = router;

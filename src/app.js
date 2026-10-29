'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const { apiLimiter } = require('./middlewares/rateLimitMiddleware');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');
const { authRouter, profileRouter } = require('./routes/authRoutes');
const { recipeRouter, favoriteRouter } = require('./routes/recipeRoutes');

const app = express();

// Detrás del proxy del hosting: necesario para que el rate limit vea la IP real del cliente.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'https://www.themealdb.com', 'https://images.openfoodfacts.org', 'https://static.openfoodfacts.org'],
      'connect-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-ancestors': ["'none'"],
    },
  },
}));

// CORS restringido: solo orígenes de CORS_ORIGINS. Las peticiones del mismo origen no lo necesitan.
app.use(cors({
  origin: (origin, cb) => (!origin || env.corsOrigins.includes(origin) ? cb(null, true) : cb(null, false)),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));

app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api', apiLimiter);
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/recipes', recipeRouter);
app.use('/api/favorites', favoriteRouter);
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/pantry', require('./routes/pantryRoutes'));
app.use('/api/plans', require('./routes/planRoutes'));
app.use('/api/shopping', require('./routes/shoppingRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api', notFound);

// Frontend SPA
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, { maxAge: env.isProd ? '1h' : 0, index: 'index.html' }));
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.use(errorHandler);

module.exports = app;

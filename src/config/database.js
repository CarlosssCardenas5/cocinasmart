'use strict';
const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connectDB(retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000, maxPoolSize: 10 });
      console.log('[DB] Conectado a MongoDB Atlas');
      return;
    } catch (err) {
      console.error(`[DB] Intento ${attempt}/${retries} falló: ${err.message}`);
      if (attempt === retries) throw err;
      await sleep(3000 * attempt);
    }
  }
}

mongoose.connection.on('disconnected', () => console.warn('[DB] Conexión perdida; mongoose reintentará automáticamente'));
mongoose.connection.on('reconnected', () => console.log('[DB] Reconectado'));

module.exports = { connectDB, mongoose };

'use strict';
const bcrypt = require('bcryptjs');
const env = require('./config/env');
const { connectDB, mongoose } = require('./config/database');
const app = require('./app');
const User = require('./models/User');

async function ensureAdmin() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return;
  const email = env.ADMIN_EMAIL.toLowerCase().trim();
  const exists = await User.exists({ email });
  if (exists) { await User.updateOne({ email }, { role: 'administrador', active: true }); return; }
  await User.create({ name: 'Administrador', email, passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 12), role: 'administrador' });
  console.log(`[admin] Administrador creado: ${email}. Cambia ADMIN_PASSWORD y borra la variable.`);
}

async function start() {
  await connectDB();
  await Promise.all([User.init()]).catch(() => {}); // asegura índices (email único)
  await ensureAdmin().catch((e) => console.error('[admin]', e.message));

  const server = app.listen(env.PORT, () => console.log(`[CocinaSmart] Escuchando en el puerto ${env.PORT} (${env.NODE_ENV})`));

  const shutdown = (sig) => {
    console.log(`[${sig}] Cerrando…`);
    server.close(async () => { await mongoose.connection.close().catch(() => {}); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Un fallo externo no debe tumbar el servidor.
process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));

start().catch((err) => { console.error('[fatal] No se pudo iniciar:', err.message); process.exit(1); });

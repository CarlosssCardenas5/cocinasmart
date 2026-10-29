'use strict';
require('dotenv').config();
const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(10, 'MONGODB_URI es obligatoria'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default(''),
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_DAILY_LIMIT_PER_USER: z.coerce.number().int().min(0).default(5),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(25000),
  MEALDB_BASE_URL: z.string().url().default('https://www.themealdb.com/api/json/v1/1'),
  OFF_BASE_URL: z.string().url().default('https://world.openfoodfacts.org'),
  OFF_USER_AGENT: z.string().default('CocinaSmart/1.0 (contacto@example.com)'),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  CACHE_TTL_MEALDB_HOURS: z.coerce.number().positive().default(24),
  CACHE_TTL_OFF_DAYS: z.coerce.number().positive().default(7),
  CACHE_STALE_GRACE_DAYS: z.coerce.number().positive().default(30),
  ADMIN_EMAIL: z.string().default(''),
  ADMIN_PASSWORD: z.string().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('\n[CocinaSmart] Configuración inválida. Revisa tu archivo .env o las variables del hosting:');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

const env = parsed.data;
env.isProd = env.NODE_ENV === 'production';
env.corsOrigins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
module.exports = env;

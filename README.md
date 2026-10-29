# CocinaSmart

App web monolítica (Node.js 20 · Express · Mongoose · SPA en Vanilla JS) que combina **TheMealDB** (recetas), **Open Food Facts** (productos) y **Gemini** (menús y traducción), con caché en MongoDB Atlas y degradación controlada cuando una API externa falla.

## 1. ¿Dónde pongo mis claves?

**Solo en variables de entorno del servidor. Nunca en `public/`, ni en el código, ni en GitHub.**

| Qué | Variable | Dónde se obtiene |
|---|---|---|
| Cadena de MongoDB Atlas | `MONGODB_URI` | Atlas → *Database* → *Connect* → *Drivers*. Añade el nombre de la BD (`/cocinasmart`). Si la contraseña tiene `@ : / ? # %`, codifícala (URL-encode). |
| Clave de Gemini | `GEMINI_API_KEY` | https://aistudio.google.com/apikey (si la dejas vacía, la app usa el generador por reglas) |
| Secreto JWT | `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |

**Opción A (hosting con panel, p. ej. cPanel "Setup Node.js App"):** añade cada variable en la sección *Environment variables* del panel.
**Opción B (archivo):** copia `.env.example` a `.env` (en la raíz, junto a `package.json`) y pega ahí los valores.

**MongoDB Atlas:** en *Network Access* agrega la IP de tu hosting (o `0.0.0.0/0` si no es fija) y crea un usuario de base de datos con permisos de lectura/escritura.

## 2. Despliegue

1. Sube la carpeta (sin `node_modules`) al hosting, Node.js 20+.
2. Configura las variables (sección 1). Archivo de arranque: `src/server.js`. Comando: `npm start`.
3. Ejecuta `npm install --omit=dev`.
4. (Opcional) Define `ADMIN_EMAIL` y `ADMIN_PASSWORD` para crear el primer administrador al arrancar; luego **borra** `ADMIN_PASSWORD`. El panel está en `#/admin`.
5. Comprueba `https://tu-dominio/api/health`.

Local: `npm install && cp .env.example .env && npm run dev` · Pruebas: `npm test`.

## 3. Robustez (resumen)

- **Caché** (`ApiCache`): TheMealDB 24 h, Open Food Facts 7 días. Cada entrada tiene `freshUntil` (vigencia) y `expiresAt` (borrado TTL = vigencia + `CACHE_STALE_GRACE_DAYS`). Si la API falla (timeout, ECONNREFUSED, 429/5xx), se devuelve el dato vencido con aviso; si no hay nada guardado, error 503 amigable.
- **Gemini → reglas:** si falla, no hay clave, se agota la cuota o se alcanza el límite diario por usuario, `planFallbackService` arma el menú con reglas locales y se avisa al usuario.
- **Open Food Facts:** `requestQueue.js` limita a 15 lecturas y 10 búsquedas por minuto por IP; el excedente espera (máx. 15 s) y luego degrada a caché.
- **Alergias:** antes de llamar a la IA se arma un conjunto de recetas reales ya filtradas por dieta y alergias; la IA solo ordena esas recetas y sus IDs se validan con Zod y contra ese conjunto.
- **Privacidad (RNF-02):** a Gemini solo se envían recetas, ingredientes y restricciones. Nunca nombre ni correo.
- **Seguridad:** `bcryptjs` (coste 12), JWT con expiración, `helmet` + CSP, CORS restringido a `CORS_ORIGINS`, `express-rate-limit`, validación Zod, el frontend nunca usa `innerHTML`.

## 4. Endpoints

Todos los de tu especificación, más: `GET /api/recipes/categories`, `GET /api/shopping` (última lista), `PATCH /api/admin/users/:id` (activar/desactivar) y `GET /api/health`.
`PATCH /api/shopping/:id` recibe `{ "itemId": "...", "checked": true }`. `weekStart` es el **lunes** de la semana (`YYYY-MM-DD`).

## 5. Notas y límites conocidos

- TheMealDB está en inglés: la app traduce palabras comunes ES→EN en búsquedas y despensa (`utils/ingredientParser.js`); amplía el diccionario si lo necesitas. Las categorías excluidas usan los nombres de TheMealDB (`Pork`, `Lamb`…).
- El plan gratuito de TheMealDB filtra por un solo ingrediente a la vez; las sugerencias de despensa combinan hasta 5 consultas.
- La detección de alérgenos en recetas es por palabras clave y conservadora (puede avisar de más). No sustituye la lectura de etiquetas.
- `EMERGENCY` en `planFallbackService.js` contiene IDs de TheMealDB escritos a mano: verifícalos una vez.
- Estructura: se añadieron `utils/http.js` (fetch con timeout) y `tests/helpers/`. Favoritos se montan desde `recipeRoutes.js` y el perfil desde `authRoutes.js`.

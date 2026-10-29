import { el, session, api, toast } from './api.js';
import { renderAccount, renderAdminLogin } from './login.js';
import { renderRecipes, renderRecipe } from './recetas.js';
import { renderPantry } from './despensa.js';
import { renderPlanner } from './planificador.js';
import { renderShopping } from './compras.js';
import { renderAdmin } from './admin.js';

const view = document.getElementById('view');

function home() {
  const tile = (cls, ico, t, d) => el('div', { class: 'tile' }, el('div', { class: `ico ${cls}` }, ico), el('h3', {}, t), el('p', { class: 'muted small' }, d));
  const api3 = (t, d) => el('div', { class: 'card card-pad' }, el('h3', { style: 'color:var(--green)' }, t), el('p', { class: 'muted small' }, d));
  return el('div', {},
    el('section', { class: 'section-cream' }, el('div', { class: 'wrap hero' },
      el('div', {},
        el('span', { class: 'pill' }, 'Planifica · Cocina · Compra'),
        el('h1', { style: 'margin-top:14px' }, 'Decide qué cocinar y arma tu lista de compras en minutos'),
        el('p', { class: 'muted' }, 'CocinaSmart combina recetas reales, datos de tus productos y un menú semanal generado con IA.'),
        el('div', { class: 'actions' },
          el('a', { class: 'btn btn-orange', href: '#/planificador' }, 'Generar mi menú semanal'),
          el('a', { class: 'btn btn-outline', href: '#/recetas' }, 'Explorar recetas'))),
      el('div', { class: 'hero-art', 'aria-hidden': 'true' }, '🥘'))),
    el('section', {}, el('div', { class: 'wrap' }, el('h2', {}, 'Cómo funciona'), el('div', { class: 'grid-3' },
      tile('ico-a', '🥕', '1. Registra tu despensa', 'Agrega ingredientes y productos con código de barras.'),
      tile('ico-b', '📅', '2. Genera tu semana', 'Gemini arma el menú con recetas reales de TheMealDB.'),
      tile('ico-c', '🛒', '3. Compra lo justo', 'Lista consolidada que descuenta lo que ya tienes.')))),
    el('section', { class: 'section-cream' }, el('div', { class: 'wrap' }, el('h2', {}, 'Tres APIs, un solo flujo'), el('div', { class: 'grid-3' },
      api3('TheMealDB', 'Catálogo de recetas, ingredientes e instrucciones.'),
      api3('Open Food Facts', 'Nutri-Score, calorías y alérgenos de productos.'),
      api3('Gemini API', 'Menú semanal y traducción al español.')))));
}

const needsAuth = new Set(['despensa', 'planificador', 'compras']);

async function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [name = '', arg] = hash.split('/');
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
  view.replaceChildren();

  try {
    if (needsAuth.has(name) && !session.token) { location.hash = '#/cuenta'; toast('Inicia sesión para continuar.', 'info'); return; }
    switch (name) {
      case '': view.append(home()); break;
      case 'recetas': await renderRecipes(view); break;
      case 'receta': await renderRecipe(view, arg); break;
      case 'despensa': await renderPantry(view); break;
      case 'planificador': await renderPlanner(view); break;
      case 'compras': await renderShopping(view); break;
      case 'cuenta': await renderAccount(view); break;
      case 'admin-login': await renderAdminLogin(view); break;
      case 'admin': await renderAdmin(view, arg); break;
      default: view.append(el('div', { class: 'wrap' }, el('h1', {}, 'Página no encontrada'), el('a', { class: 'btn btn-green', href: '#/' }, 'Volver al inicio')));
    }
  } catch (err) {
    view.append(el('div', { class: 'wrap' }, el('div', { class: 'alert err', role: 'alert' }, err.message || 'Algo salió mal.'),
      el('button', { class: 'btn btn-outline', onclick: route }, 'Reintentar')));
  }
  window.scrollTo(0, 0);
  view.focus({ preventScroll: true });
}

function refreshChrome() {
  const account = document.getElementById('nav-account');
  account.textContent = session.user ? session.user.name.split(' ')[0] : 'Mi cuenta';
  document.getElementById('nav-admin').hidden = !session.isAdmin;
}

window.addEventListener('hashchange', route);
window.addEventListener('cs:session', () => { refreshChrome(); if (!session.token) { location.hash = '#/cuenta'; } });
window.addEventListener('cs:login', () => { refreshChrome(); });
const offline = document.getElementById('offline');
const syncOnline = () => { offline.hidden = navigator.onLine; };
window.addEventListener('online', syncOnline); window.addEventListener('offline', syncOnline); syncOnline();

refreshChrome();
// Revalida el perfil guardado (rol/estado) sin bloquear la carga.
if (session.token) api('/profile').then((r) => { session.setUser(r.user); refreshChrome(); }).catch(() => {});
route();

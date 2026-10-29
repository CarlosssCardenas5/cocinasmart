import { el, api, session, toast, errorBox, loading, guarded } from './api.js';

const TABS = { usuarios: 'Usuarios', uso: 'Uso de APIs', mantenimiento: 'Mantenimiento' };

export async function renderAdmin(root, tab = 'usuarios') {
  if (!session.isAdmin) { location.hash = '#/admin-login'; return; }
  if (!TABS[tab]) tab = 'usuarios';
  const content = el('div', {}, loading());
  root.append(el('div', { class: 'admin-shell' }, el('div', { class: 'wrap' },
    el('h1', {}, 'Panel de administración'),
    el('div', { class: 'tabs', role: 'tablist' }, Object.entries(TABS).map(([k, v]) => el('button', { class: k === tab ? 'on' : '', role: 'tab', onclick: () => { location.hash = `#/admin/${k}`; } }, v))),
    content)));
  try {
    if (tab === 'usuarios') await users(content);
    else if (tab === 'uso') await usage(content);
    else maintenance(content);
  } catch (err) { content.replaceChildren(errorBox(err)); }
}

async function users(box) {
  const q = el('input', { type: 'search', placeholder: 'Buscar por nombre o correo', maxlength: 60, 'aria-label': 'Buscar usuarios' });
  const table = el('div', { class: 'scroll-x' });
  const load = async () => {
    const r = await api(`/admin/users?limit=50${q.value.trim() ? `&q=${encodeURIComponent(q.value.trim())}` : ''}`);
    table.replaceChildren(el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, ['Nombre', 'Correo', 'Rol', 'Alta', 'Estado', ''].map((h) => el('th', {}, h)))),
      el('tbody', {}, r.users.map((u) => {
        const b = el('button', { class: `btn btn-sm ${u.active ? 'btn-danger' : 'btn-green'}` }, u.active ? 'Desactivar' : 'Activar');
        b.addEventListener('click', () => guarded(b, async () => { await api(`/admin/users/${u._id}`, { method: 'PATCH', body: { active: !u.active } }); await load(); }, '…'));
        return el('tr', {}, el('td', {}, u.name), el('td', {}, u.email), el('td', {}, u.role), el('td', {}, new Date(u.createdAt).toLocaleDateString('es')),
          el('td', {}, el('span', { class: `badge ${u.active ? '' : 'warn'}` }, u.active ? 'Activo' : 'Inactivo')), el('td', {}, b));
      }))), el('p', { class: 'muted small' }, `${r.total} usuario(s) en total`));
  };
  box.replaceChildren(el('form', { class: 'inline', onsubmit: (e) => { e.preventDefault(); load().catch((err) => toast(err.message, 'err')); } }, q, el('button', { class: 'btn btn-outline', type: 'submit' }, 'Buscar')), table);
  await load();
}

async function usage(box) {
  const r = await api('/admin/usage?days=7');
  box.replaceChildren(
    el('p', { class: 'muted' }, `Últimos ${r.days} días`),
    el('div', { class: 'scroll-x card card-pad' }, el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, ['Proveedor', 'Endpoint', 'Llamadas', 'Aciertos de caché', 'Datos vencidos', 'Errores', 'Respaldos', 'Latencia media'].map((h) => el('th', {}, h)))),
      el('tbody', {}, r.usage.length ? r.usage.map((u) => el('tr', {}, el('td', {}, u.provider), el('td', {}, u.endpoint), el('td', {}, u.total), el('td', {}, `${u.cacheHits} (${Math.round((u.cacheHits / u.total) * 100)}%)`), el('td', {}, u.stale), el('td', {}, u.errors), el('td', {}, u.fallbacks), el('td', {}, `${u.avgLatencyMs} ms`)))
        : el('tr', {}, el('td', { colspan: 8, class: 'muted' }, 'Sin actividad registrada.'))))),
    el('h3', { style: 'margin-top:20px' }, 'Entradas en caché'),
    el('p', { class: 'muted' }, r.cacheEntries.map((c) => `${c.provider}: ${c.entries}`).join(' · ') || 'Caché vacía'));
}

function maintenance(box) {
  const btn = (label, provider) => {
    const b = el('button', { class: 'btn btn-danger' }, label);
    b.addEventListener('click', () => {
      if (!confirm(`¿Vaciar la caché de ${provider || 'todos los proveedores'}? Las siguientes consultas volverán a llamar a las APIs externas.`)) return;
      guarded(b, async () => { const r = await api(`/admin/cache${provider ? `?provider=${provider}` : ''}`, { method: 'DELETE' }); toast(`Caché vaciada (${r.deleted} entradas)`, 'ok'); }, 'Vaciando…');
    });
    return b;
  };
  box.replaceChildren(el('div', { class: 'card card-pad' }, el('h3', {}, 'Caché de APIs'),
    el('p', { class: 'muted' }, 'Vaciar la caché elimina también los datos de respaldo para modo sin conexión; úsalo solo si hay datos corruptos.'),
    el('div', { class: 'actions' }, btn('Vaciar TheMealDB', 'themealdb'), btn('Vaciar Open Food Facts', 'openfoodfacts'), btn('Vaciar traducciones (Gemini)', 'gemini'), btn('Vaciar todo'))));
}

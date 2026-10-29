// Cliente HTTP + utilidades de UI (sin innerHTML: todo texto externo se inserta con textContent).
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* modo privado */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* idem */ } },
};

export const session = {
  get token() { return store.get('cs_token'); },
  get user() { try { return JSON.parse(store.get('cs_user') || 'null'); } catch { return null; } },
  save(token, user) { store.set('cs_token', token); store.set('cs_user', JSON.stringify(user)); },
  setUser(user) { store.set('cs_user', JSON.stringify(user)); },
  clear() { store.del('cs_token'); store.del('cs_user'); },
  get isAdmin() { return this.user?.role === 'administrador'; },
};

export class ApiError extends Error {
  constructor(status, message, code, data) { super(message); this.status = status; this.code = code; this.data = data; }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session.token) headers.Authorization = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.', 'OFFLINE');
  }
  let data = null;
  try { data = await res.json(); } catch { /* respuesta sin JSON */ }

  if (res.status === 401 && session.token) { session.clear(); window.dispatchEvent(new Event('cs:session')); }
  if (!res.ok) throw new ApiError(res.status, data?.message || 'Ocurrió un error inesperado.', data?.code, data);
  if (data?.warning) toast(data.warning, 'warn');
  return data;
}

const safeUrl = (u) => typeof u === 'string' && /^(https:\/\/|#\/|\/[^/])/.test(u);

export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'href' || k === 'src') { if (safeUrl(v)) n.setAttribute(k, v); }
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}

export function toast(message, type = 'info', ms = 6000) {
  const box = document.getElementById('toasts');
  const t = el('div', { class: `toast ${type}`, role: 'status' }, message);
  box.append(t);
  setTimeout(() => t.remove(), ms);
}

export const errorBox = (err) => el('div', { class: 'alert err', role: 'alert' }, err.message || String(err));
export const loading = (text = 'Cargando…') => el('p', { class: 'muted' }, el('span', { class: 'spinner' }), text);

export const LABEL = {
  gluten: 'Gluten', lactosa: 'Lactosa', huevo: 'Huevo', frutos_secos: 'Frutos secos', mani: 'Maní',
  pescado: 'Pescado', mariscos: 'Mariscos', soya: 'Soya', sesamo: 'Sésamo',
};
export const conflictBadges = (list = []) => list.map((c) => el('span', { class: 'badge warn' }, `⚠ ${LABEL[c] || c}`));

// Ejecuta una acción deshabilitando el botón y mostrando errores sin romper la UI.
export async function guarded(btn, fn, busyText = 'Procesando…') {
  const prev = btn.textContent;
  btn.disabled = true; btn.textContent = busyText;
  try { return await fn(); }
  catch (err) { toast(err.message || 'Error', 'err'); }
  finally { btn.disabled = false; btn.textContent = prev; }
}

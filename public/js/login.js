import { el, api, session, toast, errorBox, guarded, LABEL } from './api.js';

function authForm(onDone, { admin = false } = {}) {
  let mode = 'login';
  const box = el('div', { class: 'card card-pad narrow' });
  const draw = () => {
    const msg = el('div');
    const name = el('input', { type: 'text', id: 'f-name', autocomplete: 'name', required: true, maxlength: 80 });
    const email = el('input', { type: 'email', id: 'f-email', autocomplete: 'email', required: true });
    const pass = el('input', { type: 'password', id: 'f-pass', autocomplete: mode === 'login' ? 'current-password' : 'new-password', required: true, minlength: mode === 'login' ? 1 : 8 });
    const btn = el('button', { class: 'btn btn-green', type: 'submit' }, mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta');
    const form = el('form', {
      onsubmit: async (e) => {
        e.preventDefault(); msg.replaceChildren();
        await guarded(btn, async () => {
          try {
            const body = mode === 'login' ? { email: email.value, password: pass.value } : { name: name.value, email: email.value, password: pass.value };
            const r = await api(`/auth/${mode}`, { method: 'POST', body });
            if (admin && r.user.role !== 'administrador') { msg.append(errorBox(new Error('Esta cuenta no tiene permisos de administración.'))); return; }
            session.save(r.token, r.user); window.dispatchEvent(new Event('cs:login'));
            onDone(r.user);
          } catch (err) {
            msg.append(errorBox(err));
            if (err.data?.details) msg.append(el('ul', {}, err.data.details.map((d) => el('li', {}, `${d.campo}: ${d.mensaje}`))));
          }
        }, 'Un momento…');
      },
    },
    mode === 'register' && el('div', { class: 'field' }, el('label', { for: 'f-name' }, 'Nombre'), name),
    el('div', { class: 'field' }, el('label', { for: 'f-email' }, 'Correo electrónico'), email),
    el('div', { class: 'field' }, el('label', { for: 'f-pass' }, 'Contraseña'), pass,
      mode === 'register' && el('p', { class: 'muted small' }, 'Mínimo 8 caracteres, con letras y números.')),
    msg, btn);
    box.replaceChildren(
      el('h2', {}, admin ? 'Acceso de administración' : (mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta')), form,
      !admin && el('p', { class: 'small', style: 'margin-top:14px' },
        mode === 'login' ? '¿Aún no tienes cuenta? ' : '¿Ya tienes cuenta? ',
        el('a', { href: '#/cuenta', onclick: (e) => { e.preventDefault(); mode = mode === 'login' ? 'register' : 'login'; draw(); } }, mode === 'login' ? 'Regístrate' : 'Inicia sesión')),
      admin && el('p', { class: 'small' }, el('a', { href: '#/' }, '← Volver a la aplicación')));
  };
  draw();
  return box;
}

function profileView(root) {
  const u = session.user;
  const allergyBoxes = Object.entries(LABEL).map(([k, label]) =>
    el('label', { style: 'display:inline-flex;gap:6px;margin-right:14px;font-weight:500' },
      el('input', { type: 'checkbox', value: k, checked: u.preferences.allergies.includes(k) }), label));
  const diet = el('select', { id: 'p-diet' }, ['omnivoro', 'vegetariano', 'vegano', 'pescetariano'].map((d) => el('option', { value: d, selected: d === u.preferences.diet }, d)));
  const servings = el('input', { type: 'number', id: 'p-serv', min: 1, max: 12, value: u.preferences.servings });
  const name = el('input', { type: 'text', id: 'p-name', value: u.name, maxlength: 80 });
  const excl = el('input', { type: 'text', id: 'p-excl', value: u.preferences.excludedCategories.join(', '), placeholder: 'Ej.: Pork, Lamb (categorías de TheMealDB)' });
  const btn = el('button', { class: 'btn btn-green', type: 'submit' }, 'Guardar cambios');
  const form = el('form', {
    onsubmit: (e) => {
      e.preventDefault();
      guarded(btn, async () => {
        const r = await api('/profile', { method: 'PUT', body: {
          name: name.value,
          preferences: {
            diet: diet.value, servings: Number(servings.value),
            allergies: allergyBoxes.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => i.value),
            excludedCategories: excl.value.split(',').map((s) => s.trim()).filter(Boolean),
          },
        } });
        session.setUser(r.user); window.dispatchEvent(new Event('cs:login')); toast('Preferencias guardadas', 'ok');
      }, 'Guardando…');
    },
  },
  el('div', { class: 'field' }, el('label', { for: 'p-name' }, 'Nombre'), name),
  el('div', { class: 'grid-3' }, el('div', { class: 'field' }, el('label', { for: 'p-diet' }, 'Dieta'), diet), el('div', { class: 'field' }, el('label', { for: 'p-serv' }, 'Porciones por comida'), servings)),
  el('div', { class: 'field' }, el('label', {}, 'Alergias e intolerancias'), el('div', {}, allergyBoxes)),
  el('div', { class: 'field' }, el('label', { for: 'p-excl' }, 'Categorías a excluir'), excl),
  el('p', { class: 'muted small' }, 'Tus alergias se usan para filtrar recetas y avisarte en productos. A Gemini solo se envían recetas y restricciones, nunca tu nombre ni tu correo.'),
  btn);

  root.append(el('div', { class: 'wrap' }, el('h1', {}, 'Mi cuenta'),
    el('div', { class: 'card card-pad' }, el('p', { class: 'muted' }, u.email), form),
    el('div', { class: 'actions' },
      el('button', { class: 'btn btn-outline', onclick: () => { session.clear(); window.dispatchEvent(new Event('cs:login')); location.hash = '#/'; } }, 'Cerrar sesión'))));
}

export async function renderAccount(root) {
  if (session.token && session.user) return profileView(root);
  root.append(el('div', { class: 'wrap' }, authForm(() => { location.hash = '#/'; })));
}

export async function renderAdminLogin(root) {
  if (session.isAdmin) { location.hash = '#/admin'; return; }
  root.append(el('div', { class: 'admin-shell' }, el('div', { class: 'wrap' }, authForm(() => { location.hash = '#/admin'; }, { admin: true }))));
}

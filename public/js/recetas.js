import { el, api, session, toast, errorBox, loading, conflictBadges, guarded } from './api.js';

const FALLBACK_CATS = ['Beef', 'Chicken', 'Dessert', 'Lamb', 'Pasta', 'Pork', 'Seafood', 'Side', 'Starter', 'Vegan', 'Vegetarian'];

export async function renderRecipes(root) {
  const wrap = el('div', { class: 'wrap' });
  const results = el('div');
  const chips = el('div', { class: 'chips' });
  const q = el('input', { type: 'search', id: 'q', placeholder: 'Busca una receta (pollo, arroz, pasta…)', maxlength: 60, 'aria-label': 'Buscar recetas' });
  let favs = new Set();

  if (session.token) { try { favs = new Set((await api('/favorites')).favorites.map((f) => f.idMeal)); } catch { /* sin favoritos */ } }

  const card = (r) => {
    const fav = el('button', { class: 'btn btn-outline btn-sm', 'aria-label': 'Favorito' }, favs.has(r.idMeal) ? '♥ Favorita' : '♡ Favorita');
    fav.addEventListener('click', () => {
      if (!session.token) { location.hash = '#/cuenta'; return; }
      guarded(fav, async () => {
        if (favs.has(r.idMeal)) { await api(`/favorites/${r.idMeal}`, { method: 'DELETE' }); favs.delete(r.idMeal); }
        else { await api('/favorites', { method: 'POST', body: { idMeal: r.idMeal, name: r.name, thumbnail: r.thumbnail || '' } }); favs.add(r.idMeal); }
      }, '…').then(() => { fav.textContent = favs.has(r.idMeal) ? '♥ Favorita' : '♡ Favorita'; });
    });
    return el('article', { class: 'card' },
      r.thumbnail && el('img', { class: 'thumb', src: r.thumbnail, alt: r.name, loading: 'lazy' }),
      el('div', { class: 'body' }, el('h3', {}, r.name),
        r.matches && el('p', { class: 'muted small' }, `Usa: ${r.matches.join(', ')}`),
        el('div', { class: 'row' }, el('a', { class: 'btn btn-green btn-sm', href: `#/receta/${r.idMeal}` }, 'Ver receta'), fav)));
  };

  const show = async (promiseFn) => {
    results.replaceChildren(loading());
    try {
      const r = await promiseFn();
      const list = r.recipes || r.favorites || [];
      results.replaceChildren(list.length ? el('div', { class: 'grid' }, list.map(card)) : el('p', { class: 'muted' }, 'No encontramos recetas con ese criterio.'));
    } catch (err) { results.replaceChildren(errorBox(err)); }
  };

  const form = el('form', { class: 'inline', onsubmit: (e) => { e.preventDefault(); if (q.value.trim().length >= 2) show(() => api(`/recipes/search?q=${encodeURIComponent(q.value.trim())}`)); } },
    el('div', { class: 'field', style: 'margin:0' }, q), el('button', { class: 'btn btn-green', type: 'submit' }, 'Buscar'));

  const extra = session.token ? el('div', { class: 'actions', style: 'margin-bottom:12px' },
    el('button', { class: 'btn btn-orange btn-sm', onclick: () => show(() => api('/recipes/suggest/pantry')) }, 'Sugeridas con mi despensa'),
    el('button', { class: 'btn btn-outline btn-sm', onclick: () => show(() => api('/favorites')) }, 'Mis favoritas')) : null;

  wrap.append(el('h1', {}, 'Recetas'), form, extra, chips, results);
  root.append(wrap);

  let cats = FALLBACK_CATS;
  try { cats = (await api('/recipes/categories')).categories || FALLBACK_CATS; } catch { /* usa lista estática */ }
  cats.forEach((c) => chips.append(el('button', { class: 'chip', onclick: (e) => {
    chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on');
    show(() => api(`/recipes/filter?c=${encodeURIComponent(c)}`));
  } }, c)));
  show(() => api('/recipes/filter?c=Chicken'));
}

export async function renderRecipe(root, id) {
  const wrap = el('div', { class: 'wrap' }, loading());
  root.append(wrap);
  const r = await api(`/recipes/${encodeURIComponent(id)}`);
  const rec = r.recipe;
  const body = el('div');

  const draw = (t) => {
    body.replaceChildren(
      el('h3', {}, 'Ingredientes'),
      el('ul', { class: 'clean' }, (t ? t.ingredients : rec.ingredients).map((i) => el('li', {}, el('span', {}, i.name), el('span', { class: 'muted' }, i.measure)))),
      el('h3', { style: 'margin-top:20px' }, 'Preparación'),
      el('div', { class: 'instr' }, t ? t.instructions : rec.instructions));
  };
  draw();

  let isFav = r.isFavorite;
  const favBtn = el('button', { class: 'btn btn-outline' }, isFav ? '♥ Favorita' : '♡ Favorita');
  favBtn.addEventListener('click', () => {
    if (!session.token) { location.hash = '#/cuenta'; return; }
    guarded(favBtn, async () => {
      if (isFav) await api(`/favorites/${rec.idMeal}`, { method: 'DELETE' });
      else await api('/favorites', { method: 'POST', body: { idMeal: rec.idMeal, name: rec.name, thumbnail: rec.thumbnail || '' } });
      isFav = !isFav;
    }, '…').then(() => { favBtn.textContent = isFav ? '♥ Favorita' : '♡ Favorita'; });
  });

  const trBtn = el('button', { class: 'btn btn-orange' }, 'Traducir al español');
  trBtn.addEventListener('click', () => {
    if (!session.token) { location.hash = '#/cuenta'; return; }
    guarded(trBtn, async () => {
      const t = await api(`/recipes/${rec.idMeal}/translate`, { method: 'POST' });
      draw(t.translation);
      if (t.translated) { title.textContent = t.translation.name; trBtn.hidden = true; }
    }, 'Traduciendo…');
  });

  const title = el('h1', {}, rec.name);
  wrap.replaceChildren(
    el('a', { href: '#/recetas' }, '← Volver a recetas'),
    el('div', { class: 'recipe', style: 'margin-top:14px' },
      el('div', {}, rec.thumbnail && el('img', { src: rec.thumbnail, alt: rec.name }),
        el('p', { class: 'muted' }, [rec.category, rec.area].filter(Boolean).join(' · ')),
        el('div', { class: 'actions' }, favBtn, trBtn, rec.youtube && /^https:\/\/(www\.)?youtube\.com\//.test(rec.youtube) && el('a', { class: 'btn btn-outline', href: rec.youtube, target: '_blank', rel: 'noopener noreferrer' }, 'Ver video'))),
      el('div', {}, title,
        r.conflicts.length > 0 && el('div', { class: 'alert err', role: 'alert' }, 'Contiene ingredientes que coinciden con tus alergias: ', conflictBadges(r.conflicts)),
        body)));
}

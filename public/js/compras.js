import { el, api, errorBox, toast } from './api.js';

export async function renderShopping(root) {
  const wrap = el('div', { class: 'wrap' }, el('h1', {}, 'Lista de compras'));
  root.append(wrap);
  const { list } = await api('/shopping');
  if (!list) {
    wrap.append(el('p', { class: 'muted' }, 'Aún no tienes una lista. Genera tu menú y crea la lista desde el planificador.'), el('a', { class: 'btn btn-green', href: '#/planificador' }, 'Ir al planificador'));
    return;
  }

  const progress = el('p', { class: 'muted' });
  const groups = el('div');
  const updateProgress = () => {
    const toBuy = list.items.filter((i) => !i.inPantry);
    progress.textContent = `${toBuy.filter((i) => i.checked).length} de ${toBuy.length} por comprar · ${list.items.length - toBuy.length} ya los tienes en tu despensa`;
  };

  const row = (it) => {
    const cb = el('input', { type: 'checkbox', id: `i-${it._id}`, checked: it.checked, 'aria-label': it.name });
    cb.addEventListener('change', async () => {
      const prev = it.checked; it.checked = cb.checked; updateProgress();
      try { await api(`/shopping/${list._id}`, { method: 'PATCH', body: { itemId: it._id, checked: cb.checked } }); }
      catch (err) { it.checked = prev; cb.checked = prev; updateProgress(); toast(err.message, 'err'); }
    });
    return el('li', {},
      el('label', { for: `i-${it._id}`, style: 'display:flex;gap:10px;align-items:center;font-weight:500;margin:0;flex:1' }, cb,
        el('span', { class: it.inPantry ? 'done' : '' }, it.name)),
      el('span', { class: 'muted small' }, it.inPantry ? 'Ya en tu despensa' : it.quantityText));
  };

  const byCat = new Map();
  list.items.forEach((i) => { if (!byCat.has(i.category)) byCat.set(i.category, []); byCat.get(i.category).push(i); });
  for (const [cat, items] of byCat) groups.append(el('div', { class: 'card card-pad', style: 'margin-bottom:14px' }, el('h3', {}, cat), el('ul', { class: 'clean' }, items.map(row))));
  updateProgress();
  wrap.append(progress, groups);
}

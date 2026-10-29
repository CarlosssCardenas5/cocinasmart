import { el, api, toast, errorBox, loading, conflictBadges, guarded } from './api.js';

export async function renderPantry(root) {
  const wrap = el('div', { class: 'wrap' });
  const listBox = el('div');
  const searchBox = el('div');

  const itemRow = (it) => {
    const del = el('button', { class: 'btn btn-danger btn-sm', 'aria-label': `Quitar ${it.name}` }, 'Quitar');
    del.addEventListener('click', () => guarded(del, async () => { await api(`/pantry/${it._id}`, { method: 'DELETE' }); await load(); }, '…'));
    return el('li', {},
      el('span', {}, el('strong', {}, it.name), ' ',
        it.nutriScore && el('span', { class: `badge nutri-${it.nutriScore}` }, `Nutri-Score ${it.nutriScore}`),
        it.nova && el('span', { class: 'badge' }, `NOVA ${it.nova}`),
        it.kcalPer100g != null && el('span', { class: 'badge' }, `${it.kcalPer100g} kcal/100 g`),
        conflictBadges(it.conflicts)),
      del);
  };

  async function load() {
    listBox.replaceChildren(loading());
    try {
      const { items } = await api('/pantry');
      listBox.replaceChildren(items.length ? el('ul', { class: 'clean' }, items.map(itemRow)) : el('p', { class: 'muted' }, 'Tu despensa está vacía. Agrega ingredientes o productos.'));
    } catch (err) { listBox.replaceChildren(errorBox(err)); }
  }

  const name = el('input', { type: 'text', id: 'm-name', placeholder: 'Ej.: arroz, pollo, tomate', maxlength: 120, required: true, minlength: 2 });
  const addBtn = el('button', { class: 'btn btn-green', type: 'submit' }, 'Agregar');
  const manual = el('form', { class: 'inline', onsubmit: (e) => {
    e.preventDefault();
    guarded(addBtn, async () => { await api('/pantry', { method: 'POST', body: { type: 'manual', name: name.value } }); name.value = ''; await load(); }, '…');
  } }, el('div', { class: 'field', style: 'margin:0' }, el('label', { for: 'm-name' }, 'Ingrediente'), name), addBtn);

  const code = el('input', { type: 'text', id: 'b-code', inputmode: 'numeric', pattern: '\\d{8,14}', placeholder: '8 a 14 dígitos', required: true });
  const codeBtn = el('button', { class: 'btn btn-green', type: 'submit' }, 'Agregar producto');
  const barcode = el('form', { class: 'inline', onsubmit: (e) => {
    e.preventDefault();
    guarded(codeBtn, async () => {
      const r = await api('/pantry', { method: 'POST', body: { type: 'packaged', barcode: code.value.trim() } });
      if (r.conflicts.length) toast('Atención: este producto contiene alérgenos de tu perfil.', 'warn');
      code.value = ''; await load();
    }, 'Consultando…');
  } }, el('div', { class: 'field', style: 'margin:0' }, el('label', { for: 'b-code' }, 'Código de barras'), code), codeBtn);

  const sq = el('input', { type: 'search', id: 's-q', placeholder: 'Buscar producto (ej.: yogur natural)', minlength: 2, maxlength: 60, required: true });
  const sBtn = el('button', { class: 'btn btn-outline', type: 'submit' }, 'Buscar productos');
  const search = el('form', { class: 'inline', onsubmit: (e) => {
    e.preventDefault();
    guarded(sBtn, async () => {
      const { products } = await api(`/products/search?q=${encodeURIComponent(sq.value.trim())}`);
      searchBox.replaceChildren(products.length ? el('ul', { class: 'clean' }, products.map((p) => {
        const b = el('button', { class: 'btn btn-green btn-sm' }, 'Agregar');
        b.addEventListener('click', () => guarded(b, async () => { await api('/pantry', { method: 'POST', body: { type: 'packaged', barcode: p.barcode, name: p.name } }); await load(); toast('Agregado a tu despensa', 'ok'); }, '…'));
        return el('li', {}, el('span', {}, el('strong', {}, p.name), p.brand && ` · ${p.brand} `,
          p.nutriScore && el('span', { class: `badge nutri-${p.nutriScore}` }, `Nutri-Score ${p.nutriScore}`), conflictBadges(p.conflicts)), b);
      })) : el('p', { class: 'muted' }, 'Sin resultados.'));
    }, 'Buscando…');
  } }, el('div', { class: 'field', style: 'margin:0' }, el('label', { for: 's-q' }, 'Buscar en Open Food Facts'), sq), sBtn);

  wrap.append(el('h1', {}, 'Mi despensa'),
    el('div', { class: 'grid-3' },
      el('div', { class: 'card card-pad' }, el('h3', {}, 'Ingrediente manual'), manual),
      el('div', { class: 'card card-pad' }, el('h3', {}, 'Producto con código de barras'), barcode),
      el('div', { class: 'card card-pad' }, el('h3', {}, 'Buscar producto'), search, searchBox)),
    el('h2', { style: 'margin-top:28px' }, 'Lo que tienes'), listBox);
  root.append(wrap);
  await load();
}

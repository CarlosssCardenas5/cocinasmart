import { el, api, toast, errorBox, loading, guarded } from './api.js';

const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DAY_LABEL = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };
const SLOTS = ['almuerzo', 'cena'];
const SRC = { ia: 'IA', reglas: 'Reglas', manual: 'Manual' };

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function mondayOf(d) { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export async function renderPlanner(root) {
  let monday = mondayOf(new Date());
  let entries = [];
  const wrap = el('div', { class: 'wrap' });
  const head = el('div'); const grid = el('div', { class: 'scroll-x' }); const msg = el('div');
  root.append(wrap); wrap.append(el('h1', {}, 'Planificador semanal'), head, msg, grid);

  const weekStart = () => fmt(monday);
  const save = async () => { await api(`/plans/${weekStart()}`, { method: 'PUT', body: { entries } }); };

  function drawGrid() {
    const cell = (day, slot) => {
      const e = entries.find((x) => x.day === day && x.slot === slot);
      if (!e) return el('div', { class: 'cell muted' }, 'Libre');
      const rm = el('button', { class: 'btn btn-danger btn-sm', 'aria-label': `Quitar ${e.name}` }, '×');
      rm.addEventListener('click', () => guarded(rm, async () => { entries = entries.filter((x) => x !== e); await save(); drawGrid(); }, '…'));
      return el('div', { class: 'cell' }, el('a', { href: `#/receta/${e.idMeal}` }, e.name), el('div', {}, el('span', { class: 'badge' }, SRC[e.source] || e.source), rm));
    };
    grid.replaceChildren(el('table', { class: 'plan' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Día'), SLOTS.map((s) => el('th', {}, s[0].toUpperCase() + s.slice(1))))),
      el('tbody', {}, DAYS.map((d, i) => el('tr', {}, el('th', {}, `${DAY_LABEL[d]} ${addDays(monday, i).getDate()}`), SLOTS.map((s) => el('td', {}, cell(d, s))))))));
  }

  async function loadWeek() {
    msg.replaceChildren(); grid.replaceChildren(loading());
    try { entries = (await api(`/plans/${weekStart()}`)).plan.entries || []; drawGrid(); } catch (err) { grid.replaceChildren(errorBox(err)); }
    drawHead();
  }

  async function generate(useAI, btn) {
    await guarded(btn, async () => {
      const r = await api('/plans/generate', { method: 'POST', body: { weekStart: weekStart(), useAI } });
      entries = r.plan.entries; drawGrid();
      msg.replaceChildren(el('div', { class: r.source === 'ia' ? 'alert ok' : 'alert' }, r.source === 'ia' ? '✨ Menú generado con IA a partir de recetas reales de TheMealDB.' : 'Menú generado con el método de respaldo por reglas.'));
    }, 'Generando…');
  }

  function drawHead() {
    const ai = el('button', { class: 'btn btn-orange' }, 'Generar con IA');
    const rules = el('button', { class: 'btn btn-outline' }, 'Generar por reglas');
    const shop = el('button', { class: 'btn btn-green' }, 'Crear lista de compras');
    ai.addEventListener('click', () => generate(true, ai));
    rules.addEventListener('click', () => generate(false, rules));
    shop.addEventListener('click', () => guarded(shop, async () => { await api('/shopping/generate', { method: 'POST', body: { weekStart: weekStart() } }); location.hash = '#/compras'; }, 'Creando…'));

    const prev = el('button', { class: 'btn btn-outline btn-sm', onclick: () => { monday = addDays(monday, -7); loadWeek(); } }, '← Anterior');
    const next = el('button', { class: 'btn btn-outline btn-sm', onclick: () => { monday = addDays(monday, 7); loadWeek(); } }, 'Siguiente →');

    // Agregar receta manual
    const day = el('select', { 'aria-label': 'Día' }, DAYS.map((d) => el('option', { value: d }, DAY_LABEL[d])));
    const slot = el('select', { 'aria-label': 'Comida' }, SLOTS.map((s) => el('option', { value: s }, s)));
    const q = el('input', { type: 'search', placeholder: 'Buscar receta para agregar', minlength: 2, maxlength: 60, 'aria-label': 'Buscar receta' });
    const pick = el('select', { 'aria-label': 'Resultados', hidden: true });
    const sBtn = el('button', { class: 'btn btn-outline btn-sm', type: 'submit' }, 'Buscar');
    const addBtn = el('button', { class: 'btn btn-green btn-sm', type: 'button', hidden: true }, 'Agregar al plan');
    let found = [];
    const form = el('form', { class: 'inline', onsubmit: (e) => {
      e.preventDefault();
      guarded(sBtn, async () => {
        found = (await api(`/recipes/search?q=${encodeURIComponent(q.value.trim())}`)).recipes.slice(0, 15);
        pick.replaceChildren(...found.map((r, i) => el('option', { value: i }, r.name)));
        pick.hidden = addBtn.hidden = !found.length;
        if (!found.length) toast('Sin resultados', 'info');
      }, '…');
    } }, day, slot, q, sBtn, pick, addBtn);
    addBtn.addEventListener('click', () => guarded(addBtn, async () => {
      const r = found[Number(pick.value)]; if (!r) return;
      entries = entries.filter((x) => !(x.day === day.value && x.slot === slot.value));
      entries.push({ day: day.value, slot: slot.value, idMeal: r.idMeal, name: r.name, thumbnail: r.thumbnail || '', source: 'manual' });
      await save(); drawGrid();
    }, '…'));

    head.replaceChildren(
      el('div', { class: 'actions', style: 'align-items:center;margin:0 0 14px' }, prev, el('strong', {}, `Semana del ${DAY_LABEL.lunes.toLowerCase()} ${weekStart()}`), next),
      el('div', { class: 'actions', style: 'margin:0 0 14px' }, ai, rules, shop),
      el('details', { style: 'margin-bottom:14px' }, el('summary', {}, 'Agregar una receta manualmente'), form));
  }

  drawHead();
  await loadWeek();
}

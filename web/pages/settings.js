import { $, $$, esc, inr, fmtDate, todayYmd, errorBox, loading, onSubmit, toast, statusPill, rerender } from '../ui.js';

// Admin settings: ownership (§79–80), expense rules (§86), period close (§77), menu/recipes, users.
// Partners get a read-only view of ownership and closed periods.
const TABS = [
  ['ownership', 'Partners & ownership', ['ADMIN', 'PARTNER']],
  ['periods', 'Closed periods', ['ADMIN', 'PARTNER']],
  ['qr', 'Menu QR', ['ADMIN', 'PARTNER']],
  ['expenses', 'Expense rules', ['ADMIN']],
  ['menu', 'Menu & recipes', ['ADMIN']],
  ['users', 'Users', ['ADMIN']],
];

export async function render(root, ctx) {
  const tabs = TABS.filter((t) => t[2].includes(ctx.user.role));
  root.innerHTML = `
    <div class="page-head"><h1>Settings</h1></div>
    <div class="seg" role="tablist" style="margin-bottom:16px">${tabs.map(([id, l], i) => `<button role="tab" data-tab="${id}" aria-selected="${i === 0}">${esc(l)}</button>`).join('')}</div>
    <div id="tab"></div>`;
  const show = (id) => {
    $$('[data-tab]', root).forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === id));
    const holder = document.createElement('div');
    $('#tab', root).replaceChildren(holder);
    holder.innerHTML = loading();
    ({ ownership, periods, qr, expenses, menu, users })[id](holder, ctx).catch((e) => { holder.innerHTML = errorBox(e); });
  };
  $$('[data-tab]', root).forEach((b) => b.onclick = () => show(b.dataset.tab));
  show(tabs[0][0]);
}

function firstOfNextMonth() {
  const [y, m] = todayYmd().split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

async function ownership(root, ctx) {
  const d = await ctx.call('getOwnership');
  const isAdmin = ctx.user.role === 'ADMIN';
  const active = d.partners.filter((p) => p.status !== 'INACTIVE');
  root.innerHTML = `
    <section class="card">
      <h2>Current ownership</h2>
      ${isAdmin ? `
      <form id="oform">
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Partner</th><th>Gmail</th><th class="num">Ownership %</th></tr></thead>
          <tbody>${active.map((p) => `<tr><td><strong>${esc(p.name)}</strong></td><td class="small muted">${esc(p.gmail)}</td>
            <td class="num"><input name="${esc(p.partner_id)}" type="number" min="0" max="100" step="0.01" value="${p.ownership}" style="width:110px;text-align:right" inputmode="decimal" required></td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="2">Total</td><td class="num" id="otot"></td></tr></tfoot>
        </table></div>
        <div class="form" style="margin-top:12px">
          <label>Effective from<input type="date" name="effective_from" value="${firstOfNextMonth()}" min="${todayYmd()}" required></label>
          <label class="row" style="color:var(--text)"><input type="checkbox" name="allow_backdate" style="width:auto"> Allow back-dating (all partners agreed)</label>
          <button class="btn" type="submit">Save ownership change</button>
        </div>
        <div id="oerr"></div>
        <p class="muted small">Ownership changes are sensitive: history is never overwritten. Earlier periods keep the percentages that applied then. Every change is audited.</p>
      </form>` : `
      <div class="table-wrap"><table class="data"><thead><tr><th>Partner</th><th class="num">Ownership</th></tr></thead>
      <tbody>${active.map((p) => `<tr><td>${esc(p.name)}</td><td class="num">${p.ownership}%</td></tr>`).join('')}</tbody></table></div>`}
      ${d.pending ? '<div class="alert">A future-dated ownership change is scheduled. See history below.</div>' : ''}
    </section>
    <section class="card">
      <h2>Ownership history</h2>
      <div class="table-wrap"><table class="data"><thead><tr><th>Partner</th><th class="num">%</th><th>Effective from</th><th>Effective to</th><th>By</th></tr></thead>
      <tbody>${d.history.map((h) => `<tr><td>${esc(h.name)}</td><td class="num">${esc(h.percentage)}%</td><td>${fmtDate(h.effective_from)}</td><td>${h.effective_to ? fmtDate(h.effective_to) : '<span class="pill paid">current</span>'}</td><td class="small muted">${esc(h.created_by)}</td></tr>`).join('')}</tbody></table></div>
    </section>`;

  const form = $('#oform', root);
  if (!form) return;
  const ids = active.map((p) => p.partner_id);
  const total = () => ids.reduce((s, id) => s + (Number(form.elements[id].value) || 0), 0);
  const draw = () => {
    const t = Math.round(total() * 100) / 100;
    $('#otot', root).innerHTML = `<span style="color:var(${t === 100 ? '--ok' : '--err'})">${t}%</span>`;
    $('#oerr', root).innerHTML = t === 100 ? '' : '<div class="alert error">Partner ownership must total 100%.</div>';
  };
  form.addEventListener('input', draw);
  form.allow_backdate.addEventListener('change', () => { form.effective_from.min = form.allow_backdate.checked ? '' : todayYmd(); });
  draw();
  onSubmit(form, async (v) => {
    if (Math.abs(total() - 100) > 0.0001) throw new Error('Partner ownership must total 100%.');
    const rows = ids.map((id) => ({ partner_id: id, percentage: Number(v[id]) }));
    const summary = rows.map((r) => `${active.find((p) => p.partner_id === r.partner_id).name} ${r.percentage}%`).join(', ');
    if (!confirm(`Change ownership to ${summary}, effective ${fmtDate(v.effective_from)}?\n\nThis affects profit shares from that date onwards.`)) return;
    await ctx.call('setOwnership', { effective_from: v.effective_from, rows, allow_backdate: v.allow_backdate === 'on' });
    toast('Ownership updated');
    rerender(root, ownership, ctx);
  });
}

async function periods(root, ctx) {
  const rows = await ctx.call('listDistributions');
  const isAdmin = ctx.user.role === 'ADMIN';
  root.innerHTML = `
    ${isAdmin ? `<section class="card">
      <h2>Close a period</h2>
      <p class="muted small">Saves a permanent snapshot of each partner's calculated share for the period (PARTNER_DISTRIBUTIONS). Once closed, ownership can't be changed for those dates.</p>
      <form class="form" id="cform">
        <label>From<input type="date" name="from" required max="${todayYmd()}"></label>
        <label>To<input type="date" name="to" required max="${todayYmd()}"></label>
        <button class="btn" type="submit">Close period</button>
      </form>
    </section>` : ''}
    <section class="card">
      <h2>Closed periods</h2>
      ${rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Period</th><th>Partner</th><th class="num">Own %</th><th class="num">Distributable</th><th class="num">Share</th><th class="num">Paid (now)</th><th class="num">Remaining (now)</th><th>Status (now)</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${fmtDate(r.period_start)} – ${fmtDate(r.period_end)}</td><td>${esc(r.partner)}</td><td class="num">${esc(r.ownership_percentage)}</td><td class="num">${inr(r.distributable_profit)}</td><td class="num">${inr(r.calculated_share)}</td><td class="num">${inr(r.live_paid)}</td><td class="num">${inr(r.live_remaining)}</td><td>${statusPill(r.live_status)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No periods closed yet.</p>'}
    </section>`;
  const form = $('#cform', root);
  if (form) onSubmit(form, async (v) => {
    if (!confirm(`Close ${fmtDate(v.from)} – ${fmtDate(v.to)}? This cannot be undone.`)) return;
    await ctx.call('closePeriod', v);
    toast('Period closed');
    rerender(root, periods, ctx);
  });
}

async function qr(root) {
  const url = new URL('menu.html', location.href).href.split('#')[0];
  root.innerHTML = `
    <section class="card">
      <h2>Customer menu QR</h2>
      <p class="muted">Customers scan this code to open the public menu. It shows item names, prices and descriptions only, never costs or partner data.</p>
      <div class="row" style="align-items:flex-start;gap:24px">
        <img src="qr/menu-qr.svg" alt="Menu QR code" width="220" height="220" style="border-radius:12px;background:var(--cream)">
        <div style="display:grid;gap:8px;min-width:220px;flex:1">
          <a class="btn" href="qr.html" target="_blank" rel="noopener">Open printable table card</a>
          <a class="btn ghost" href="qr/menu-qr.png" download="pourology-menu-qr.png">Download PNG (print)</a>
          <a class="btn ghost" href="menu.html" target="_blank" rel="noopener">Preview menu</a>
          <p class="small muted">Menu link: <a href="menu.html" target="_blank" rel="noopener">${esc(url)}</a></p>
          <p class="small muted">The QR always points to the menu page, so it never needs reprinting when prices change. Edit items in Settings → Menu & recipes.</p>
        </div>
      </div>
    </section>`;
}

async function expenses(root, ctx) {
  const d = await ctx.call('listExpenses', { period: 'TODAY' });
  root.innerHTML = `
    <section class="card">
      <h2>Expense categories</h2>
      <p class="muted small">Partners decide which recorded expenses reduce distributable profit. Unticked categories are still recorded but not subtracted.</p>
      <form id="xform">
        <div id="cats">${d.categories.map((c) => catRow(c, d.distributable.includes(c))).join('')}</div>
        <div class="row" style="margin-top:12px"><input id="newcat" placeholder="New category" maxlength="40" style="max-width:240px"><button type="button" class="btn ghost" id="addcat">Add</button></div>
        <div class="row" style="margin-top:12px"><button class="btn" type="submit">Save expense rules</button></div>
      </form>
    </section>`;
  $('#addcat', root).onclick = () => {
    const v = $('#newcat', root).value.trim().replace(/,/g, ' ');
    if (!v) return;
    $('#cats', root).insertAdjacentHTML('beforeend', catRow(v, true));
    $('#newcat', root).value = '';
  };
  root.addEventListener('click', (e) => { if (e.target.dataset.rm !== undefined) e.target.closest('.cart-line').remove(); });
  onSubmit($('#xform', root), async () => {
    const lines = $$('#cats .cart-line', root);
    const categories = lines.map((l) => l.dataset.cat);
    const distributable = lines.filter((l) => $('input', l).checked).map((l) => l.dataset.cat);
    if (!confirm(`Distributable categories will be: ${distributable.join(', ') || 'none'}.\nThis changes partner profit calculations for all periods. Continue?`)) return;
    await ctx.call('setExpenseRules', { categories, distributable });
    toast('Expense rules saved');
  });
}
const catRow = (c, on) => `<div class="cart-line" data-cat="${esc(c)}"><label class="row" style="color:var(--text)"><input type="checkbox" ${on ? 'checked' : ''} style="width:auto"> ${esc(c)}</label><button type="button" class="btn ghost small" data-rm>Remove</button></div>`;

async function menu(root, ctx) {
  const d = await ctx.call('getCatalog');
  const ingName = Object.fromEntries(d.ingredients.map((i) => [i.ingredient_id, `${i.name} (${i.unit})`]));
  root.innerHTML = `
    <section class="card">
      <h2>Menu items</h2>
      <div class="table-wrap"><table class="data"><thead><tr><th>Item</th><th class="num">Price</th><th class="num">COGS</th><th class="num">Margin</th><th>Status</th><th></th></tr></thead>
      <tbody>${d.items.map((i) => `<tr><td><strong>${esc(i.name)}</strong> <span class="pill">${esc(i.category)}</span><div class="muted small">${d.recipes.filter((r) => r.item_id === i.item_id).map((r) => `${esc(r.qty)} ${esc(ingName[r.ingredient_id] || '?')}`).join(' · ') || 'No recipe'}</div></td>
        <td class="num">${inr(i.price)}</td><td class="num">${inr(i.unit_cogs)}</td><td class="num">${inr(i.price - i.unit_cogs)}</td><td>${esc(i.status.toLowerCase())}</td>
        <td><button class="btn ghost small" data-edit="${esc(i.item_id)}">Edit</button></td></tr>`).join('')}</tbody></table></div>
      <button class="btn ghost" data-edit="" style="margin-top:12px">Add menu item</button>
      <div id="editor"></div>
    </section>
    <section class="card">
      <h2>Ingredients</h2>
      <div class="table-wrap"><table class="data"><thead><tr><th>Ingredient</th><th>Unit</th><th class="num">Cost / unit</th><th class="num">Reorder at</th></tr></thead>
      <tbody>${d.ingredients.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.unit)}</td><td class="num">₹${esc(i.cost_per_unit)}</td><td class="num">${esc(i.reorder_level)}</td></tr>`).join('')}</tbody></table></div>
      <form class="form" id="iform" style="margin-top:12px">
        <label>Name<input name="name" required maxlength="60"></label>
        <label>Unit<input name="unit" required placeholder="g / ml / pc" maxlength="10"></label>
        <label>Cost per unit (₹)<input name="cost_per_unit" type="number" min="0" step="0.0001" required></label>
        <label>Reorder level<input name="reorder_level" type="number" min="0" step="0.01" value="0"></label>
        <button class="btn" type="submit">Add ingredient</button>
      </form>
    </section>`;

  onSubmit($('#iform', root), async (v) => {
    await ctx.call('saveIngredient', { ...v, cost_per_unit: Number(v.cost_per_unit), reorder_level: Number(v.reorder_level) });
    toast('Ingredient added');
    rerender(root, menu, ctx);
  });

  root.addEventListener('click', (e) => {
    if (e.target.dataset.edit === undefined) return;
    const item = d.items.find((i) => i.item_id === e.target.dataset.edit) || { item_id: '', name: '', category: '', price: '', description: '', status: 'ACTIVE', sort: 99 };
    const lines = d.recipes.filter((r) => r.item_id === item.item_id);
    const ingOpts = (sel) => d.ingredients.map((i) => `<option value="${esc(i.ingredient_id)}" ${i.ingredient_id === sel ? 'selected' : ''}>${esc(ingName[i.ingredient_id])}</option>`).join('');
    const lineRow = (l = {}) => `<div class="row rline"><select name="ing" style="flex:2">${ingOpts(l.ingredient_id)}</select><input name="qty" type="number" min="0.01" step="0.01" value="${esc(l.qty || '')}" placeholder="Qty" style="flex:1"><button type="button" class="btn ghost small" data-rmline>×</button></div>`;
    $('#editor', root).innerHTML = `
      <form id="mform" class="card" style="margin-top:16px;background:var(--surface-2)">
        <h3>${item.item_id ? `Edit ${esc(item.name)}` : 'New menu item'}</h3>
        <div class="form">
          <label>Name<input name="name" value="${esc(item.name)}" required maxlength="60"></label>
          <label>Category<input name="category" value="${esc(item.category)}" maxlength="30"></label>
          <label>Price (₹)<input name="price" type="number" min="1" step="0.01" value="${esc(item.price)}" required></label>
          <label>Sort<input name="sort" type="number" value="${esc(item.sort)}"></label>
          <label>Status<select name="status"><option ${item.status === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option><option ${item.status === 'INACTIVE' ? 'selected' : ''}>INACTIVE</option></select></label>
          <label style="grid-column:1/-1">Menu description (shown on the public menu)<input name="description" value="${esc(item.description || '')}" maxlength="200"></label>
        </div>
        <h3 style="margin-top:12px">Recipe (per cup)</h3>
        <div id="rlines" style="display:grid;gap:8px">${lines.map(lineRow).join('')}</div>
        <div class="row" style="margin-top:8px"><button type="button" class="btn ghost small" id="addline">Add ingredient</button></div>
        <div class="row" style="margin-top:12px"><button class="btn" type="submit">Save item</button><button type="button" class="btn ghost" id="cancel">Cancel</button></div>
      </form>`;
    const f = $('#mform', root);
    $('#addline', f).onclick = () => $('#rlines', f).insertAdjacentHTML('beforeend', lineRow());
    $('#cancel', f).onclick = () => { $('#editor', root).innerHTML = ''; };
    f.addEventListener('click', (ev) => { if (ev.target.dataset.rmline !== undefined) ev.target.closest('.rline').remove(); });
    onSubmit(f, async (v) => {
      const saved = await ctx.call('saveMenuItem', { item_id: item.item_id, name: v.name, category: v.category, description: v.description, price: Number(v.price), sort: Number(v.sort), status: v.status });
      const recipe = $$('.rline', f).map((r) => ({ ingredient_id: $('[name=ing]', r).value, qty: Number($('[name=qty]', r).value) })).filter((l) => l.qty > 0);
      await ctx.call('saveRecipe', { item_id: saved.item_id, lines: recipe });
      toast('Menu item saved');
      rerender(root, menu, ctx);
    });
    f.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

async function users(root, ctx) {
  const [list, own] = await Promise.all([ctx.call('listUsers'), ctx.call('getOwnership')]);
  root.innerHTML = `
    <section class="card">
      <h2>Who can sign in</h2>
      <div class="table-wrap"><table class="data"><thead><tr><th>Name</th><th>Google account</th><th>Role</th><th>Partner</th><th>Status</th></tr></thead>
      <tbody>${list.map((u) => `<tr><td>${esc(u.name)}</td><td class="small">${esc(u.email)}</td><td>${esc(u.role)}</td><td>${esc(own.partners.find((p) => p.partner_id === u.partner_id)?.name || '—')}</td><td>${esc(u.status)}</td></tr>`).join('')}</tbody></table></div>
      <h3 style="margin-top:16px">Add or update user</h3>
      <form class="form" id="uform">
        <label>Google email<input name="email" type="email" required></label>
        <label>Name<input name="name" required maxlength="60"></label>
        <label>Role<select name="role"><option value="STAFF">Staff — sales only</option><option value="PARTNER">Partner — financials</option><option value="ADMIN">Admin — everything</option></select></label>
        <label>Linked partner<select name="partner_id"><option value="">None</option>${own.partners.map((p) => `<option value="${esc(p.partner_id)}">${esc(p.name)}</option>`).join('')}</select></label>
        <label>Status<select name="status"><option>ACTIVE</option><option>INACTIVE</option></select></label>
        <button class="btn" type="submit">Save user</button>
      </form>
      <p class="muted small">Staff never see costs, profit or partner data — this is enforced by the server, not just hidden in the app.</p>
    </section>`;
  onSubmit($('#uform', root), async (v) => {
    await ctx.call('saveUser', v);
    toast('User saved');
    rerender(root, users, ctx);
  });
}

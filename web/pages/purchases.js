import { $, esc, inr, num, fmtDate, fmtRange, todayYmd, loading, errorBox, periodPicker, onSubmit, toast } from '../ui.js';

// Anything bought from business income after opening. Every purchase is taken out of profit.
export async function render(root, { user, call }) {
  let catalog;
  try { catalog = await call('getCatalog'); } catch (e) { root.innerHTML = errorBox(e); return; }
  const ings = catalog.ingredients.filter((i) => i.status !== 'INACTIVE');
  root.innerHTML = `
    <div class="page-head"><div><h1>Purchases</h1><p class="muted small">Things bought from business income (milk, beans, cups, ice…). Every purchase is taken out of profit. Setup items paid by investors go under <a href="#/investment">Investment</a>.</p></div></div>
    <section class="card">
      <h2>Add purchase</h2>
      <form class="form" id="pform">
        <label>Item<input name="item" maxlength="100" placeholder="e.g. Milk, paper cups, ice" list="stock-items" required></label>
        <label>Quantity<input name="qty" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="1"></label>
        <label>Unit<input name="unit" maxlength="20" placeholder="kg, L, pc…"></label>
        <label>Total price (₹)<input name="total_cost" type="number" min="0.01" step="0.01" inputmode="decimal" required></label>
        <label>Shop / supplier<input name="supplier" maxlength="100"></label>
        <label>Date<input name="date" type="date" value="${todayYmd()}" max="${todayYmd()}" required></label>
        ${ings.length ? `<label>Add to stock?<select name="ingredient_id"><option value="">No, just record it</option>${ings.map((i) => `<option value="${esc(i.ingredient_id)}">Yes: ${esc(i.name)} (${esc(i.unit)})</option>`).join('')}</select></label>` : ''}
        <button class="btn" type="submit">Save purchase</button>
      </form>
      <datalist id="stock-items">${ings.map((i) => `<option value="${esc(i.name)}">`).join('')}</datalist>
      <p class="muted small">"Add to stock" tracks the quantity in Inventory; the quantity must then be in that item's unit.</p>
    </section>
    <div class="card" id="picker"></div>
    <section class="card" id="out"></section>`;

  const form = $('#pform', root);
  // Typing a stock item's exact name picks it in "Add to stock?", and vice versa.
  form.item.addEventListener('change', () => {
    const ing = ings.find((i) => i.name.toLowerCase() === form.item.value.trim().toLowerCase());
    if (ing && form.ingredient_id) { form.ingredient_id.value = ing.ingredient_id; form.unit.value = ing.unit; }
  });
  form.ingredient_id?.addEventListener('change', () => {
    const ing = ings.find((i) => i.ingredient_id === form.ingredient_id.value);
    if (ing) { form.item.value = ing.name; form.unit.value = ing.unit; }
  });

  let seq = 0, current = { period: 'MONTH' };
  const load = async (p = current) => {
    current = p;
    const out = $('#out', root), mine = ++seq;
    out.innerHTML = loading();
    let d;
    try { d = await call('listPurchases', p); } catch (e) { if (mine === seq) out.innerHTML = errorBox(e); return; }
    if (mine !== seq) return;
    out.innerHTML = `<p class="muted small">${esc(fmtRange(d.range))} · total ${inr(d.total)}</p>
      ${d.rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th>Shop</th><th>Stock</th>${user.role === 'ADMIN' ? '<th></th>' : ''}</tr></thead>
      <tbody>${d.rows.map((r) => `<tr class="${r.status === 'VOID' ? 'void' : ''}"><td>${fmtDate(r.date)}</td><td>${esc(r.ingredient_name)}</td><td class="num">${num(r.qty)} ${esc(r.unit)}</td><td class="num">${inr(r.total_cost)}</td><td>${esc(r.supplier)}</td><td>${r.ingredient_id ? 'Yes' : '<span class="muted">—</span>'}</td>${user.role === 'ADMIN' ? `<td>${r.status === 'VOID' ? '' : `<button class="btn ghost small" data-void="${esc(r.purchase_id)}">Void</button>`}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : '<p class="muted">No purchases in this period.</p>'}`;
  };
  onSubmit(form, async (v, f) => {
    if (v.ingredient_id && !v.qty) throw new Error('Enter the quantity to add it to stock.');
    await call('addPurchase', { ...v, qty: v.qty ? Number(v.qty) : '', total_cost: Number(v.total_cost) });
    toast('Purchase saved');
    f.reset();
    f.date.value = todayYmd();
    load();
  });
  root.addEventListener('click', async (e) => {
    const id = e.target.dataset?.void;
    if (!id) return;
    const reason = prompt('Reason for voiding this purchase?');
    if (!reason) return;
    try { await call('voidPurchase', { purchase_id: id, reason }); toast('Purchase voided'); load(); } catch (err) { toast(err.message, 'error'); }
  });
  periodPicker($('#picker', root), load, { initial: 'MONTH' });
}

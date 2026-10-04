import { $, esc, inr, num, fmtDate, fmtRange, todayYmd, loading, errorBox, periodPicker, onSubmit, toast } from '../ui.js';

export async function render(root, { user, call }) {
  let catalog;
  try { catalog = await call('getCatalog'); } catch (e) { root.innerHTML = errorBox(e); return; }
  const ings = catalog.ingredients.filter((i) => i.status !== 'INACTIVE');
  root.innerHTML = `
    <div class="page-head"><h1>Purchases</h1></div>
    <section class="card">
      <h2>Record purchase</h2>
      <form class="form" id="pform">
        <label>Ingredient<select name="ingredient_id" required>${ings.map((i) => `<option value="${esc(i.ingredient_id)}">${esc(i.name)} (${esc(i.unit)})</option>`).join('')}</select></label>
        <label>Quantity<input name="qty" type="number" min="0.01" step="0.01" inputmode="decimal" required></label>
        <label>Total cost (₹)<input name="total_cost" type="number" min="0.01" step="0.01" inputmode="decimal" required></label>
        <label>Supplier<input name="supplier" maxlength="100"></label>
        <label>Date<input name="date" type="date" value="${todayYmd()}" max="${todayYmd()}" required></label>
        <button class="btn" type="submit">Save purchase</button>
      </form>
      <p class="muted small">The unit cost from this purchase is used for COGS on future sales (changes over 50% need the admin). Purchases add stock; they are not subtracted from profit directly.</p>
    </section>
    <div class="card" id="picker"></div>
    <section class="card" id="out"></section>`;
  let seq = 0, current = { period: 'MONTH' };
  const load = async (p = current) => {
    current = p;
    const out = $('#out', root), mine = ++seq;
    out.innerHTML = loading();
    let d;
    try { d = await call('listPurchases', p); } catch (e) { if (mine === seq) out.innerHTML = errorBox(e); return; }
    if (mine !== seq) return;
    out.innerHTML = `<p class="muted small">${esc(fmtRange(d.range))} · total ${inr(d.total)}</p>
      ${d.rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Ingredient</th><th class="num">Qty</th><th class="num">Total</th><th class="num">Unit cost</th><th>Supplier</th>${user.role === 'ADMIN' ? '<th></th>' : ''}</tr></thead>
      <tbody>${d.rows.map((r) => `<tr class="${r.status === 'VOID' ? 'void' : ''}"><td>${fmtDate(r.date)}</td><td>${esc(r.ingredient_name)}</td><td class="num">${num(r.qty)} ${esc(r.unit)}</td><td class="num">${inr(r.total_cost)}</td><td class="num">₹${Number(r.unit_cost).toFixed(4)}</td><td>${esc(r.supplier)}</td>${user.role === 'ADMIN' ? `<td>${r.status === 'VOID' ? '' : `<button class="btn ghost small" data-void="${esc(r.purchase_id)}">Void</button>`}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : '<p class="muted">No purchases in this period.</p>'}`;
  };
  onSubmit($('#pform', root), async (v, form) => {
    await call('addPurchase', { ...v, qty: Number(v.qty), total_cost: Number(v.total_cost) });
    toast('Purchase saved');
    form.reset();
    form.date.value = todayYmd();
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

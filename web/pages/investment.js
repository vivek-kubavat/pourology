import { $, esc, inr, num, fmtDate, todayYmd, errorBox, onSubmit, toast, rerender } from '../ui.js';
import { stat } from './shared.js';

// Setup items the investors paid for (moka pot, V60, kettle, table…). Tracked only: not taken out of profit.
export async function render(root, { user, call }) {
  const isAdmin = user.role === 'ADMIN';
  let d;
  try { d = await call('listInvestments'); } catch (e) { root.innerHTML = errorBox(e); return; }
  const me = d.partners.some((p) => p.partner_id === user.partner_id) ? user.partner_id : '';

  root.innerHTML = `
    <div class="page-head"><div><h1>Investment</h1><p class="muted small">Items the partners paid for to set up Pourology, with prices. This is a record of who put in what; it is not taken out of profit.</p></div></div>
    <section class="card">
      <div class="grid">
        ${stat('Total invested', inr(d.total), '', 'hl')}
        ${d.by_partner.map((p) => stat(p.name, inr(p.amount))).join('')}
      </div>
    </section>

    <section class="card">
      <h2>Add investment item</h2>
      <form class="form" id="iform">
        <label>Item<input name="item" maxlength="100" placeholder="e.g. Moka pot, V60, kettle, table" required></label>
        <label>Quantity<input name="qty" type="number" min="1" step="1" inputmode="numeric" value="1"></label>
        <label>Price (₹, total)<input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required></label>
        <label>Paid by<select name="paid_by" required>${d.partners.map((p) => `<option value="${esc(p.partner_id)}" ${p.partner_id === me ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
        <label>Date<input name="date" type="date" value="${todayYmd()}" max="${todayYmd()}" required></label>
        <label>Notes<input name="notes" maxlength="200" placeholder="Shop, brand…"></label>
        <button class="btn" type="submit">Save item</button>
      </form>
    </section>

    <section class="card">
      <h2>Items</h2>
      ${d.rows.length ? `<div class="table-wrap"><table class="data">
        <thead><tr><th>Date</th><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th>Paid by</th><th>Notes</th>${isAdmin ? '<th></th>' : ''}</tr></thead>
        <tbody>${d.rows.map((r) => `<tr class="${r.status === 'VOID' ? 'void' : ''}"><td>${fmtDate(r.date)}</td><td>${esc(r.item)}</td><td class="num">${num(r.qty)}</td><td class="num">${inr(r.amount)}</td><td>${esc(r.paid_by_name)}</td><td class="small">${esc(r.notes)}</td>${isAdmin ? `<td>${r.status === 'VOID' ? '<span class="muted small">void</span>' : `<button class="btn ghost small" data-void="${esc(r.investment_id)}">Void</button>`}</td>` : ''}</tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td class="num">${inr(d.total)}</td><td colspan="${isAdmin ? 3 : 2}"></td></tr></tfoot>
      </table></div>` : '<p class="muted">No investment items recorded yet.</p>'}
    </section>`;

  onSubmit($('#iform', root), async (v) => {
    await call('addInvestment', { ...v, qty: Number(v.qty) || 1, amount: Number(v.amount) });
    toast('Investment item saved');
    rerender(root, render, { user, call });
  });
  root.addEventListener('click', async (e) => {
    const id = e.target.dataset?.void;
    if (!id) return;
    const reason = prompt('Why is this item being voided? (kept in the audit log)');
    if (!reason) return;
    try { await call('voidInvestment', { investment_id: id, reason }); toast('Item voided'); rerender(root, render, { user, call }); } catch (err) { toast(err.message, 'error'); }
  });
}

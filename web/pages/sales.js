import { $, esc, inr, num, fmtDate, fmtRange, loading, errorBox, periodPicker, toast } from '../ui.js';
import { stat } from './shared.js';

export async function render(root, { user, call }) {
  root.innerHTML = `<div class="page-head"><h1>Sales</h1></div><div class="card" id="picker"></div><div id="out"></div>`;
  const showCost = user.role !== 'STAFF';
  let current = { period: 'TODAY' }, seq = 0;
  const load = async (p = current) => {
    current = p;
    const out = $('#out', root), mine = ++seq;
    out.innerHTML = loading();
    let d;
    try { d = await call('listSales', p); } catch (e) { if (mine === seq) out.innerHTML = errorBox(e); return; }
    if (mine !== seq) return;
    out.innerHTML = `
      <div class="grid" style="margin-bottom:16px">${stat('Coffees sold', num(d.totals.cups))}${stat('Orders', num(d.totals.orders))}${d.totals.revenue === undefined ? '' : stat('Revenue', inr(d.totals.revenue), '', 'hl')}</div>
      ${d.staff_view ? '<p class="muted small">Staff accounts see today\'s sales only.</p>' : ''}
      <section class="card"><p class="muted small">${esc(fmtRange(d.range))}</p>
      ${d.rows.length ? `<div class="table-wrap"><table class="data">
        <thead><tr><th>Date</th><th>Item</th><th class="num">Qty</th><th class="num">Total</th>${showCost ? '<th class="num">COGS</th>' : ''}<th>Pay</th><th>By</th>${user.role === 'ADMIN' ? '<th></th>' : ''}</tr></thead>
        <tbody>${d.rows.map((r) => `<tr class="${r.status === 'VOID' ? 'void' : ''}"><td>${fmtDate(r.date)} <span class="muted small">${esc(String(r.time).slice(0, 5))}</span></td><td>${esc(r.item_name)}</td><td class="num">${num(r.qty)}</td><td class="num">${inr(r.total)}</td>${showCost ? `<td class="num">${inr(r.total_cogs)}</td>` : ''}<td>${esc(r.payment_mode)}</td><td class="small muted">${esc(String(r.entered_by).split('@')[0])}</td>${user.role === 'ADMIN' ? `<td>${r.status === 'VOID' ? '' : `<button class="btn ghost small" data-void="${esc(r.order_id)}">Void</button>`}</td>` : ''}</tr>`).join('')}</tbody>
      </table></div>` : '<p class="muted">No sales in this period.</p>'}</section>`;
  };
  root.addEventListener('click', async (e) => {
    const id = e.target.dataset?.void;
    if (!id) return;
    const reason = prompt('Reason for voiding this whole order?');
    if (!reason) return;
    try { await call('voidSale', { order_id: id, reason }); toast('Order voided'); load(); } catch (err) { toast(err.message, 'error'); }
  });
  if (user.role === 'STAFF') { $('#picker', root).remove(); load({ period: 'TODAY' }); } else periodPicker($('#picker', root), load);
}

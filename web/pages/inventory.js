import { esc, inr, num, errorBox } from '../ui.js';
import { stat } from './shared.js';

export async function render(root, { call }) {
  let rows;
  try { rows = await call('getInventory'); } catch (e) { root.innerHTML = errorBox(e); return; }
  const value = rows.reduce((s, r) => s + r.stock_value, 0);
  const low = rows.filter((r) => r.low || r.on_hand < 0);
  root.innerHTML = `
    <div class="page-head"><h1>Inventory</h1></div>
    <div class="grid" style="margin-bottom:16px">${stat('Stock value (at latest cost)', inr(value), '', 'hl')}${stat('Ingredients', num(rows.length))}${stat('Low / negative', num(low.length))}</div>
    <section class="card">
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Ingredient</th><th class="num">Purchased</th><th class="num">Used in sales</th><th class="num">On hand</th><th class="num">Cost / unit</th><th class="num">Value</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${esc(r.name)} ${r.on_hand < 0 ? '<span class="pill pending">negative</span>' : r.low ? '<span class="pill partially_paid">low</span>' : ''}</td>
          <td class="num">${num(r.purchased)} ${esc(r.unit)}</td><td class="num">${num(r.used)} ${esc(r.unit)}</td><td class="num"><strong>${num(r.on_hand)} ${esc(r.unit)}</strong></td>
          <td class="num">₹${r.cost_per_unit}</td><td class="num">${inr(r.stock_value)}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="muted small">On hand = purchased − used by recorded sales (using current recipes). Negative stock usually means a purchase hasn't been recorded yet.</p>
    </section>`;
}

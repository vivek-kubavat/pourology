import { esc, inr, num } from '../ui.js';

/** Business P&L: Sales − Purchases − Expenses = Profit (split 20 / 20 / 60). */
export function plLedger(b, { title = 'Business Profit' } = {}) {
  return `
    <h2>${esc(title)}</h2>
    <table class="ledger">
      <tr><td>Sales <span class="muted small">(${num(b.cups)} coffees)</span></td><td class="num">${inr(b.revenue)}</td></tr>
      <tr><td>− Purchases <span class="muted small">(bought from business income)</span></td><td class="num">${inr(b.purchases)}</td></tr>
      <tr><td>− Expenses</td><td class="num">${inr(b.expenses)}</td></tr>
      <tr class="total"><td>= Profit to share</td><td class="num">${inr(b.profit)}</td></tr>
    </table>
    <p class="formula">${esc(b.formula)}. Investment is tracked separately and is not subtracted.</p>`;
}

export function traceBlock(lines, label = 'How is this calculated?') {
  if (!lines || !lines.length) return '';
  return `<details class="trace"><summary>${esc(label)}</summary><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>`;
}

export const stat = (label, value, extra = '', cls = '') =>
  `<div class="stat ${cls}"><div class="label">${esc(label)}</div><div class="value">${value}</div>${extra}</div>`;

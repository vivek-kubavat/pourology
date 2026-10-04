import { esc, inr, num } from '../ui.js';

/** Business P&L ledger with the formula spelled out (§72, §84). */
export function plLedger(b, { title = 'Business Profit' } = {}) {
  return `
    <h2>${esc(title)}</h2>
    <table class="ledger">
      <tr><td>Total revenue <span class="muted small">(${num(b.cups)} coffees · ${num(b.orders)} lines)</span></td><td class="num">${inr(b.revenue)}</td></tr>
      <tr><td>− COGS <span class="muted small">(recipe ingredients, cups, lids)</span></td><td class="num">${inr(b.cogs)}</td></tr>
      <tr><td>= Gross profit</td><td class="num">${inr(b.gross_profit)}</td></tr>
      <tr><td>− Other expenses <span class="muted small">(distributable only)</span></td><td class="num">${inr(b.other_expenses)}</td></tr>
      <tr class="total"><td>Distributable profit</td><td class="num">${inr(b.distributable_profit)}</td></tr>
    </table>
    <p class="formula">${esc(b.formula)}.${b.non_distributable_expenses ? ` ${inr(b.non_distributable_expenses)} of other recorded expenses is not counted as distributable.` : ''} Stock purchases are not subtracted here; their cost is counted through COGS when coffee is sold.</p>`;
}

export function traceBlock(lines, label = 'How is this calculated?') {
  if (!lines || !lines.length) return '';
  return `<details class="trace"><summary>${esc(label)}</summary><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>`;
}

export const stat = (label, value, extra = '', cls = '') =>
  `<div class="stat ${cls}"><div class="label">${esc(label)}</div><div class="value">${value}</div>${extra}</div>`;

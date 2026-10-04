import { $, esc, inr, fmtRange, loading, errorBox, periodPicker, statusPill, DISCLAIMER_HTML, ownershipDonut } from '../ui.js';
import { plLedger, traceBlock } from './shared.js';

// §73–76, §84, §88: Partner Earnings dashboard.
export async function render(root, { call }) {
  root.innerHTML = `
    <div class="page-head"><div><h1>Partner Earnings</h1><p class="muted small">Estimated / internal profit share, derived from recorded sales and expenses.</p></div></div>
    <div class="card" id="picker"></div>
    <div id="body"></div>`;
  let chart, seq = 0;
  periodPicker($('#picker', root), async (p) => {
    const body = $('#body', root);
    const mine = ++seq;
    body.innerHTML = loading();
    let d;
    try { d = await call('getPartnerEarnings', p); } catch (e) { if (mine === seq) body.innerHTML = errorBox(e); return; }
    if (mine !== seq) return; // a newer period was picked meanwhile
    chart?.destroy();
    const b = d.business;
    body.innerHTML = `
      <div class="grid two">
        <section class="card">
          <p class="muted small">${esc(fmtRange(d.range))}</p>
          ${plLedger(b)}
        </section>
        <section class="card">
          <h2>Ownership split</h2>
          <div class="chart-box"><canvas id="donut" aria-label="Ownership split"></canvas></div>
          <p class="muted small" id="donut-fallback">${d.current_ownership.map((o) => `${esc(o.name)} — ${o.percentage}%`).join(' · ')}</p>
        </section>
      </div>

      <section class="card">
        <h2>Partner distribution <span class="muted small">· ${esc(fmtRange(d.range))}</span></h2>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Partner</th><th class="num">Ownership</th><th class="num">Profit share</th><th>Calculation</th></tr></thead>
          <tbody>${d.distribution.map((r) => `
            <tr><td><strong>${esc(r.name)}</strong></td><td class="num">${esc(r.ownership)}</td><td class="num">${inr(r.share)}</td>
            <td>${r.trace.length ? traceBlock(r.trace, r.trace.length === 1 ? r.trace[0].split(': ')[1] : 'Show calculation') : '<span class="muted small">No profit in period</span>'}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr><td>Total distributed</td><td></td><td class="num">${inr(d.total_distributed)}</td><td></td></tr></tfoot>
        </table></div>
        ${d.unallocated_profit ? `<div class="alert error">${inr(d.unallocated_profit)} of profit falls on days with no ownership record and is not distributed. Check Settings → Ownership history.</div>` : ''}
        ${b.distributable_profit < 0 ? '<div class="alert">The business made a loss in this period, so shares are negative (each partner bears their ownership % of the loss).</div>' : ''}
      </section>

      <section class="card">
        <h2>Cumulative earnings</h2>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Partner</th><th class="num">Ownership</th><th class="num">This month</th><th class="num">Total since start</th><th class="num">Paid</th><th class="num">Remaining</th><th>Status</th></tr></thead>
          <tbody>${d.cumulative.map((r) => `
            <tr><td><strong>${esc(r.name)}</strong></td><td class="num">${r.ownership}%</td><td class="num">${inr(r.this_month)}</td><td class="num">${inr(r.total_earned)}</td>
            <td class="num">${inr(r.paid)}</td><td class="num">${inr(r.remaining)}</td><td>${statusPill(r.status)}</td></tr>`).join('')}
          </tbody>
        </table></div>
        ${DISCLAIMER_HTML(d.disclaimer)}
      </section>`;
    chart = ownershipDonut($('#donut', body), d.current_ownership);
    if (chart) $('#donut-fallback', body).hidden = true;
  }, { initial: 'MONTH' });
}

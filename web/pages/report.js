import { $, esc, inr, fmtDate, fmtRange, loading, errorBox, periodPicker, statusPill, downloadCsv, DISCLAIMER_HTML, STATUS_LABEL } from '../ui.js';

// §85: Partner Profit Report with filters and CSV export.
const COLUMNS = [
  { key: 'period', label: 'Period' }, { key: 'from', label: 'From' }, { key: 'to', label: 'To' },
  { key: 'revenue', label: 'Revenue' }, { key: 'cogs', label: 'COGS' }, { key: 'expenses', label: 'Expenses' },
  { key: 'distributable_profit', label: 'Distributable Profit' }, { key: 'partner', label: 'Partner' },
  { key: 'ownership', label: 'Ownership %' }, { key: 'share', label: 'Partner Share' }, { key: 'paid', label: 'Paid' },
  { key: 'remaining', label: 'Remaining' }, { label: 'Status', value: (r) => STATUS_LABEL[r.status] || r.status },
];

const monthLabel = (ymd) => new Date(ymd + 'T00:00:00Z').toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export async function render(root, { call }) {
  let partners = [];
  try { partners = (await call('getOwnership')).partners; } catch (e) { root.innerHTML = errorBox(e); return; }

  root.innerHTML = `
    <div class="page-head"><h1>Partner Profit Report</h1><button class="btn ghost" id="csv" disabled>Export CSV</button></div>
    <section class="card">
      <div id="picker"></div>
      <div class="form" style="margin-top:12px">
        <label>Partner<select id="f-partner"><option value="">All partners</option>${partners.map((p) => `<option value="${esc(p.partner_id)}">${esc(p.name)}</option>`).join('')}</select></label>
        <label>Group by<select id="f-group"><option value="month">Month</option><option value="day">Day</option></select></label>
        <label>Status<select id="f-status"><option value="">Any status</option>${['PENDING', 'PARTIALLY_PAID', 'PAID', 'NO_PROFIT'].map((s) => `<option value="${s}">${STATUS_LABEL[s]}</option>`).join('')}</select></label>
      </div>
    </section>
    <section class="card" id="out"></section>`;

  let period = { period: 'MONTH' }, data = null, seq = 0;
  const load = async () => {
    const out = $('#out', root), mine = ++seq;
    out.innerHTML = loading();
    $('#csv', root).disabled = true;
    try {
      data = await call('getProfitReport', { ...period, partner_id: $('#f-partner', root).value, group_by: $('#f-group', root).value, status: $('#f-status', root).value });
    } catch (e) { if (mine === seq) out.innerHTML = errorBox(e); return; }
    if (mine !== seq) return;
    const rows = data.rows;
    const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
    out.innerHTML = `
      <p class="muted small">${esc(fmtRange(data.range))} · ${esc(data.note)}</p>
      ${rows.length ? `<div class="table-wrap"><table class="data">
        <thead><tr><th>Period</th><th>Partner</th><th class="num">Revenue</th><th class="num">COGS</th><th class="num">Expenses</th><th class="num">Distributable</th><th class="num">Own %</th><th class="num">Share</th><th class="num">Paid</th><th class="num">Remaining</th><th>Status</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td style="white-space:nowrap">${data.group_by === 'day' ? fmtDate(r.from) : `${monthLabel(r.from)}<div class="muted small">${Number(r.from.slice(8))}–${Number(r.to.slice(8))}</div>`}</td>
          <td>${esc(r.partner)}</td><td class="num">${inr(r.revenue)}</td><td class="num">${inr(r.cogs)}</td><td class="num">${inr(r.expenses)}</td>
          <td class="num">${inr(r.distributable_profit)}</td><td class="num">${esc(r.ownership)}</td><td class="num">${inr(r.share)}</td>
          <td class="num">${inr(r.paid)}</td><td class="num">${inr(r.remaining)}</td><td>${statusPill(r.status)}</td></tr>`).join('')}
        </tbody>
        <tfoot><tr><td colspan="7">Total (partner columns)</td><td class="num">${inr(sum('share'))}</td><td class="num">${inr(sum('paid'))}</td><td class="num">${inr(sum('remaining'))}</td><td></td></tr></tfoot>
      </table></div>` : '<p class="muted">No rows for these filters.</p>'}
      ${Object.entries(data.advances).filter(([, v]) => v > 0).map(([id, v]) => `<div class="alert">${esc(partners.find((p) => p.partner_id === id)?.name || id)} has ${inr(v)} withdrawn in advance of earned profit.</div>`).join('')}
      ${DISCLAIMER_HTML(data.disclaimer)}`;
    $('#csv', root).disabled = !rows.length;
  };

  $('#csv', root).onclick = () => data && downloadCsv(`partner-profit-${data.range.from}_${data.range.to}.csv`, COLUMNS, data.rows);
  ['#f-partner', '#f-group', '#f-status'].forEach((s) => $(s, root).addEventListener('change', load));
  periodPicker($('#picker', root), (p) => { period = p; load(); }, { initial: 'MONTH' });
}

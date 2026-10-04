import { $, esc, inr, fmtDate, todayYmd, errorBox, onSubmit, toast, statusPill, rerender } from '../ui.js';

// §77–78: record partner withdrawals; show earned / paid / remaining per partner.
export async function render(root, { user, call }) {
  const isAdmin = user.role === 'ADMIN';
  let earnings, list;
  try {
    [earnings, list] = await Promise.all([call('getPartnerEarnings', { period: 'TODAY' }), call('listWithdrawals', {})]);
  } catch (e) { root.innerHTML = errorBox(e); return; }

  const partners = earnings.cumulative.filter((p) => isAdmin || p.partner_id === user.partner_id);
  root.innerHTML = `
    <div class="page-head"><h1>Withdrawals</h1></div>
    <section class="card">
      <h2>Balances</h2>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Partner</th><th class="num">Earned</th><th class="num">Paid</th><th class="num">Remaining</th><th>Status</th></tr></thead>
        <tbody>${earnings.cumulative.map((p) => `<tr><td><strong>${esc(p.name)}</strong></td><td class="num">${inr(p.total_earned)}</td><td class="num">${inr(p.paid)}</td><td class="num">${inr(p.remaining)}</td><td>${statusPill(p.status)}</td></tr>`).join('')}</tbody>
      </table></div>
    </section>

    ${partners.length ? `
    <section class="card">
      <h2>Record a withdrawal</h2>
      <form class="form" id="wform">
        <label>Partner<select name="partner_id" required>${partners.map((p) => `<option value="${esc(p.partner_id)}">${esc(p.name)} — remaining ${inr(p.remaining)}</option>`).join('')}</select></label>
        <label>Amount (₹)<input name="amount" type="number" inputmode="decimal" min="1" step="0.01" required></label>
        <label>Date<input name="date" type="date" value="${todayYmd()}" max="${todayYmd()}" required></label>
        <label>Reason<input name="reason" value="Profit withdrawal" maxlength="200"></label>
        ${isAdmin ? '<label class="row" style="grid-column:1/-1"><input type="checkbox" name="allow_advance" style="width:auto"> Allow advance beyond remaining payable</label>' : ''}
        <button class="btn" type="submit">Record withdrawal</button>
      </form>
      <p class="muted small">Entered by ${esc(user.email)}. Every withdrawal is written to the audit log.</p>
    </section>` : ''}

    <section class="card">
      <h2>History</h2>
      ${list.length ? `<div class="table-wrap"><table class="data">
        <thead><tr><th>Date</th><th>Partner</th><th class="num">Amount</th><th>Reason</th><th>Entered by</th>${isAdmin ? '<th></th>' : ''}</tr></thead>
        <tbody>${list.map((w) => `<tr class="${w.status === 'VOID' ? 'void' : ''}"><td>${fmtDate(w.date)}</td><td>${esc(w.partner)}</td><td class="num">${inr(w.amount)}</td><td>${esc(w.reason)}</td><td class="small muted">${esc(w.entered_by)}</td>${isAdmin ? `<td>${w.status === 'VOID' ? '<span class="muted small">void</span>' : `<button class="btn ghost small" data-void="${esc(w.withdrawal_id)}">Void</button>`}</td>` : ''}</tr>`).join('')}</tbody>
      </table></div>` : '<p class="muted">No withdrawals recorded yet.</p>'}
    </section>`;

  root.addEventListener('click', async (e) => {
    const id = e.target.dataset?.void;
    if (!id) return;
    const reason = prompt('Why is this withdrawal being voided? (kept in the audit log)');
    if (!reason) return;
    try { await call('voidWithdrawal', { withdrawal_id: id, reason }); toast('Withdrawal voided'); rerender(root, render, { user, call }); } catch (err) { toast(err.message, 'error'); }
  });

  const form = $('#wform', root);
  if (form) onSubmit(form, async (v) => {
    const name = partners.find((p) => p.partner_id === v.partner_id)?.name;
    if (!confirm(`Record withdrawal of ${inr(v.amount)} for ${name}?`)) return;
    const r = await call('recordWithdrawal', { ...v, amount: Number(v.amount), allow_advance: v.allow_advance === 'on' });
    toast(`Recorded. ${name}: earned ${inr(r.earned)}, paid ${inr(r.paid)}, remaining ${inr(r.remaining)}`);
    rerender(root, render, { user, call });
  });
}

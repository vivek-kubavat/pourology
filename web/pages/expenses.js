import { $, esc, inr, fmtDate, fmtRange, todayYmd, loading, errorBox, periodPicker, onSubmit, toast } from '../ui.js';

export async function render(root, { user, call }) {
  root.innerHTML = `
    <div class="page-head"><h1>Other Business Expenses</h1></div>
    <section class="card" id="formcard">${loading()}</section>
    <div class="card" id="picker"></div>
    <section class="card" id="out"></section>`;
  let seq = 0, current = { period: 'MONTH' }, formReady = false;
  const load = async (p = current) => {
    current = p;
    const out = $('#out', root), mine = ++seq;
    out.innerHTML = loading();
    let d;
    try { d = await call('listExpenses', p); } catch (e) { if (mine === seq) out.innerHTML = errorBox(e); return; }
    if (mine !== seq) return;
    if (!formReady) drawForm(d);
    const active = d.rows.filter((r) => r.status !== 'VOID');
    const dist = active.filter((r) => r.distributable).reduce((s, r) => s + Number(r.amount), 0);
    const other = active.filter((r) => !r.distributable).reduce((s, r) => s + Number(r.amount), 0);
    out.innerHTML = `<p class="muted small">${esc(fmtRange(d.range))} · distributable ${inr(dist)}${other ? ` · not distributable ${inr(other)}` : ''}</p>
      ${d.rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th class="num">Amount</th><th>Counts toward profit split?</th>${user.role === 'ADMIN' ? '<th></th>' : ''}</tr></thead>
      <tbody>${d.rows.map((r) => `<tr class="${r.status === 'VOID' ? 'void' : ''}"><td>${fmtDate(r.date)}</td><td>${esc(r.category)}</td><td>${esc(r.description)}</td><td class="num">${inr(r.amount)}</td><td>${r.distributable ? 'Yes' : '<span class="muted">No</span>'}</td>${user.role === 'ADMIN' ? `<td>${r.status === 'VOID' ? '' : `<button class="btn ghost small" data-void="${esc(r.expense_id)}">Void</button>`}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : '<p class="muted">No expenses in this period.</p>'}`;
  };
  const drawForm = (d) => {
    formReady = true;
    $('#formcard', root).innerHTML = `
      <h2>Record expense</h2>
      <form class="form" id="eform">
        <label>Category<select name="category" required>${d.categories.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
        <label>Amount (₹)<input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required></label>
        <label>Description<input name="description" maxlength="200"></label>
        <label>Date<input name="date" type="date" value="${todayYmd()}" max="${todayYmd()}" required></label>
        <button class="btn" type="submit">Save expense</button>
      </form>
      <p class="muted small">Distributable categories (agreed by partners): <strong>${esc(d.distributable.join(', ') || 'none')}</strong>. ${user.role === 'ADMIN' ? 'Change in Settings → Expense rules.' : ''}</p>`;
    onSubmit($('#eform', root), async (v, form) => {
      await call('addExpense', { ...v, amount: Number(v.amount) });
      toast('Expense saved');
      form.reset(); form.date.value = todayYmd();
      load();
    });
  };
  root.addEventListener('click', async (e) => {
    const id = e.target.dataset?.void;
    if (!id) return;
    const reason = prompt('Reason for voiding this expense?');
    if (!reason) return;
    try { await call('voidExpense', { expense_id: id, reason }); toast('Expense voided'); load(); } catch (err) { toast(err.message, 'error'); }
  });
  periodPicker($('#picker', root), load, { initial: 'MONTH' });
}

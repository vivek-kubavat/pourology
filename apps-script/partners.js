/**
 * Business P&L and partner profit sharing (spec §70–90).
 * Everything here is derived on each request from SALES, EXPENSES, PARTNER_OWNERSHIP_HISTORY and
 * PARTNER_WITHDRAWALS — partner earnings are never typed in or stored as running totals.
 */
const DISCLAIMER = 'Estimated / internal profit share for partner reference only. Not a substitute for a ' +
  'chartered accountant, GST/tax filing, formal financial statements or the partnership agreement.';

const R = (paise) => FinanceCore.fromPaise(paise);

function loadFinance_() {
  const sales = readAll_('SALES');
  const expenses = readAll_('EXPENSES');
  const history = readAll_('PARTNER_OWNERSHIP_HISTORY');
  const partners = readAll_('PARTNERS');
  const withdrawals = readAll_('PARTNER_WITHDRAWALS');
  const dist = distributableCategories_();
  const days = FinanceCore.dailyPL(sales, expenses, dist);
  const candidates = [today_()]
    .concat(sales.map((s) => s.date), expenses.map((e) => e.date), history.map((h) => h.effective_from))
    .filter(FinanceCore.isYmd);
  const startDate = candidates.reduce((a, b) => (b < a ? b : a));
  const paid = {};
  withdrawals.forEach((w) => { if (w.status !== 'VOID') paid[w.partner_id] = (paid[w.partner_id] || 0) + FinanceCore.toPaise(w.amount); });
  return { days, history, partners, withdrawals, paid, dist, startDate, today: today_() };
}

function plOut_(s, dist) {
  return {
    revenue: R(s.revenue), cogs: R(s.cogs), gross_profit: R(s.grossProfit), other_expenses: R(s.expenses),
    non_distributable_expenses: R(s.nonDistributableExpenses), distributable_profit: R(s.distributable),
    cups: s.cups, orders: s.orders, distributable_categories: dist,
    formula: 'Distributable profit = Revenue − COGS − Other expenses (' + (dist.length ? dist.join(', ') : 'none selected') + ')',
  };
}

function partnerName_(f, id) {
  const p = f.partners.find((x) => x.partner_id === id);
  return p ? p.name : id;
}

/** Ownership label for a period: "20%" or "20% → 25%" when it changed inside the period. */
function pctLabel_(result) {
  if (!result || !result.segments.length) return '—';
  const seen = [];
  result.segments.forEach((s) => { if (seen.indexOf(s.percentage) < 0) seen.push(s.percentage); });
  return seen.map((x) => x + '%').join(' → ');
}

function partnerIds_(f) {
  const ids = f.partners.map((p) => p.partner_id);
  f.history.forEach((h) => { if (ids.indexOf(h.partner_id) < 0) ids.push(h.partner_id); });
  return ids;
}

function allTime_(f) {
  return FinanceCore.computeShares(f.days, f.history, f.startDate, f.today);
}

function balance_(f, all, id) {
  const earned = all.partners[id] ? all.partners[id].earned : 0;
  const paid = f.paid[id] || 0;
  return { earned: earned, paid: paid, remaining: earned - paid, status: FinanceCore.paymentStatus(earned, paid) };
}

// ---------- actions ----------
function getPL(user, p) {
  const f = loadFinance_();
  const range = resolveRange_(p, f.startDate);
  return Object.assign({ range: range }, plOut_(FinanceCore.summarize(f.days, range.from, range.to), f.dist));
}

/** §73–76, §84: business profit, distribution for the selected period, cumulative table, with calculation trace. */
function getPartnerEarnings(user, p) {
  const f = loadFinance_();
  const range = resolveRange_(p, f.startDate);
  const month = FinanceCore.periodRange('MONTH', f.today);
  const period = FinanceCore.computeShares(f.days, f.history, range.from, range.to);
  const monthShares = FinanceCore.computeShares(f.days, f.history, month.from, month.to);
  const all = allTime_(f);
  const current = FinanceCore.ownershipOn(f.history, f.today);
  const currentPct = (id) => { const c = current.find((x) => x.partner_id === id); return c ? c.percentage : 0; };
  const ids = partnerIds_(f);

  const distribution = ids.map((id) => {
    const r = period.partners[id];
    return { partner_id: id, name: partnerName_(f, id), ownership: pctLabel_(r), share: R(r ? r.earned : 0), trace: FinanceCore.traceLines(r) };
  });
  const cumulative = ids.map((id) => {
    const b = balance_(f, all, id);
    const m = monthShares.partners[id];
    return {
      partner_id: id, name: partnerName_(f, id), ownership: currentPct(id), this_month: R(m ? m.earned : 0),
      total_earned: R(b.earned), paid: R(b.paid), remaining: R(b.remaining), status: b.status,
    };
  });
  const summary = FinanceCore.summarize(f.days, range.from, range.to);
  return {
    range: range,
    business: plOut_(summary, f.dist),
    distribution: distribution,
    total_distributed: R(distribution.reduce((s, d) => s + FinanceCore.toPaise(d.share), 0)),
    unallocated_profit: R(period.unallocated),
    cumulative: cumulative,
    current_ownership: current.map((c) => ({ partner_id: c.partner_id, name: partnerName_(f, c.partner_id), percentage: c.percentage })),
    disclaimer: DISCLAIMER,
  };
}

/** §82–83: "My Business Share" for the signed-in partner. */
function getMyShare(user) {
  const f = loadFinance_();
  const today = FinanceCore.periodRange('TODAY', f.today);
  const month = FinanceCore.periodRange('MONTH', f.today);
  const business = {
    today: plOut_(FinanceCore.summarize(f.days, today.from, today.to), f.dist),
    month: plOut_(FinanceCore.summarize(f.days, month.from, month.to), f.dist),
  };
  if (!user.partner_id) return { partner: null, business: business, disclaimer: DISCLAIMER };

  const id = user.partner_id;
  const t = FinanceCore.computeShares(f.days, f.history, today.from, today.to).partners[id];
  const m = FinanceCore.computeShares(f.days, f.history, month.from, month.to).partners[id];
  const b = balance_(f, allTime_(f), id);
  const own = FinanceCore.ownershipOn(f.history, f.today).find((x) => x.partner_id === id);
  return {
    partner: { partner_id: id, name: partnerName_(f, id), ownership: own ? own.percentage : 0 },
    today_share: R(t ? t.earned : 0), today_trace: FinanceCore.traceLines(t),
    month_share: R(m ? m.earned : 0), month_trace: FinanceCore.traceLines(m),
    total_earned: R(b.earned), paid: R(b.paid), remaining: R(b.remaining), status: b.status,
    business: business, disclaimer: DISCLAIMER,
  };
}

/**
 * §85 Partner Profit Report. Withdrawals are applied oldest-period-first (FIFO) so every period row has
 * paid / remaining / status. p = {period|from,to, group_by: 'month'|'day', partner_id, status}
 */
function getProfitReport(user, p) {
  const f = loadFinance_();
  const range = resolveRange_(p, f.startDate);
  const groupBy = p.group_by === 'day' ? 'day' : 'month';
  // Daily grouping recomputes every day since the start; keep it to sensible ranges (Apps Script has a 6-min limit).
  if (groupBy === 'day' && FinanceCore.buckets(range.from, range.to, 'day').length > 93) {
    throw new Error('Daily grouping is limited to about 3 months. Choose a shorter range or group by month.');
  }
  // Earlier periods are included only so withdrawals can be applied oldest-first; the selected range starts its own bucket.
  const before = range.from > f.startDate ? FinanceCore.buckets(f.startDate, FinanceCore.addDays(range.from, -1), groupBy) : [];
  const allBuckets = before.concat(FinanceCore.buckets(range.from, range.to, groupBy));
  const computed = allBuckets.map((b) => ({
    b: b,
    shares: FinanceCore.computeShares(f.days, f.history, b.from, b.to),
    pl: FinanceCore.summarize(f.days, b.from, b.to),
  }));
  const ids = partnerIds_(f).filter((id) => !p.partner_id || id === p.partner_id);
  const rows = [];
  const advances = {};
  ids.forEach((id) => {
    const fifo = FinanceCore.allocateWithdrawalsFIFO(
      computed.map((c) => ({ key: c.b.key, earned: c.shares.partners[id] ? c.shares.partners[id].earned : 0 })),
      f.paid[id] || 0
    );
    advances[id] = R(fifo.advance);
    computed.forEach((c, i) => {
      if (c.b.to < range.from) return;
      const a = fifo.periods[i];
      rows.push({
        period: c.b.key, from: c.b.from, to: c.b.to,
        revenue: R(c.pl.revenue), cogs: R(c.pl.cogs), expenses: R(c.pl.expenses), distributable_profit: R(c.pl.distributable),
        partner_id: id, partner: partnerName_(f, id), ownership: pctLabel_(c.shares.partners[id]),
        share: R(a.earned), paid: R(a.paid), remaining: R(a.remaining), status: a.status,
      });
    });
  });
  const filtered = p.status ? rows.filter((r) => r.status === p.status) : rows;
  return { range: range, group_by: groupBy, rows: filtered, advances: advances, disclaimer: DISCLAIMER,
    note: 'Withdrawals are applied to the oldest unpaid period first.' };
}

/** §78: record a withdrawal. Partners can record their own; admin can record for anyone. Always audited. */
function recordWithdrawal(user, p) {
  const f = loadFinance_();
  const partnerId = String(p.partner_id || '');
  if (!f.partners.some((x) => x.partner_id === partnerId)) throw new Error('Choose a partner.');
  if (user.role !== ROLES.ADMIN && user.partner_id !== partnerId) throw new Error('You can only record your own withdrawals.');
  const amount = num_(p.amount, 'Amount', { positive: true, max: 10000000 });
  const date = date_(p.date);
  const b = balance_(f, allTime_(f), partnerId);
  const amountPaise = FinanceCore.toPaise(amount);
  if (amountPaise > b.remaining && !(user.role === ROLES.ADMIN && p.allow_advance === true)) {
    throw new Error('Amount is more than the remaining payable (' + FinanceCore.inr(b.remaining) + '). ' +
      'Only an admin can record an advance beyond earned profit.');
  }
  const row = {
    withdrawal_id: newId_('WDL'), partner_id: partnerId, amount: amount, date: date,
    reason: str_(p.reason || 'Profit withdrawal', 'Reason'), entered_by: user.email, created_at: nowIso_(), status: 'ACTIVE',
  };
  append_('PARTNER_WITHDRAWALS', row);
  const after = { earned: R(b.earned), paid: R(b.paid + amountPaise), remaining: R(b.remaining - amountPaise),
    status: FinanceCore.paymentStatus(b.earned, b.paid + amountPaise) };
  audit_(user, 'RECORD_WITHDRAWAL', 'PARTNER_WITHDRAWALS', row.withdrawal_id,
    { earned: R(b.earned), paid: R(b.paid), remaining: R(b.remaining) }, Object.assign({}, row, after));
  return Object.assign({ withdrawal: row }, after);
}

/** Admin correction of a wrongly entered withdrawal. Kept in the sheet as VOID, never deleted; audited. */
function voidWithdrawal(user, p) {
  const row = readAll_('PARTNER_WITHDRAWALS').find((w) => w.withdrawal_id === p.withdrawal_id && w.status !== 'VOID');
  if (!row) throw new Error('Withdrawal not found or already void.');
  const reason = str_(p.reason, 'Reason', true);
  update_('PARTNER_WITHDRAWALS', row._row, { status: 'VOID' });
  audit_(user, 'VOID_WITHDRAWAL', 'PARTNER_WITHDRAWALS', row.withdrawal_id, strip_(row), { status: 'VOID', reason: reason });
  return { withdrawal_id: row.withdrawal_id };
}

function listWithdrawals(user, p) {
  const names = {};
  readAll_('PARTNERS').forEach((x) => { names[x.partner_id] = x.name; });
  return readAll_('PARTNER_WITHDRAWALS')
    .filter((w) => !p.partner_id || w.partner_id === p.partner_id)
    .map((w) => Object.assign(strip_(w), { partner: names[w.partner_id] || w.partner_id }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** §79–80: partners with current %, plus full effective-dated history. */
function getOwnership() {
  const f = loadFinance_();
  const current = FinanceCore.ownershipOn(f.history, f.today);
  return {
    partners: f.partners.map((x) => {
      const c = current.find((o) => o.partner_id === x.partner_id);
      return { partner_id: x.partner_id, name: x.name, gmail: x.gmail, role: x.role, status: x.status, ownership: c ? c.percentage : 0 };
    }),
    history: f.history.map((h) => Object.assign(strip_(h), { name: partnerName_(f, h.partner_id) }))
      .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1)),
    pending: f.history.filter((h) => h.effective_from > f.today).length > 0,
  };
}

/** §79–80: change ownership with an effective date. Never overwrites history. Sensitive — audited. */
function setOwnership(user, p) {
  const f = loadFinance_();
  const known = {};
  f.partners.forEach((x) => { known[x.partner_id] = x; });
  if (!Array.isArray(p.rows) || p.rows.length > 20) throw new Error('Invalid ownership rows.');
  const rows = p.rows.map((r) => ({ partner_id: String(r.partner_id), percentage: Number(r.percentage) }));
  rows.forEach((r) => { if (!known[r.partner_id]) throw new Error('Unknown partner: ' + r.partner_id); });
  if (new Set(rows.map((r) => r.partner_id)).size !== rows.length) throw new Error('Each partner can appear only once.');
  const effectiveFrom = String(p.effective_from || '');
  if (!FinanceCore.isYmd(effectiveFrom)) throw new Error('Effective-from must be a valid date.');

  const closed = readAll_('PARTNER_DISTRIBUTIONS');
  const lastClosed = closed.reduce((m, d) => (d.period_end > m ? d.period_end : m), '');
  if (lastClosed && effectiveFrom <= lastClosed) {
    throw new Error('Effective-from must be after ' + lastClosed + ' — earlier periods are already closed.');
  }

  // Back-dating re-splits profit that may already have been paid out, so it needs an explicit, audited override.
  if (effectiveFrom < f.today && p.allow_backdate !== true) {
    throw new Error('Effective-from is in the past. Ownership changes normally start today or later; tick "allow back-dating" only if all partners agreed.');
  }
  const plan = FinanceCore.planOwnershipChange(f.history, rows, effectiveFrom); // validates Σ = 100%
  const before = FinanceCore.ownershipOn(f.history, f.today);
  plan.close.forEach((c) => {
    const h = f.history.find((x) => x.ownership_id === c.ownership_id);
    update_('PARTNER_OWNERSHIP_HISTORY', h._row, { effective_to: c.effective_to });
  });
  const now = nowIso_();
  const added = plan.add.map((a) => Object.assign(a, { ownership_id: newId_('OWN'), created_by: user.email, created_at: now }));
  appendMany_('PARTNER_OWNERSHIP_HISTORY', added);
  if (effectiveFrom <= f.today) {
    f.partners.forEach((x) => {
      const r = rows.find((y) => y.partner_id === x.partner_id);
      update_('PARTNERS', x._row, { ownership_percentage: r ? r.percentage : 0 });
    });
  }
  audit_(user, 'CHANGE_OWNERSHIP', 'PARTNER_OWNERSHIP_HISTORY', effectiveFrom, { current: before, closed: plan.close }, { effective_from: effectiveFrom, rows: rows, backdated: effectiveFrom < f.today });
  return getOwnership();
}

/**
 * Admin "closes" a period: writes a PARTNER_DISTRIBUTIONS snapshot per partner (§77) for the record.
 * Live screens still recompute; listDistributions shows the snapshot next to live paid/remaining.
 */
function closePeriod(user, p) {
  const f = loadFinance_();
  if (!FinanceCore.isYmd(p.from) || !FinanceCore.isYmd(p.to) || p.from > p.to) throw new Error('Choose a valid period.');
  if (p.to >= f.today) throw new Error('You can only close periods that have fully ended (before today).');
  const existing = readAll_('PARTNER_DISTRIBUTIONS');
  if (existing.some((d) => !(p.to < d.period_start || p.from > d.period_end))) throw new Error('This period overlaps an already closed period.');

  const shares = FinanceCore.computeShares(f.days, f.history, p.from, p.to);
  if (shares.unallocated) throw new Error('Some days in this period have no ownership record. Fix ownership history first.');
  const pl = FinanceCore.summarize(f.days, p.from, p.to);
  const now = nowIso_();
  const snap = partnerIds_(f).filter((id) => shares.partners[id]).map((id) => {
    const periods = existing.filter((d) => d.partner_id === id).sort((a, b) => (a.period_start < b.period_start ? -1 : 1))
      .map((d) => ({ key: d.distribution_id, earned: FinanceCore.toPaise(d.calculated_share) }))
      .concat([{ key: 'new', earned: shares.partners[id].earned }]);
    const a = FinanceCore.allocateWithdrawalsFIFO(periods, f.paid[id] || 0).periods.pop();
    return {
      distribution_id: newId_('DST'), period_start: p.from, period_end: p.to, partner_id: id,
      ownership_percentage: pctLabel_(shares.partners[id]), distributable_profit: R(pl.distributable),
      calculated_share: R(a.earned), paid_amount: R(a.paid), remaining_amount: R(a.remaining),
      status: a.status === 'NO_PROFIT' ? 'PAID' : a.status, created_at: now, created_by: user.email,
    };
  });
  appendMany_('PARTNER_DISTRIBUTIONS', snap);
  audit_(user, 'CLOSE_PERIOD', 'PARTNER_DISTRIBUTIONS', p.from + '..' + p.to, null, snap);
  return snap;
}

function listDistributions() {
  const f = loadFinance_();
  const rows = readAll_('PARTNER_DISTRIBUTIONS').map(strip_);
  const out = [];
  partnerIds_(f).forEach((id) => {
    const mine = rows.filter((r) => r.partner_id === id).sort((a, b) => (a.period_start < b.period_start ? -1 : 1));
    const fifo = FinanceCore.allocateWithdrawalsFIFO(
      mine.map((r) => ({ key: r.distribution_id, earned: FinanceCore.toPaise(r.calculated_share) })), f.paid[id] || 0);
    mine.forEach((r, i) => {
      const a = fifo.periods[i];
      out.push(Object.assign(r, { partner: partnerName_(f, id), live_paid: R(a.paid), live_remaining: R(a.remaining), live_status: a.status }));
    });
  });
  return out.sort((a, b) => (a.period_start < b.period_start ? 1 : -1));
}

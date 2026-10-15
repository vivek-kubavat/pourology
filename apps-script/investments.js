/**
 * Investment: setup items the investors paid for before (or outside) business income, e.g. the moka
 * pot, V60, kettle, table. Recorded per item with its price and who paid. Tracked only: investment
 * is NOT subtracted from profit, and profit is split by ownership % from the first sale.
 */
function addInvestment(user, p) {
  const partners = readAll_('PARTNERS');
  const paidBy = String(p.paid_by || '');
  if (!partners.some((x) => x.partner_id === paidBy)) throw new Error('Choose who paid for it.');
  const qty = p.qty === undefined || p.qty === null || p.qty === '' ? 1 : num_(p.qty, 'Quantity', { positive: true, max: 100000 });
  const row = {
    investment_id: newId_('INV'), date: date_(p.date), item: str_(p.item, 'Item', true).slice(0, 100), qty: qty,
    amount: num_(p.amount, 'Amount', { positive: true, max: 10000000 }), paid_by: paidBy,
    notes: str_(p.notes, 'Notes').slice(0, 200), entered_by: user.email, created_at: nowIso_(), status: 'ACTIVE',
  };
  append_('INVESTMENTS', row);
  audit_(user, 'ADD_INVESTMENT', 'INVESTMENTS', row.investment_id, null, row);
  return row;
}

/** Admin correction. Kept in the sheet as VOID, never deleted; audited. */
function voidInvestment(user, p) {
  const row = readAll_('INVESTMENTS').find((x) => x.investment_id === p.investment_id && x.status !== 'VOID');
  if (!row) throw new Error('Investment entry not found or already void.');
  update_('INVESTMENTS', row._row, { status: 'VOID' });
  audit_(user, 'VOID_INVESTMENT', 'INVESTMENTS', row.investment_id, strip_(row), { status: 'VOID', reason: str_(p.reason, 'Reason', true) });
  return { investment_id: row.investment_id };
}

/** All entries (newest first) plus the total each partner has put in. */
function listInvestments() {
  const partners = readAll_('PARTNERS');
  const names = {};
  partners.forEach((x) => { names[x.partner_id] = x.name; });
  const rows = readAll_('INVESTMENTS').map((r) => Object.assign(strip_(r), { paid_by_name: names[r.paid_by] || r.paid_by }))
    .sort((a, b) => (a.date === b.date ? (a.created_at < b.created_at ? 1 : -1) : (a.date < b.date ? 1 : -1)));
  const by = investmentByPartner_();
  const totals = partners.map((x) => ({ partner_id: x.partner_id, name: x.name, amount: FinanceCore.fromPaise(by[x.partner_id] || 0) }));
  return {
    rows: rows, by_partner: totals, partners: partners.map((x) => ({ partner_id: x.partner_id, name: x.name })),
    total: FinanceCore.fromPaise(Object.keys(by).reduce((t, k) => t + by[k], 0)),
  };
}

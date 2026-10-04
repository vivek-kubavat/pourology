/**
 * Local dev server: serves web/ and runs the REAL apps-script code against in-memory sheets.
 * Seeds two weeks of demo sales/expenses/withdrawals so dashboards have data.
 *   npm run dev  →  http://localhost:5173
 * Dev sign-in tokens are fake JWTs only this server accepts.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createRuntime } = require('../tests/gasMock.js');

const PORT = 5173;
const WEB = path.join(__dirname, '..', 'web');
const app = createRuntime();

const istToday = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

function seedDemo() {
  const today = istToday();
  const start = addDays(today, -13);
  app.setToday(start);
  app.setupForTests();
  const ok = (a, p, who = 'vivek@gmail.com') => { const r = app.call(a, p, who); if (!r.ok) throw new Error(a + ': ' + r.error); return r.data; };
  // ownership must cover the demo window
  const hist = app.ss.getSheetByName('PARTNER_OWNERSHIP_HISTORY');
  hist.rows.slice(1).forEach((r) => { r[3] = start < r[3] ? start : r[3]; });
  ok('saveUser', { email: 'staff@gmail.com', name: 'Ravi (staff)', role: 'STAFF' });
  const items = ok('getCatalog', {}).items;
  [['ING_beans', 8000, 12800], ['ING_milk', 30000, 2100], ['ING_condensed', 2000, 600], ['ING_cup_hot', 600, 2400], ['ING_cup_cold', 300, 1800], ['ING_lid', 900, 1350], ['ING_filter', 300, 750]]
    .forEach(([id, qty, cost]) => ok('addPurchase', { ingredient_id: id, qty, total_cost: cost, supplier: 'Local market', date: start }, 'vivek@gmail.com'));
  for (let i = 0; i < 14; i++) {
    const d = addDays(start, i);
    app.setToday(d);
    items.forEach((it, k) => {
      const qty = it.category === 'Additives' ? 1 + ((i + k) % 4) : 4 + ((i * 7 + k * 5) % 11);
      ok('recordSale', { lines: [{ item_id: it.item_id, qty }], payment_mode: k % 2 ? 'UPI' : 'CASH' }, k === 2 ? 'staff@gmail.com' : 'ishan@gmail.com');
    });
    if (i % 7 === 0) ok('addExpense', { category: 'Stall rent', amount: 700, description: 'Weekly rent', date: d });
    if (i % 3 === 0) ok('addExpense', { category: 'Transport', amount: 150, description: 'Auto', date: d });
  }
  app.setToday(addDays(today, -2));
  ok('recordWithdrawal', { partner_id: 'vivek', amount: 1500, reason: 'Profit withdrawal' }, 'vivek@gmail.com');
  ok('recordWithdrawal', { partner_id: 'ishan', amount: 4000, reason: 'Profit withdrawal' }, 'ishan@gmail.com');
  ok('setStallLocation', { lat: 23.0258, lng: 72.5873, accuracy: 15, label: 'Near Law Garden, Ellisbridge' }, 'ishan@gmail.com');
  ok('setContact', { phone: '9825012345', whatsapp: '9825012345', delivery_enabled: true, delivery_note: '' }, 'ishan@gmail.com');
  app.setToday(null);
}
seedDemo();

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'POST' && url.pathname === '/api') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const out = app.doPost({ postData: { contents: body } });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(out.getContent());
    });
    return;
  }
  if (url.pathname === '/dev-users') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(app.listUsers()));
  }
  if (url.pathname === '/dev-token') {
    const email = url.searchParams.get('email');
    const token = app.devToken(email);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ token }));
  }
  let file;
  try { file = path.normalize(path.join(WEB, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))); }
  catch { res.writeHead(400); return res.end(); }
  if (!file.startsWith(WEB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`Pourology dev server → http://localhost:${PORT}  (menu: /menu.html)`));

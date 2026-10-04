/**
 * Operational features: public menu, menu/recipe setup, quick sale, stall sessions,
 * purchases, expenses, inventory, users. Minimal V1 — extend when sections 1–69 are finalised.
 */

// ---------- helpers ----------
function num_(v, field, opts) {
  opts = opts || {};
  const n = Number(v);
  if (v === '' || v === null || v === undefined || typeof v === 'boolean' || !isFinite(n)) throw new Error(field + ' must be a number.');
  if (Math.abs(n) > (opts.max || 10000000)) throw new Error(field + ' is too large.');
  if (opts.positive && n <= 0) throw new Error(field + ' must be greater than 0.');
  if (!opts.positive && n < 0) throw new Error(field + ' cannot be negative.');
  return n;
}
function str_(v, field, required) {
  const s = String(v === undefined || v === null ? '' : v).trim();
  if (required && !s) throw new Error(field + ' is required.');
  return s.slice(0, 500);
}
function date_(v, field) {
  const d = v ? String(v) : today_();
  if (!FinanceCore.isYmd(d)) throw new Error((field || 'Date') + ' must be a valid date (YYYY-MM-DD).');
  if (d > today_()) throw new Error((field || 'Date') + ' cannot be in the future.');
  if (d < '2020-01-01') throw new Error((field || 'Date') + ' is too far in the past.');
  return d;
}

/** Last day of any closed period ('' if none). Entries dated on/before it would silently change closed figures. */
function lastClosedEnd_() {
  return readAll_('PARTNER_DISTRIBUTIONS').reduce((m, d) => (d.period_end > m ? d.period_end : m), '');
}
function openDate_(v, field) {
  const d = date_(v, field);
  const closed = lastClosedEnd_();
  if (closed && d <= closed) throw new Error('Periods up to ' + closed + ' are closed. Use a later date.');
  return d;
}
function round2_(n) { return Math.round(n * 100) / 100; }

/** Resolve {period, from, to} from the client into an inclusive range (§74). */
function resolveRange_(p, startDate) {
  const r = FinanceCore.periodRange(p.period || 'TODAY', today_(), { from: p.from, to: p.to, startDate: startDate });
  if (r.to > today_()) r.to = today_();
  if (r.from < '2020-01-01') throw new Error('Choose a start date from 2020 onwards.');
  if (r.from > r.to) throw new Error('"From" date must be on or before today.');
  return r;
}

// ---------- public menu (no auth, no financial data — §81) ----------
function getMenu() {
  return readAll_('MENU_ITEMS')
    .filter((m) => m.status === 'ACTIVE')
    .sort((a, b) => Number(a.sort) - Number(b.sort))
    .map((m) => ({ name: m.name, category: m.category, price: Number(m.price), description: m.description || '' }));
}

/** Public endpoint is unauthenticated, so serve it from cache to protect the daily quota. */
function getMenuCached() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('public_menu');
  if (hit) return JSON.parse(hit);
  const menu = getMenu();
  cache.put('public_menu', JSON.stringify(menu), 600);
  return menu;
}
function clearMenuCache_() { CacheService.getScriptCache().remove('public_menu'); }

// ---------- menu & recipes (admin) ----------
function unitCogsMap_() {
  const cost = {};
  readAll_('INGREDIENTS').forEach((i) => { cost[i.ingredient_id] = Number(i.cost_per_unit) || 0; });
  const cogs = {};
  readAll_('RECIPES').forEach((r) => {
    cogs[r.item_id] = (cogs[r.item_id] || 0) + (Number(r.qty) || 0) * (cost[r.ingredient_id] || 0);
  });
  return cogs;
}

function getCatalog(user) {
  const cogs = unitCogsMap_();
  const showCost = user.role !== ROLES.STAFF;
  return {
    items: readAll_('MENU_ITEMS').sort((a, b) => Number(a.sort) - Number(b.sort)).map((m) => {
      const o = { item_id: m.item_id, name: m.name, category: m.category, price: Number(m.price), description: m.description || '', status: m.status, sort: m.sort };
      if (showCost) o.unit_cogs = round2_(cogs[m.item_id] || 0);
      return o;
    }),
    ingredients: showCost ? readAll_('INGREDIENTS').map(strip_) : [],
    recipes: showCost ? readAll_('RECIPES').map(strip_) : [],
  };
}

function saveMenuItem(user, p) {
  const name = str_(p.name, 'Name', true);
  const price = num_(p.price, 'Price', { positive: true });
  const existing = p.item_id ? readAll_('MENU_ITEMS').find((m) => m.item_id === p.item_id) : null;
  const row = {
    item_id: existing ? existing.item_id : newId_('ITM'), name: name, category: str_(p.category, 'Category'),
    price: price, description: str_(p.description, 'Description'), status: p.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE', sort: Number(p.sort) || 99,
    created_at: existing ? existing.created_at : nowIso_(),
  };
  if (existing) update_('MENU_ITEMS', existing._row, row); else append_('MENU_ITEMS', row);
  clearMenuCache_();
  audit_(user, existing ? 'UPDATE_MENU_ITEM' : 'CREATE_MENU_ITEM', 'MENU_ITEMS', row.item_id, existing && strip_(existing), row);
  return row;
}

function saveIngredient(user, p) {
  const existing = p.ingredient_id ? readAll_('INGREDIENTS').find((i) => i.ingredient_id === p.ingredient_id) : null;
  const row = {
    ingredient_id: existing ? existing.ingredient_id : newId_('ING'), name: str_(p.name, 'Name', true),
    unit: str_(p.unit, 'Unit', true), cost_per_unit: num_(p.cost_per_unit, 'Cost per unit'),
    reorder_level: num_(p.reorder_level || 0, 'Reorder level'), status: p.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    created_at: existing ? existing.created_at : nowIso_(),
  };
  if (existing) update_('INGREDIENTS', existing._row, row); else append_('INGREDIENTS', row);
  audit_(user, existing ? 'UPDATE_INGREDIENT' : 'CREATE_INGREDIENT', 'INGREDIENTS', row.ingredient_id, existing && strip_(existing), row);
  return row;
}

/** Replace an item's recipe lines: p = {item_id, lines:[{ingredient_id, qty}]} */
function saveRecipe(user, p) {
  const itemId = str_(p.item_id, 'Item', true);
  if (!readAll_('MENU_ITEMS').some((m) => m.item_id === itemId)) throw new Error('Unknown menu item.');
  const ingIds = {};
  readAll_('INGREDIENTS').forEach((i) => { ingIds[i.ingredient_id] = true; });
  if (!Array.isArray(p.lines) || p.lines.length > 30) throw new Error('A recipe can have up to 30 ingredients.');
  const lines = p.lines.map((l) => {
    if (!ingIds[l.ingredient_id]) throw new Error('Unknown ingredient in recipe.');
    return { recipe_id: newId_('RCP'), item_id: itemId, ingredient_id: l.ingredient_id, qty: num_(l.qty, 'Recipe qty', { positive: true }) };
  });
  const old = readAll_('RECIPES').filter((r) => r.item_id === itemId);
  const sh = sheet_('RECIPES');
  old.map((r) => r._row).sort((a, b) => b - a).forEach((row) => sh.deleteRow(row));
  appendMany_('RECIPES', lines);
  audit_(user, 'SAVE_RECIPE', 'RECIPES', itemId, old.map(strip_), lines);
  return { item_id: itemId, lines: lines };
}

// ---------- quick sale ----------
function openSession_() {
  return readAll_('STALL_SESSIONS').find((s) => !s.closed_at) || null;
}

/** p = {lines:[{item_id, qty}], payment_mode} — one SALES row per line, sharing an order_id. */
function recordSale(user, p) {
  const lines = Array.isArray(p.lines) ? p.lines : [];
  if (!lines.length) throw new Error('Add at least one item.');
  if (lines.length > 50) throw new Error('Too many lines in one order.');
  const items = {};
  readAll_('MENU_ITEMS').forEach((m) => { items[m.item_id] = m; });
  const cogs = unitCogsMap_();
  const session = openSession_();
  const orderId = newId_('ORD');
  const date = today_(), time = timeNow_(), now = nowIso_();
  const rows = lines.map((l) => {
    const m = items[l.item_id];
    if (!m || m.status !== 'ACTIVE') throw new Error('Item not available.');
    const qty = num_(l.qty, 'Quantity', { positive: true });
    if (qty !== Math.floor(qty) || qty > 500) throw new Error('Quantity must be a whole number up to 500.');
    const unitPrice = Number(m.price), unitCogs = round2_(cogs[m.item_id] || 0);
    return {
      sale_id: newId_('SAL'), order_id: orderId, date: date, time: time, item_id: m.item_id, item_name: m.name,
      qty: qty, unit_price: unitPrice, unit_cogs: unitCogs, // cost snapshot at time of sale
      total: round2_(qty * unitPrice), total_cogs: round2_(qty * unitCogs),
      payment_mode: ['CASH', 'UPI', 'CARD'].indexOf(p.payment_mode) >= 0 ? p.payment_mode : 'CASH',
      stall_session_id: session ? session.session_id : '', status: 'ACTIVE', entered_by: user.email, created_at: now,
    };
  });
  appendMany_('SALES', rows);
  audit_(user, 'RECORD_SALE', 'SALES', orderId, null, { lines: rows.length, total: rows.reduce((s, r) => s + r.total, 0) });
  return { order_id: orderId, total: round2_(rows.reduce((s, r) => s + r.total, 0)), cups: rows.reduce((s, r) => s + r.qty, 0) };
}

function voidSale(user, p) {
  const orderId = str_(p.order_id, 'Order', true);
  const reason = str_(p.reason, 'Reason', true);
  const rows = readAll_('SALES').filter((s) => s.order_id === orderId && s.status !== 'VOID');
  if (!rows.length) throw new Error('Order not found or already void.');
  const closedEnd = lastClosedEnd_();
  if (closedEnd && rows[0].date <= closedEnd) throw new Error('This sale is in a closed period and cannot be voided.');
  rows.forEach((r) => update_('SALES', r._row, { status: 'VOID' }));
  audit_(user, 'VOID_SALE', 'SALES', orderId, rows.map(strip_), { status: 'VOID', reason: reason });
  return { order_id: orderId, voided: rows.length };
}

function listSales(user, p) {
  const sales = readAll_('SALES');
  const hideCost = user.role === ROLES.STAFF;
  // Staff see only today's sales and no revenue totals (financial data is ADMIN/PARTNER only, §81).
  const range = hideCost ? FinanceCore.periodRange('TODAY', today_()) : resolveRange_(p, sales.length ? sales[0].date : today_());
  const rows = sales.filter((s) => s.date >= range.from && s.date <= range.to).map((s) => {
    const o = strip_(s);
    if (hideCost) { delete o.unit_cogs; delete o.total_cogs; }
    return o;
  }).reverse();
  const active = rows.filter((r) => r.status !== 'VOID');
  const totals = {
    orders: new Set(active.map((r) => r.order_id)).size,
    cups: active.reduce((s, r) => s + Number(r.qty), 0),
  };
  if (!hideCost) totals.revenue = round2_(active.reduce((s, r) => s + Number(r.total), 0));
  return { range: range, rows: rows, totals: totals, staff_view: hideCost };
}

// ---------- stall sessions ----------
function getStallStatus() {
  const s = openSession_();
  return { open: !!s, session: s ? strip_(s) : null };
}

function openStall(user, p) {
  if (openSession_()) throw new Error('Stall is already open.');
  const row = {
    session_id: newId_('STL'), date: today_(), opened_at: nowIso_(), opened_by: user.email,
    opening_cash: num_(p.opening_cash || 0, 'Opening cash'), notes: str_(p.notes, 'Notes'),
  };
  append_('STALL_SESSIONS', row);
  audit_(user, 'OPEN_STALL', 'STALL_SESSIONS', row.session_id, null, row);
  return row;
}

function closeStall(user, p) {
  const s = openSession_();
  if (!s) throw new Error('Stall is not open.');
  const patch = {
    closed_at: nowIso_(), closed_by: user.email, closing_cash: num_(p.closing_cash || 0, 'Closing cash'),
    notes: [s.notes, str_(p.notes, 'Notes')].filter(Boolean).join(' | '),
  };
  update_('STALL_SESSIONS', s._row, patch);
  const sales = readAll_('SALES').filter((x) => x.stall_session_id === s.session_id && x.status !== 'VOID');
  const summary = {
    cups: sales.reduce((a, x) => a + Number(x.qty), 0),
    revenue: round2_(sales.reduce((a, x) => a + Number(x.total), 0)),
  };
  audit_(user, 'CLOSE_STALL', 'STALL_SESSIONS', s.session_id, strip_(s), Object.assign({}, patch, summary));
  if (user.role === ROLES.STAFF) delete summary.revenue;
  return Object.assign({ session_id: s.session_id }, patch, summary);
}

// ---------- purchases ----------
function addPurchase(user, p) {
  const ing = readAll_('INGREDIENTS').find((i) => i.ingredient_id === p.ingredient_id);
  if (!ing) throw new Error('Choose an ingredient.');
  const qty = num_(p.qty, 'Quantity', { positive: true, max: 1000000 });
  const total = num_(p.total_cost, 'Total cost', { positive: true, max: 1000000 });
  const unitCost = Math.round((total / qty) * 10000) / 10000;
  if (unitCost <= 0) throw new Error('Unit cost works out to ₹0. Check the quantity and total cost.');
  const date = openDate_(p.date);

  // The latest purchase price becomes the cost used for future sales' COGS. A partner entering a fake
  // price could inflate profit (and their withdrawable share), so big price swings need an admin.
  const old = Number(ing.cost_per_unit) || 0;
  const change = old > 0 ? Math.abs(unitCost - old) / old : 0;
  if (change > 0.5 && user.role !== ROLES.ADMIN) {
    throw new Error('Unit cost ₹' + unitCost + ' differs from the current ₹' + old + ' by more than 50%. ' +
      'Check the quantity/total, or ask the admin to record this purchase.');
  }
  const newest = !readAll_('PURCHASES').some((x) => x.ingredient_id === ing.ingredient_id && x.status !== 'VOID' && x.date > date);

  const row = {
    purchase_id: newId_('PUR'), date: date, ingredient_id: ing.ingredient_id, ingredient_name: ing.name,
    qty: qty, unit: ing.unit, total_cost: total, unit_cost: unitCost, supplier: str_(p.supplier, 'Supplier'),
    entered_by: user.email, created_at: nowIso_(), status: 'ACTIVE',
  };
  append_('PURCHASES', row);
  if (newest) update_('INGREDIENTS', ing._row, { cost_per_unit: unitCost }); // back-dated purchases don't override newer prices
  audit_(user, 'ADD_PURCHASE', 'PURCHASES', row.purchase_id, { cost_per_unit: old }, Object.assign({ cost_updated: newest }, row));
  return row;
}

/** Admin correction. Does not change ingredient cost; fix that in Settings → Ingredients if needed. */
function voidPurchase(user, p) {
  const row = readAll_('PURCHASES').find((x) => x.purchase_id === p.purchase_id && x.status !== 'VOID');
  if (!row) throw new Error('Purchase not found.');
  update_('PURCHASES', row._row, { status: 'VOID' });
  audit_(user, 'VOID_PURCHASE', 'PURCHASES', row.purchase_id, strip_(row), { status: 'VOID', reason: str_(p.reason, 'Reason', true) });
  return { purchase_id: row.purchase_id };
}

function listPurchases(user, p) {
  const all = readAll_('PURCHASES');
  const range = resolveRange_(p, all.length ? all[0].date : today_());
  const rows = all.filter((r) => r.date >= range.from && r.date <= range.to).map(strip_).reverse();
  return { range: range, rows: rows, total: round2_(rows.filter((r) => r.status !== 'VOID').reduce((s, r) => s + Number(r.total_cost), 0)) };
}

// ---------- expenses ----------
function expenseCategories_() {
  return String(getSetting_('expense_categories', DEFAULT_EXPENSE_CATEGORIES.join(','))).split(',').map((s) => s.trim()).filter(Boolean);
}
function distributableCategories_() {
  return String(getSetting_('distributable_expense_categories', '')).split(',').map((s) => s.trim()).filter(Boolean);
}

function addExpense(user, p) {
  const category = str_(p.category, 'Category', true);
  if (expenseCategories_().indexOf(category) < 0) throw new Error('Unknown expense category.');
  const row = {
    expense_id: newId_('EXP'), date: openDate_(p.date), category: category, description: str_(p.description, 'Description'),
    amount: num_(p.amount, 'Amount', { positive: true, max: 1000000 }), status: 'ACTIVE', entered_by: user.email, created_at: nowIso_(),
  };
  append_('EXPENSES', row);
  audit_(user, 'ADD_EXPENSE', 'EXPENSES', row.expense_id, null, row);
  return row;
}

function voidExpense(user, p) {
  const row = readAll_('EXPENSES').find((e) => e.expense_id === p.expense_id && e.status !== 'VOID');
  if (!row) throw new Error('Expense not found.');
  const closed = lastClosedEnd_();
  if (closed && row.date <= closed) throw new Error('This expense is in a closed period and cannot be voided.');
  update_('EXPENSES', row._row, { status: 'VOID' });
  audit_(user, 'VOID_EXPENSE', 'EXPENSES', row.expense_id, strip_(row), { status: 'VOID', reason: str_(p.reason, 'Reason', true) });
  return { expense_id: row.expense_id };
}

function listExpenses(user, p) {
  const all = readAll_('EXPENSES');
  const range = resolveRange_(p, all.length ? all[0].date : today_());
  const dist = distributableCategories_();
  const rows = all.filter((r) => r.date >= range.from && r.date <= range.to).map((r) => {
    const o = strip_(r);
    o.distributable = dist.indexOf(r.category) >= 0;
    return o;
  }).reverse();
  return { range: range, rows: rows, categories: expenseCategories_(), distributable: dist };
}

/** §86 — partners define what counts as a distributable business expense. Sensitive: audited. */
function setExpenseRules(user, p) {
  if (!Array.isArray(p.categories) || p.categories.length > 50) throw new Error('Up to 50 expense categories allowed.');
  const cats = p.categories.map((c) => str_(c, 'Category').slice(0, 40)).filter(Boolean);
  if (!cats.length) throw new Error('At least one expense category is required.');
  if (cats.some((c) => c.indexOf(',') >= 0)) throw new Error('Category names cannot contain commas.');
  const dist = (Array.isArray(p.distributable) ? p.distributable : []).filter((c) => cats.indexOf(c) >= 0);
  const before = { categories: expenseCategories_(), distributable: distributableCategories_() };
  setSetting_('expense_categories', cats.join(','), user);
  setSetting_('distributable_expense_categories', dist.join(','), user);
  audit_(user, 'SET_EXPENSE_RULES', 'SETTINGS', 'distributable_expense_categories', before, { categories: cats, distributable: dist });
  return { categories: cats, distributable: dist };
}

// ---------- inventory ----------
/** Stock = Σ purchased − Σ consumed by active sales (qty × current recipe). */
function getInventory() {
  const ings = readAll_('INGREDIENTS');
  const stock = {};
  ings.forEach((i) => { stock[i.ingredient_id] = { purchased: 0, used: 0, purchaseValue: 0 }; });
  readAll_('PURCHASES').forEach((p) => {
    if (p.status !== 'VOID' && stock[p.ingredient_id]) { stock[p.ingredient_id].purchased += Number(p.qty); stock[p.ingredient_id].purchaseValue += Number(p.total_cost); }
  });
  const recipe = {};
  readAll_('RECIPES').forEach((r) => { (recipe[r.item_id] = recipe[r.item_id] || []).push(r); });
  readAll_('SALES').forEach((s) => {
    if (s.status === 'VOID') return;
    (recipe[s.item_id] || []).forEach((r) => { if (stock[r.ingredient_id]) stock[r.ingredient_id].used += Number(r.qty) * Number(s.qty); });
  });
  return ings.map((i) => {
    const st = stock[i.ingredient_id];
    const onHand = round2_(st.purchased - st.used);
    return {
      ingredient_id: i.ingredient_id, name: i.name, unit: i.unit, purchased: round2_(st.purchased), used: round2_(st.used),
      on_hand: onHand, cost_per_unit: Number(i.cost_per_unit), stock_value: round2_(Math.max(onHand, 0) * Number(i.cost_per_unit)),
      low: Number(i.reorder_level) > 0 && onHand <= Number(i.reorder_level),
    };
  });
}

// ---------- users (admin) ----------
function listUsers() { return readAll_('USERS').map(strip_); }

function saveUser(user, p) {
  const email = str_(p.email, 'Email', true).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email.');
  const role = String(p.role);
  if (!ROLES[role]) throw new Error('Unknown role.');
  if (p.partner_id && !readAll_('PARTNERS').some((x) => x.partner_id === p.partner_id)) throw new Error('Unknown partner.');
  const all = readAll_('USERS');
  const existing = all.find((u) => String(u.email).toLowerCase() === email);
  const row = {
    email: email, name: str_(p.name, 'Name', true), role: role, partner_id: p.partner_id || '',
    status: p.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE', created_at: existing ? existing.created_at : nowIso_(),
  };
  const activeAdmins = all.filter((u) => u.role === ROLES.ADMIN && u.status !== 'INACTIVE' && String(u.email).toLowerCase() !== email);
  if (!activeAdmins.length && (row.role !== ROLES.ADMIN || row.status === 'INACTIVE')) throw new Error('At least one active admin is required.');
  if (existing) update_('USERS', existing._row, row); else append_('USERS', row);
  audit_(user, existing ? 'UPDATE_USER' : 'CREATE_USER', 'USERS', email, existing && strip_(existing), row);
  return row;
}

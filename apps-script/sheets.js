/**
 * Google Sheets data layer. Every sheet's first row is its header; rows are read as objects.
 * Dates are stored as plain text 'YYYY-MM-DD' (column format '@') so Sheets never reinterprets them.
 */
const TZ = 'Asia/Kolkata';

const SCHEMA = {
  USERS: ['email', 'name', 'role', 'partner_id', 'status', 'created_at'],
  MENU_ITEMS: ['item_id', 'name', 'category', 'price', 'description', 'status', 'sort', 'created_at'],
  INGREDIENTS: ['ingredient_id', 'name', 'unit', 'cost_per_unit', 'reorder_level', 'status', 'created_at'],
  RECIPES: ['recipe_id', 'item_id', 'ingredient_id', 'qty'],
  SALES: ['sale_id', 'order_id', 'date', 'time', 'item_id', 'item_name', 'qty', 'unit_price', 'unit_cogs', 'total',
    'total_cogs', 'payment_mode', 'stall_session_id', 'status', 'entered_by', 'created_at'],
  PURCHASES: ['purchase_id', 'date', 'ingredient_id', 'ingredient_name', 'qty', 'unit', 'total_cost', 'unit_cost',
    'supplier', 'entered_by', 'created_at', 'status'],
  EXPENSES: ['expense_id', 'date', 'category', 'description', 'amount', 'status', 'entered_by', 'created_at'],
  STALL_SESSIONS: ['session_id', 'date', 'opened_at', 'opened_by', 'opening_cash', 'closed_at', 'closed_by',
    'closing_cash', 'notes'],
  SETTINGS: ['key', 'value', 'updated_by', 'updated_at'],
  AUDIT_LOG: ['log_id', 'timestamp', 'user_email', 'action', 'entity', 'entity_id', 'before_json', 'after_json'],
  // Spec §89
  PARTNERS: ['partner_id', 'name', 'gmail', 'role', 'ownership_percentage', 'status', 'created_at'],
  PARTNER_OWNERSHIP_HISTORY: ['ownership_id', 'partner_id', 'percentage', 'effective_from', 'effective_to',
    'created_by', 'created_at'],
  PARTNER_DISTRIBUTIONS: ['distribution_id', 'period_start', 'period_end', 'partner_id', 'ownership_percentage',
    'distributable_profit', 'calculated_share', 'paid_amount', 'remaining_amount', 'status', 'created_at', 'created_by'],
  PARTNER_WITHDRAWALS: ['withdrawal_id', 'partner_id', 'amount', 'date', 'reason', 'entered_by', 'created_at', 'status'],
};

const DATE_COLS = { date: 1, effective_from: 1, effective_to: 1, period_start: 1, period_end: 1 };

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet "' + name + '". Run setupSheets() once.');
  return sh;
}

function normalize_(header, value) {
  if (value instanceof Date) {
    return DATE_COLS[header] ? Utilities.formatDate(value, TZ, 'yyyy-MM-dd') : value.toISOString();
  }
  return value;
}

/** All rows as objects; `_row` is the 1-based sheet row for updates. */
function readAll_(name) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getValues();
  const header = values.shift() || [];
  return values
    .map((r, i) => {
      const o = { _row: i + 2 };
      header.forEach((h, j) => { o[h] = normalize_(h, r[j]); });
      return o;
    })
    .filter((o) => header.some((h) => o[h] !== '' && o[h] !== null));
}

/**
 * Neutralise spreadsheet formula injection: a user string like "=IMPORTXML(...)" or "+HYPERLINK(...)"
 * would otherwise be executed by Sheets. A leading apostrophe stores it as plain text (and is not
 * returned by getValues). Numbers and dates pass through unchanged.
 */
function safeCell_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) return "'" + v;
  return v;
}

function append_(name, obj) {
  const cols = SCHEMA[name];
  sheet_(name).appendRow(cols.map((c) => safeCell_(obj[c])));
  return obj;
}

function appendMany_(name, objs) {
  if (!objs.length) return;
  const cols = SCHEMA[name];
  const sh = sheet_(name);
  sh.getRange(sh.getLastRow() + 1, 1, objs.length, cols.length)
    .setValues(objs.map((o) => cols.map((c) => safeCell_(o[c]))));
}

function update_(name, rowIndex, patch) {
  const cols = SCHEMA[name];
  const sh = sheet_(name);
  Object.keys(patch).forEach((k) => {
    const j = cols.indexOf(k);
    if (j >= 0) sh.getRange(rowIndex, j + 1).setValue(safeCell_(patch[k]));
  });
}

function strip_(o) {
  const c = Object.assign({}, o);
  delete c._row;
  return c;
}

function newId_(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function nowIso_() { return new Date().toISOString(); }
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function timeNow_() { return Utilities.formatDate(new Date(), TZ, 'HH:mm:ss'); }

function getSetting_(key, fallback) {
  const row = readAll_('SETTINGS').find((r) => r.key === key);
  return row ? row.value : fallback;
}

function setSetting_(key, value, user) {
  const row = readAll_('SETTINGS').find((r) => r.key === key);
  const patch = { key: key, value: value, updated_by: user.email, updated_at: nowIso_() };
  if (row) update_('SETTINGS', row._row, patch);
  else append_('SETTINGS', patch);
}

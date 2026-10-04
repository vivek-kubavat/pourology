/**
 * One-time setup. In the Apps Script editor (NOT in the public GitHub repo): replace the CHANGE_ME
 * emails below with each partner's real Gmail, then run setupSheets().
 * Safe to re-run: it only creates missing sheets and seeds sheets that are still empty.
 */
const SEED_PARTNERS = [
  { partner_id: 'vivek', name: 'Vivek', gmail: 'CHANGE_ME_vivek@example.com', role: 'ADMIN', percentage: 20 },
  { partner_id: 'akash', name: 'Akash', gmail: 'CHANGE_ME_akash@example.com', role: 'PARTNER', percentage: 20 },
  { partner_id: 'ishan', name: 'Ishan', gmail: 'CHANGE_ME_ishan@example.com', role: 'PARTNER', percentage: 60 },
];
const SEED_OWNERSHIP_START = '2026-10-01';

const DEFAULT_EXPENSE_CATEGORIES = ['Electricity', 'Transport', 'Stall rent', 'Equipment', 'Maintenance', 'Marketing', 'Other'];

function setupSheets() {
  if (SEED_PARTNERS.some((p) => /CHANGE_ME|example\.com/i.test(p.gmail))) {
    throw new Error('Edit SEED_PARTNERS in setup.gs first: replace every CHANGE_ME email with the partner\'s real Gmail.');
  }
  setupSheetsUnchecked_();
}

/** Used by setupSheets() and by the local test harness (which keeps placeholder emails). */
function setupSheetsUnchecked_() {
  const ss = ss_();
  Object.keys(SCHEMA).forEach((name) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const cols = SCHEMA[name];
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    // Keep ids and dates as plain text so Sheets never auto-converts them.
    cols.forEach((c, j) => {
      if (DATE_COLS[c] || /_id$/.test(c) || c === 'time') sh.getRange(2, j + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  });
  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  seed_();
  Logger.log('Setup complete. Remember to set GOOGLE_CLIENT_ID in Project Settings → Script properties.');
}

function seed_() {
  const now = nowIso_();
  const sys = { email: 'setup' };

  if (!readAll_('PARTNERS').length) {
    appendMany_('PARTNERS', SEED_PARTNERS.map((p) => ({
      partner_id: p.partner_id, name: p.name, gmail: p.gmail.toLowerCase(), role: p.role,
      ownership_percentage: p.percentage, status: 'ACTIVE', created_at: now,
    })));
    appendMany_('PARTNER_OWNERSHIP_HISTORY', SEED_PARTNERS.map((p) => ({
      ownership_id: newId_('OWN'), partner_id: p.partner_id, percentage: p.percentage,
      effective_from: SEED_OWNERSHIP_START, effective_to: '', created_by: 'setup', created_at: now,
    })));
    audit_(sys, 'SEED_OWNERSHIP', 'PARTNER_OWNERSHIP_HISTORY', '', null, SEED_PARTNERS);
  }

  if (!readAll_('USERS').length) {
    appendMany_('USERS', SEED_PARTNERS.map((p) => ({
      email: p.gmail.toLowerCase(), name: p.name, role: p.role, partner_id: p.partner_id, status: 'ACTIVE', created_at: now,
    })));
  }

  if (!readAll_('SETTINGS').length) {
    appendMany_('SETTINGS', [
      { key: 'expense_categories', value: DEFAULT_EXPENSE_CATEGORIES.join(','), updated_by: 'setup', updated_at: now },
      // Partners decide what counts as a distributable expense (§86). Default: all business expense categories.
      { key: 'distributable_expense_categories', value: DEFAULT_EXPENSE_CATEGORIES.join(','), updated_by: 'setup', updated_at: now },
      { key: 'business_name', value: 'Pourology', updated_by: 'setup', updated_at: now },
    ]);
  }

  if (!readAll_('INGREDIENTS').length) {
    // Recipe quantities and costs are STARTING ESTIMATES — update real grams/ml and prices in
    // Settings → Menu & recipes (or record purchases, which update cost per unit automatically).
    const ing = [
      ['ING_beans', 'Coffee beans', 'g', 1.6], ['ING_milk', 'Milk', 'ml', 0.07], ['ING_condensed', 'Condensed milk', 'g', 0.3],
      ['ING_ice', 'Ice', 'g', 0.01], ['ING_filter', 'V60 filter paper', 'pc', 2.5], ['ING_cup_hot', 'Hot cup', 'pc', 4],
      ['ING_cup_cold', 'Cold cup', 'pc', 6], ['ING_cup_shot', 'Shot cup', 'pc', 2], ['ING_lid', 'Lid', 'pc', 1.5],
      ['ING_dark_choc', 'Dark chocolate sauce', 'ml', 1], ['ING_white_choc', 'White chocolate sauce', 'ml', 1.2],
      ['ING_honey', 'Honey', 'ml', 0.8], ['ING_vanilla', 'Vanilla syrup', 'ml', 0.9],
    ];
    appendMany_('INGREDIENTS', ing.map((r) => ({
      ingredient_id: r[0], name: r[1], unit: r[2], cost_per_unit: r[3], reorder_level: 0, status: 'ACTIVE', created_at: now,
    })));
    // Pourology menu ("Worth the wait.")
    const menu = [
      ['ITM_clear_solution', 'Clear Solution', 'Pour-over', 120, 'Hot V60 pour-over, served black. Clean and clear, nothing hidden.'],
      ['ITM_cryo_pour', 'Cryo Pour', 'Pour-over', 140, 'Iced pour-over. Hot coffee brewed straight over ice, so it chills instantly and keeps its aroma. No milk.'],
      ['ITM_cold_fusion', 'Cold Fusion', 'Pour-over', 140, 'Cold brew. Coffee steeped in cold water overnight. Smooth and mellow, served over ice.'],
      ['ITM_covalent_bond', 'Covalent Bond', 'Moka', 150, 'Moka latte. Strong moka coffee with hot milk, bonded into one bold, creamy cup.'],
      ['ITM_dark_matter', 'Dark Matter', 'Moka', 80, 'Moka shot. A small, dark, strong coffee brewed on the stove. Drink it straight, no milk.'],
      ['ITM_saturated_solution', 'Saturated Solution', 'Moka', 170, 'Spanish moka. Moka coffee with milk and sweet condensed milk. Rich, creamy and sweet.'],
      ['ITM_add_dark_choc', 'Dark chocolate', 'Additives', 30, ''],
      ['ITM_add_white_choc', 'White chocolate', 'Additives', 30, ''],
      ['ITM_add_honey', 'Honey', 'Additives', 30, ''],
      ['ITM_add_vanilla', 'Vanilla syrup', 'Additives', 30, ''],
    ];
    appendMany_('MENU_ITEMS', menu.map((m, i) => ({
      item_id: m[0], name: m[1], category: m[2], price: m[3], description: m[4], status: 'ACTIVE', sort: i + 1, created_at: now,
    })));
    const recipe = [
      ['ITM_clear_solution', 'ING_beans', 15], ['ITM_clear_solution', 'ING_filter', 1], ['ITM_clear_solution', 'ING_cup_hot', 1], ['ITM_clear_solution', 'ING_lid', 1],
      ['ITM_cryo_pour', 'ING_beans', 18], ['ITM_cryo_pour', 'ING_filter', 1], ['ITM_cryo_pour', 'ING_ice', 120], ['ITM_cryo_pour', 'ING_cup_cold', 1], ['ITM_cryo_pour', 'ING_lid', 1],
      ['ITM_cold_fusion', 'ING_beans', 20], ['ITM_cold_fusion', 'ING_ice', 120], ['ITM_cold_fusion', 'ING_cup_cold', 1], ['ITM_cold_fusion', 'ING_lid', 1],
      ['ITM_covalent_bond', 'ING_beans', 18], ['ITM_covalent_bond', 'ING_milk', 150], ['ITM_covalent_bond', 'ING_cup_hot', 1], ['ITM_covalent_bond', 'ING_lid', 1],
      ['ITM_dark_matter', 'ING_beans', 18], ['ITM_dark_matter', 'ING_cup_shot', 1],
      ['ITM_saturated_solution', 'ING_beans', 18], ['ITM_saturated_solution', 'ING_milk', 120], ['ITM_saturated_solution', 'ING_condensed', 30],
      ['ITM_saturated_solution', 'ING_cup_hot', 1], ['ITM_saturated_solution', 'ING_lid', 1],
      ['ITM_add_dark_choc', 'ING_dark_choc', 20], ['ITM_add_white_choc', 'ING_white_choc', 20],
      ['ITM_add_honey', 'ING_honey', 15], ['ITM_add_vanilla', 'ING_vanilla', 15],
    ];
    appendMany_('RECIPES', recipe.map((r) => ({ recipe_id: newId_('RCP'), item_id: r[0], ingredient_id: r[1], qty: r[2] })));
  }
}

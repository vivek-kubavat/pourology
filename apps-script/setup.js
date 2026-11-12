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

// Recipe quantities and costs are STARTING ESTIMATES — update real grams/ml and prices in
// Settings → Menu & recipes (or record purchases, which update cost per unit automatically).
const SEED_INGREDIENTS = [
  ['ING_beans', 'Coffee beans', 'g', 1.6], ['ING_beans_aa', 'AA coffee beans', 'g', 3], ['ING_milk', 'Milk', 'ml', 0.07],
  ['ING_condensed', 'Condensed milk', 'g', 0.3], ['ING_ice', 'Ice', 'g', 0.01], ['ING_filter', 'V60 filter paper', 'pc', 2.5],
  ['ING_cup_hot', 'Hot cup', 'pc', 4], ['ING_cup_cold', 'Cold cup', 'pc', 6], ['ING_cup_shot', 'Shot cup', 'pc', 2], ['ING_lid', 'Lid', 'pc', 1.5],
  ['ING_dark_choc', 'Dark chocolate sauce', 'ml', 1], ['ING_white_choc', 'White chocolate sauce', 'ml', 1.2],
  ['ING_honey', 'Honey', 'ml', 0.8], ['ING_vanilla', 'Vanilla syrup', 'ml', 0.9],
];
// The printed menu (brand/pourology-menu-2026.jpg), in menu order: [item_id, name, category, price, description].
// The customer menu draws one card per category; a size in brackets after the name is shown as the size.
const SEED_MENU = [
  ['ITM_filter_coffee', 'South Indian Filter Coffee', 'Brewed Coffee', 60, 'A classic decoction, bold and comforting.'],
  ['ITM_dark_matter', 'Dark Matter', 'Brewed Coffee', 90, 'A rich, intense black coffee with deep character.'],
  ['ITM_clear_solution', 'Clear Solution (V60 – Hot)', 'Brewed Coffee', 140, 'A clean, aromatic pour-over with layered notes.'],
  ['ITM_cryo_pour', 'Cryo Pour (V60 – Iced)', 'Brewed Coffee', 150, 'A chilled, crystal-clear brew with a bright finish.'],
  ['ITM_aa_v60_hot', 'AA Beans V60 – Hot', 'Brewed Coffee', 180, 'A specialty single-origin brew with refined complexity.'],
  ['ITM_aa_v60_iced', 'AA Beans V60 – Iced', 'Brewed Coffee', 190, 'The same specialty brew, served chilled and vibrant.'],
  ['ITM_hot_latte', 'Hot Latte (250 ml)', 'Lattes', 90, 'A creamy espresso classic.'],
  ['ITM_iced_latte', 'Iced Latte (250 ml)', 'Lattes', 100, 'A chilled and refreshing classic.'],
  ['ITM_vanilla_equation', 'Vanilla Equation (250 ml)', 'Lattes', 140, 'A smooth latte with a hint of vanilla.'],
  ['ITM_mocha_molecule', 'Mocha Molecule', 'Mocha Molecule', 150, 'A decadent blend of espresso, chocolate and steamed milk.'],
  ['ITM_cold_coffee_small', 'Cold Coffee (Small, 250 ml)', 'Cold Coffee', 120, 'A classic, frothy café favourite.'],
  ['ITM_cold_coffee_large', 'Cold Coffee (Large, 350 ml)', 'Cold Coffee', 160, 'A classic, frothy café favourite.'],
  ['ITM_hot_chocolate', 'Hot Chocolate', 'Hot Chocolate', 200, 'Rich, creamy and comforting.'],
  ['ITM_custom_coffee', 'Custom Coffee', 'Custom Coffee', 200, 'Design your own brew. Choose your beans, method and flavour.'],
];
const SEED_RECIPES = [
  ['ITM_filter_coffee', 'ING_beans', 10], ['ITM_filter_coffee', 'ING_milk', 100], ['ITM_filter_coffee', 'ING_cup_hot', 1],
  ['ITM_dark_matter', 'ING_beans', 18], ['ITM_dark_matter', 'ING_cup_shot', 1],
  ['ITM_clear_solution', 'ING_beans', 15], ['ITM_clear_solution', 'ING_filter', 1], ['ITM_clear_solution', 'ING_cup_hot', 1], ['ITM_clear_solution', 'ING_lid', 1],
  ['ITM_cryo_pour', 'ING_beans', 18], ['ITM_cryo_pour', 'ING_filter', 1], ['ITM_cryo_pour', 'ING_ice', 120], ['ITM_cryo_pour', 'ING_cup_cold', 1], ['ITM_cryo_pour', 'ING_lid', 1],
  ['ITM_aa_v60_hot', 'ING_beans_aa', 15], ['ITM_aa_v60_hot', 'ING_filter', 1], ['ITM_aa_v60_hot', 'ING_cup_hot', 1], ['ITM_aa_v60_hot', 'ING_lid', 1],
  ['ITM_aa_v60_iced', 'ING_beans_aa', 18], ['ITM_aa_v60_iced', 'ING_filter', 1], ['ITM_aa_v60_iced', 'ING_ice', 120], ['ITM_aa_v60_iced', 'ING_cup_cold', 1], ['ITM_aa_v60_iced', 'ING_lid', 1],
  ['ITM_hot_latte', 'ING_beans', 18], ['ITM_hot_latte', 'ING_milk', 180], ['ITM_hot_latte', 'ING_cup_hot', 1], ['ITM_hot_latte', 'ING_lid', 1],
  ['ITM_iced_latte', 'ING_beans', 18], ['ITM_iced_latte', 'ING_milk', 150], ['ITM_iced_latte', 'ING_ice', 100], ['ITM_iced_latte', 'ING_cup_cold', 1], ['ITM_iced_latte', 'ING_lid', 1],
  ['ITM_vanilla_equation', 'ING_beans', 18], ['ITM_vanilla_equation', 'ING_milk', 180], ['ITM_vanilla_equation', 'ING_vanilla', 15], ['ITM_vanilla_equation', 'ING_cup_hot', 1], ['ITM_vanilla_equation', 'ING_lid', 1],
  ['ITM_mocha_molecule', 'ING_beans', 18], ['ITM_mocha_molecule', 'ING_milk', 160], ['ITM_mocha_molecule', 'ING_dark_choc', 25], ['ITM_mocha_molecule', 'ING_cup_hot', 1], ['ITM_mocha_molecule', 'ING_lid', 1],
  ['ITM_cold_coffee_small', 'ING_beans', 18], ['ITM_cold_coffee_small', 'ING_milk', 150], ['ITM_cold_coffee_small', 'ING_ice', 80], ['ITM_cold_coffee_small', 'ING_cup_cold', 1], ['ITM_cold_coffee_small', 'ING_lid', 1],
  ['ITM_cold_coffee_large', 'ING_beans', 24], ['ITM_cold_coffee_large', 'ING_milk', 220], ['ITM_cold_coffee_large', 'ING_ice', 100], ['ITM_cold_coffee_large', 'ING_cup_cold', 1], ['ITM_cold_coffee_large', 'ING_lid', 1],
  ['ITM_hot_chocolate', 'ING_milk', 220], ['ITM_hot_chocolate', 'ING_dark_choc', 40], ['ITM_hot_chocolate', 'ING_cup_hot', 1], ['ITM_hot_chocolate', 'ING_lid', 1],
  ['ITM_custom_coffee', 'ING_beans', 18], ['ITM_custom_coffee', 'ING_cup_hot', 1], ['ITM_custom_coffee', 'ING_lid', 1],
];

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
    appendMany_('INGREDIENTS', SEED_INGREDIENTS.map(ingredientRow_));
    appendMany_('MENU_ITEMS', SEED_MENU.map(menuRow_));
    appendMany_('RECIPES', SEED_RECIPES.map(recipeRow_));
  }
}

function ingredientRow_(r) {
  return { ingredient_id: r[0], name: r[1], unit: r[2], cost_per_unit: r[3], reorder_level: 0, status: 'ACTIVE', created_at: nowIso_() };
}
function menuRow_(m) {
  return { item_id: m[0], name: m[1], category: m[2], price: m[3], description: m[4], status: 'ACTIVE', sort: SEED_MENU.indexOf(m) + 1, created_at: nowIso_() };
}
function recipeRow_(r) { return { recipe_id: newId_('RCP'), item_id: r[0], ingredient_id: r[1], qty: r[2] }; }

/**
 * Brings a Sheet that already has a menu in line with SEED_MENU (the printed menu). Run it once from the
 * Apps Script editor after pushing this file. Safe to re-run.
 *  - items in SEED_MENU are added, or get the new name / category / price / description / order;
 *  - items no longer on the menu are switched to INACTIVE (their past sales stay untouched);
 *  - missing ingredients are added; a recipe is added only for items that have none (tuned recipes are kept).
 */
function updateMenu() {
  const sys = { email: 'setup' };
  const haveIng = {};
  readAll_('INGREDIENTS').forEach((i) => { haveIng[i.ingredient_id] = true; });
  appendMany_('INGREDIENTS', SEED_INGREDIENTS.filter((r) => !haveIng[r[0]]).map(ingredientRow_));

  const onMenu = {};
  SEED_MENU.forEach((m) => { onMenu[m[0]] = m; });
  const existing = {};
  readAll_('MENU_ITEMS').forEach((row) => {
    existing[row.item_id] = true;
    const m = onMenu[row.item_id];
    if (m) update_('MENU_ITEMS', row._row, { name: m[1], category: m[2], price: m[3], description: m[4], status: 'ACTIVE', sort: SEED_MENU.indexOf(m) + 1 });
    else if (row.status === 'ACTIVE') update_('MENU_ITEMS', row._row, { status: 'INACTIVE' });
  });
  appendMany_('MENU_ITEMS', SEED_MENU.filter((m) => !existing[m[0]]).map(menuRow_));

  const hasRecipe = {};
  readAll_('RECIPES').forEach((r) => { hasRecipe[r.item_id] = true; });
  appendMany_('RECIPES', SEED_RECIPES.filter((r) => !hasRecipe[r[0]]).map(recipeRow_));

  clearMenuCache_();
  audit_(sys, 'UPDATE_MENU', 'MENU_ITEMS', '', null, SEED_MENU.map((m) => m[1] + ' ' + m[3]));
  Logger.log('Menu updated: ' + SEED_MENU.length + ' items.');
}

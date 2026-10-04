/**
 * Web-app entry point. The PWA POSTs JSON as text/plain (avoids a CORS preflight):
 *   { action: 'getPartnerEarnings', idToken: '<google id token>', payload: {...} }
 * Response: { ok: true, data } | { ok: false, error, code }
 *
 * Every action declares the roles allowed to call it — enforced here, server-side (§81).
 */
// Built lazily: Apps Script evaluates files one by one, so functions from other files
// may not exist yet when this file's top level runs.
function actions_() {
  const PUBLIC = 'PUBLIC', A = 'ADMIN', P = 'PARTNER', S = 'STAFF';
  return {
    getMenu:            { roles: PUBLIC, fn: getMenuCached },
    getPublicInfo:      { roles: PUBLIC, fn: getPublicInfo },
    me:                 { roles: [A, P, S], fn: (u) => u },

    // operations
    getCatalog:         { roles: [A, P, S], fn: getCatalog },
    recordSale:         { roles: [A, P, S], fn: recordSale, write: true },
    voidSale:           { roles: [A], fn: voidSale, write: true },
    listSales:          { roles: [A, P, S], fn: listSales },
    getStallStatus:     { roles: [A, P, S], fn: getStallStatus },
    openStall:          { roles: [A, P, S], fn: openStall, write: true },
    closeStall:         { roles: [A, P, S], fn: closeStall, write: true },
    addPurchase:        { roles: [A, P], fn: addPurchase, write: true },
    listPurchases:      { roles: [A, P], fn: listPurchases },
    addExpense:         { roles: [A, P], fn: addExpense, write: true },
    voidExpense:        { roles: [A], fn: voidExpense, write: true },
    voidPurchase:       { roles: [A], fn: voidPurchase, write: true },
    listExpenses:       { roles: [A, P], fn: listExpenses },
    getInventory:       { roles: [A, P], fn: getInventory },
    listAudit:          { roles: [A, P], fn: listAudit },
    getStallInfo:       { roles: [A, P], fn: getStallInfo },
    setStallLocation:   { roles: [A, P], fn: setStallLocation, write: true },
    setContact:         { roles: [A, P], fn: setContact, write: true },

    // finance & partners
    getPL:              { roles: [A, P], fn: getPL },
    getPartnerEarnings: { roles: [A, P], fn: getPartnerEarnings },
    getMyShare:         { roles: [A, P], fn: getMyShare },
    getProfitReport:    { roles: [A, P], fn: getProfitReport },
    recordWithdrawal:   { roles: [A, P], fn: recordWithdrawal, write: true },
    voidWithdrawal:     { roles: [A], fn: voidWithdrawal, write: true },
    listWithdrawals:    { roles: [A, P], fn: listWithdrawals },
    getOwnership:       { roles: [A, P], fn: getOwnership },
    listDistributions:  { roles: [A, P], fn: listDistributions },

    // admin
    setOwnership:       { roles: [A], fn: setOwnership, write: true },
    setExpenseRules:    { roles: [A], fn: setExpenseRules, write: true },
    closePeriod:        { roles: [A], fn: closePeriod, write: true },
    saveMenuItem:       { roles: [A], fn: saveMenuItem, write: true },
    saveIngredient:     { roles: [A], fn: saveIngredient, write: true },
    saveRecipe:         { roles: [A], fn: saveRecipe, write: true },
    listUsers:          { roles: [A], fn: listUsers },
  saveUser:           { roles: [A], fn: saveUser, write: true },
  };
}

function doGet() {
  return json_({ ok: true, data: { service: 'pourology-api', time: nowIso_() } });
}

function doPost(e) {
  let lock = null;
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const map = actions_();
    const def = Object.prototype.hasOwnProperty.call(map, body.action) ? map[body.action] : null;
    if (!def) throw new Error('Unknown action.');
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};

    if (def.roles === 'PUBLIC') return json_({ ok: true, data: def.fn(payload) });

    const user = authenticate_(body.idToken);
    requireRole_(user, def.roles);
    if (def.write) {
      lock = LockService.getScriptLock();
      lock.waitLock(20000);
    }
    return json_({ ok: true, data: def.fn(user, payload) });
  } catch (err) {
    // Validation errors are shown to the user; programming/service errors (quota, sheet access…) are
    // logged but replaced with a generic message so internals never reach anonymous callers.
    const internal = !err.code && (err instanceof TypeError || err instanceof ReferenceError || err instanceof SyntaxError ||
      err instanceof RangeError || /^Exception|Service|quota|Spreadsheet|permission/i.test(String(err && err.message)));
    if (!err.code) console.error(err && err.stack);
    return json_({ ok: false, error: internal ? 'Something went wrong on the server. Please try again.' : String(err && err.message || err), code: err.code || (internal ? 'SERVER' : 'ERROR') });
  } finally {
    if (lock) lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

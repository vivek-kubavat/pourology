/**
 * Minimal in-memory Apps Script runtime: loads every apps-script/*.js file into one VM context
 * (same shared global scope as Apps Script) with fake SpreadsheetApp, Utilities, etc.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

class FakeSheet {
  constructor(name) { this.name = name; this.rows = []; }
  getLastRow() { return this.rows.length; }
  getMaxRows() { return 1000; }
  setFrozenRows() {}
  appendRow(r) { this.rows.push(r.slice()); }
  deleteRow(i) { this.rows.splice(i - 1, 1); }
  // Like Sheets: a leading apostrophe marks literal text and is not returned by getValues().
  getDataRange() { const rows = this.rows; return { getValues: () => rows.map((r) => r.map((v) => (typeof v === 'string' && v[0] === "'" ? v.slice(1) : v))) }; }
  getRange(r, c, nr = 1, nc = 1) {
    const sh = this;
    const ensure = (row) => { while (sh.rows.length < row) sh.rows.push([]); };
    return {
      setValues(vals) { vals.forEach((v, i) => { ensure(r + i); v.forEach((x, j) => { sh.rows[r + i - 1][c + j - 1] = x; }); }); return this; },
      setValue(v) { ensure(r); sh.rows[r - 1][c - 1] = v; return this; },
      setFontWeight() { return this; },
      setNumberFormat() { return this; },
    };
  }
}

class FakeSpreadsheet {
  constructor() { this.sheets = [new FakeSheet('Sheet1')]; }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
  insertSheet(n) { const s = new FakeSheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets; }
  deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
}

function istParts(d) {
  const t = new Date(d.getTime() + 330 * 60000);
  const p = (n) => String(n).padStart(2, '0');
  return { y: t.getUTCFullYear(), M: p(t.getUTCMonth() + 1), d: p(t.getUTCDate()), H: p(t.getUTCHours()), m: p(t.getUTCMinutes()), s: p(t.getUTCSeconds()) };
}

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function devToken(email, aud) {
  return `${b64url({ alg: 'none' })}.${b64url({ email, aud, exp: Math.floor(Date.now() / 1000) + 3600 })}.dev`;
}

function createRuntime({ clientId = 'test-client' } = {}) {
  const ss = new FakeSpreadsheet();
  const props = { GOOGLE_CLIENT_ID: clientId };
  const cache = new Map();
  const ctx = {
    console: Object.assign({}, console, { error() {} }),
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) || null, put: (k, v) => cache.set(k, v) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Logger: { log() {} },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s) => ({ setMimeType() { return this; }, text: s, getContent() { return s; } }),
    },
    Utilities: {
      formatDate(d, tz, fmt) {
        const p = istParts(d);
        return fmt.replace('yyyy', p.y).replace('MM', p.M).replace('dd', p.d).replace('HH', p.H).replace('mm', p.m).replace('ss', p.s);
      },
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, s) => [...crypto.createHash(alg).update(s).digest()],
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString('base64url'),
      base64Decode: (b64) => [...Buffer.from(b64, 'base64')],
      newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') }),
    },
    UrlFetchApp: {
      // Fake Google tokeninfo: accepts unsigned test JWTs "<b64 header>.<b64 {email,aud,exp}>.dev".
      // (Real Apps Script calls Google, which rejects these.)
      fetch(url) {
        const token = decodeURIComponent(url.split('id_token=')[1]);
        let email = null;
        if (token.endsWith('.dev')) {
          try { email = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).email; } catch { email = null; }
        }
        if (!email) return { getResponseCode: () => 400, getContentText: () => '{}' };
        const body = { aud: clientId, iss: 'https://accounts.google.com', email, email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 3600) };
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify(body) };
      },
    },
  };
  vm.createContext(ctx);
  const dir = path.join(__dirname, '..', 'apps-script');
  fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort().forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  });

  let today = null;
  vm.runInContext('var __origToday = today_;', ctx);
  ctx.setToday = (d) => { today = d; };
  vm.runInContext('today_ = function () { return __testToday() || __origToday(); };', Object.assign(ctx, { __testToday: () => today }));

  ctx.devToken = (email) => devToken(email, clientId);
  ctx.call = (action, payload, email) => {
    const out = ctx.doPost({ postData: { contents: JSON.stringify({ action, payload, idToken: email ? devToken(email, clientId) : undefined }) } });
    return JSON.parse(out.getContent());
  };
  // Seed with test emails (production setupSheets() refuses the CHANGE_ME placeholders).
  ctx.setupForTests = () => vm.runInContext(
    "SEED_PARTNERS.forEach(function (p) { p.gmail = p.partner_id + '@gmail.com'; }); setupSheetsUnchecked_();", ctx);
  ctx.ss = ss;
  return ctx;
}

module.exports = { createRuntime };

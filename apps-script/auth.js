/**
 * Server-side authentication & authorization (spec §81).
 * The PWA signs in with Google Identity Services and sends the Google ID token with each call.
 * We verify the token with Google, then look the email up in USERS. Roles are NEVER trusted from the client.
 *
 * Roles:
 *   ADMIN   – everything, incl. ownership settings, expense rules, menu, users, voids (Vivek)
 *   PARTNER – all financial views, own withdrawals, purchases/expenses, quick sale/stall, inventory, audit (Akash, Ishan)
 *   STAFF   – quick sale, stall open/close, sales list without costs
 */
const ROLES = { ADMIN: 'ADMIN', PARTNER: 'PARTNER', STAFF: 'STAFF' };

function authenticate_(idToken) {
  if (!idToken) throw authError_('Sign in required.');
  const clientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
  if (!clientId) throw new Error('Server not configured: GOOGLE_CLIENT_ID script property is missing.');

  const cache = CacheService.getScriptCache();
  const cacheKey = 'tok_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)).slice(0, 40);
  let email = cache.get(cacheKey);
  if (email === '!') throw authError_('Invalid sign-in token.'); // recently failed: don't call Google again

  if (!email) {
    // Cheap local checks first, so junk tokens can't burn the UrlFetch quota.
    const claims = decodeJwtPayload_(idToken);
    const nowSec0 = Math.floor(Date.now() / 1000);
    if (!claims || claims.aud !== clientId || Number(claims.exp) <= nowSec0) {
      cache.put(cacheKey, '!', 300);
      throw authError_('Session expired. Please sign in again.');
    }
    const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) { cache.put(cacheKey, '!', 300); throw authError_('Session expired. Please sign in again.'); }
    const info = JSON.parse(res.getContentText());
    const nowSec = Math.floor(Date.now() / 1000);
    const validIss = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
    if (info.aud !== clientId || !validIss || String(info.email_verified) !== 'true' || Number(info.exp) <= nowSec) {
      cache.put(cacheKey, '!', 300);
      throw authError_('Invalid sign-in token.');
    }
    email = String(info.email).toLowerCase();
    const ttl = Math.min(Number(info.exp) - nowSec, 3000);
    if (ttl > 30) cache.put(cacheKey, email, ttl);
  }

  const user = readAll_('USERS').find((u) => String(u.email).toLowerCase() === email && u.status !== 'INACTIVE');
  if (!user) throw authError_('This Google account (' + email + ') is not authorised for Pourology.');
  return { email: email, name: user.name, role: user.role, partner_id: user.partner_id || '' };
}

/** Decode (NOT verify) a JWT payload. Signature/issuer are verified by Google's tokeninfo afterwards. */
function decodeJwtPayload_(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3 || token.length > 4096) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Utilities.newBlob(Utilities.base64Decode(b64 + '==='.slice((b64.length + 3) % 4))).getDataAsString());
  } catch (e) { return null; }
}

function authError_(msg) {
  const e = new Error(msg);
  e.code = 'AUTH';
  return e;
}

function requireRole_(user, roles) {
  if (roles.indexOf(user.role) < 0) {
    const e = new Error('You do not have permission for this action.');
    e.code = 'FORBIDDEN';
    throw e;
  }
}

const FINANCE_ROLES = [ROLES.ADMIN, ROLES.PARTNER];
const ALL_ROLES = [ROLES.ADMIN, ROLES.PARTNER, ROLES.STAFF];

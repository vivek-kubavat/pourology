import { CONFIG } from './config.js';

const TOKEN_KEY = 'pourology.idToken';

export const session = {
  get token() {
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      if (!t) return null;
      const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.exp * 1000 > Date.now() + 30000 ? t : null;
    } catch { return null; }
  },
  set token(t) {
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
  },
};

export class ApiError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

/** POST as text/plain so the browser skips the CORS preflight Apps Script can't answer. */
export async function call(action, payload = {}, { auth = true } = {}) {
  const body = { action, payload };
  if (auth) {
    const t = session.token;
    if (!t) throw new ApiError('Please sign in again.', 'AUTH');
    body.idToken = t;
  }
  let res;
  try {
    res = await fetch(CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError('No connection. Check your internet and try again.', 'NETWORK');
  }
  let json;
  try { json = await res.json(); } catch { throw new ApiError('Unexpected server response.', 'SERVER'); }
  if (!json.ok) {
    if (json.code === 'AUTH') session.token = null;
    throw new ApiError(json.error, json.code);
  }
  return json.data;
}

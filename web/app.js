import { CONFIG } from './config.js';
import { call, session, ApiError } from './api.js';
import { $, esc, errorBox, loading, toast } from './ui.js';

// Client-side nav only hides links; every action is still authorised server-side.
const PAGES = {
  home:        { label: 'My Share',         roles: ['ADMIN', 'PARTNER'], load: () => import('./pages/home.js') },
  sale:        { label: 'Quick Sale',       roles: ['ADMIN', 'PARTNER', 'STAFF'], load: () => import('./pages/sale.js') },
  earnings:    { label: 'Partner Earnings', roles: ['ADMIN', 'PARTNER'], load: () => import('./pages/earnings.js') },
  withdrawals: { label: 'Withdrawals',      roles: ['ADMIN', 'PARTNER'], load: () => import('./pages/withdrawals.js') },
  report:      { label: 'Profit Report',    roles: ['ADMIN', 'PARTNER'], load: () => import('./pages/report.js') },
  sales:       { label: 'Sales',            roles: ['ADMIN', 'PARTNER', 'STAFF'], load: () => import('./pages/sales.js') },
  purchases:   { label: 'Purchases',        roles: ['ADMIN', 'PARTNER'], load: () => import('./pages/purchases.js') },
  inventory:   { label: 'Inventory',        roles: ['ADMIN', 'PARTNER'], load: () => import('./pages/inventory.js') },
  expenses:    { label: 'Expenses',         roles: ['ADMIN', 'PARTNER'], load: () => import('./pages/expenses.js') },
  settings:    { label: 'Settings',         roles: ['ADMIN', 'PARTNER'], load: () => import('./pages/settings.js') },
  audit:       { label: 'Audit',            roles: ['ADMIN', 'PARTNER'], load: () => import('./pages/audit.js') },
};

const state = { user: null };

// Clickjacking guard: GitHub Pages can't send frame-ancestors headers, so refuse to run inside a frame.
if (window.top !== window.self) {
  document.documentElement.innerHTML = '';
  throw new Error('Pourology cannot be embedded in another site.');
}

function allowed(user) {
  return Object.entries(PAGES).filter(([, p]) => p.roles.includes(user.role));
}

function renderShell() {
  const u = state.user;
  $('#nav').innerHTML = allowed(u).map(([id, p]) => `<a href="#/${id}" data-page="${id}">${esc(p.label)}</a>`).join('');
  $('#who').innerHTML = `<span>${esc(u.name)} · ${esc(u.role.toLowerCase())}</span><button class="btn ghost small" id="signout">Sign out</button>`;
  $('#signout').onclick = () => {
    session.token = null;
    window.google?.accounts?.id.disableAutoSelect();
    location.hash = '';
    location.reload();
  };
  $('#app').hidden = false;
  $('#login').hidden = true;
}

async function route() {
  if (!state.user) return;
  const pages = allowed(state.user);
  let id = location.hash.replace(/^#\/?/, '').split('?')[0];
  if (!pages.some(([k]) => k === id)) { id = pages[0][0]; history.replaceState(null, '', `#/${id}`); }
  document.querySelectorAll('#nav a').forEach((a) => a.setAttribute('aria-current', a.dataset.page === id ? 'page' : 'false'));
  // Fresh container per navigation so listeners attached by the previous page are dropped.
  const main = document.createElement('div');
  $('#main').replaceChildren(main);
  main.innerHTML = loading();
  document.title = `${PAGES[id].label} · Pourology`;
  try {
    const mod = await PAGES[id].load();
    await mod.render(main, { user: state.user, call: guarded });
  } catch (e) {
    main.innerHTML = errorBox(e);
  }
}

/** API call wrapper: on expired session, bounce back to sign-in. */
async function guarded(action, payload) {
  try { return await call(action, payload); }
  catch (e) {
    if (e instanceof ApiError && e.code === 'AUTH') { showLogin(e.message); }
    throw e;
  }
}

function showLogin(message) {
  state.user = null;
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#login-msg').innerHTML = message ? `<div class="alert error">${esc(message)}</div>` : '';
  if (CONFIG.DEV) return devLogin();
  if (!window.google?.accounts?.id) {
    $('#login-msg').innerHTML += '<div class="alert">Google Sign-In could not load. Check your connection and reload.</div>';
    return;
  }
  if (CONFIG.GOOGLE_CLIENT_ID.startsWith('PASTE_')) {
    $('#login-msg').innerHTML = '<div class="alert error">Setup needed: add GOOGLE_CLIENT_ID and API_URL in web/config.js.</div>';
    return;
  }
  google.accounts.id.initialize({ client_id: CONFIG.GOOGLE_CLIENT_ID, callback: onCredential, auto_select: true, use_fedcm_for_prompt: true });
  google.accounts.id.renderButton($('#gsi-btn'), { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with' });
  google.accounts.id.prompt();
}

/** Local dev only (npm run dev): pick a seeded user instead of Google sign-in. */
async function devLogin() {
  const users = await fetch('/dev-users').then((r) => r.json());
  $('#gsi-btn').innerHTML = `<p class="small muted">Dev mode: sign in as</p><div class="row" style="justify-content:center">${users.map((u) =>
    `<button class="btn ghost small" data-email="${esc(u.email)}">${esc(u.name)} · ${esc(u.role.toLowerCase())}</button>`).join('')}</div>`;
  $('#gsi-btn').onclick = async (e) => {
    const email = e.target.dataset.email;
    if (!email) return;
    session.token = (await fetch(`/dev-token?email=${encodeURIComponent(email)}`).then((r) => r.json())).token;
    boot();
  };
}

async function onCredential({ credential }) {
  session.token = credential;
  await boot();
}

async function boot() {
  if (!session.token) return showLogin();
  try {
    state.user = await call('me');
    renderShell();
    route();
  } catch (e) {
    showLogin(e.code === 'NETWORK' ? e.message : e.message);
  }
}

window.addEventListener('hashchange', route);
window.addEventListener('load', () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  boot();
});
window.addEventListener('unhandledrejection', (e) => toast(e.reason?.message || 'Something went wrong', 'error'));

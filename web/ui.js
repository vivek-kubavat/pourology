// Small DOM/format helpers shared by every page.

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const inr = (n) => inrFmt.format(Number(n) || 0);
export const num = (n) => new Intl.NumberFormat('en-IN').format(Number(n) || 0);

export function fmtDate(ymd) {
  if (!ymd) return '';
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
export function fmtRange(r) {
  if (!r) return '';
  return r.from === r.to ? fmtDate(r.from) : `${fmtDate(r.from)} – ${fmtDate(r.to)}`;
}
export const todayYmd = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Re-render a page into a fresh node (drops listeners bound to the old one). */
export function rerender(root, render, ctx) {
  const fresh = root.cloneNode(false);
  root.replaceWith(fresh);
  return render(fresh, ctx);
}

let toastTimer;
export function toast(msg, kind = 'ok') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3500);
}

export const loading = (label = 'Loading…') => `<div class="loading" role="status"><span class="spinner"></span>${esc(label)}</div>`;
export const errorBox = (e) => `<div class="alert error" role="alert">${esc(e.message || e)}</div>`;

export const STATUS_LABEL = { PENDING: 'Pending', PARTIALLY_PAID: 'Partially paid', PAID: 'Paid', NO_PROFIT: 'No profit' };
export const statusPill = (s) => `<span class="pill ${esc(String(s).toLowerCase())}">${esc(STATUS_LABEL[s] || s)}</span>`;

/** Period picker (§74). Calls onChange({period, from, to}). */
export function periodPicker(root, onChange, { initial = 'TODAY', allowAll = true } = {}) {
  const opts = [['TODAY', 'Today'], ['YESTERDAY', 'Yesterday'], ['WEEK', 'This week'], ['MONTH', 'This month'], ...(allowAll ? [['ALL', 'All time']] : []), ['CUSTOM', 'Custom']];
  root.innerHTML = `
    <div class="period">
      <div class="seg" role="tablist">${opts.map(([v, l]) => `<button type="button" role="tab" data-p="${v}" aria-selected="${v === initial}">${l}</button>`).join('')}</div>
      <div class="custom" hidden>
        <label>From <input type="date" name="from" max="${todayYmd()}"></label>
        <label>To <input type="date" name="to" max="${todayYmd()}"></label>
        <button type="button" class="btn small" data-apply>Apply</button>
      </div>
    </div>`;
  const custom = $('.custom', root);
  $$('.seg button', root).forEach((b) => b.addEventListener('click', () => {
    $$('.seg button', root).forEach((x) => x.setAttribute('aria-selected', x === b));
    custom.hidden = b.dataset.p !== 'CUSTOM';
    if (b.dataset.p !== 'CUSTOM') onChange({ period: b.dataset.p });
  }));
  $('[data-apply]', root).addEventListener('click', () => {
    const from = $('[name=from]', root).value, to = $('[name=to]', root).value;
    if (!from || !to) return toast('Choose both dates', 'error');
    if (from > to) return toast('"From" must be on or before "To"', 'error');
    onChange({ period: 'CUSTOM', from, to });
  });
  onChange({ period: initial });
}

export function downloadCsv(filename, columns, rows) {
  // Text starting with = + - @ would run as a formula in Excel/Sheets (CSV injection): prefix with '.
  const cell = (v) => {
    let s = String(v ?? '');
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => cell(c.label)).join(',')].concat(rows.map((r) => columns.map((c) => cell(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(',')));
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Wrap a form submit: disables the button, shows errors, resets on success. */
export function onSubmit(form, handler) {
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = form.querySelector('[type=submit]');
    if (btn) btn.disabled = true;
    try { await handler(Object.fromEntries(new FormData(form)), form); }
    catch (e) { toast(e.message, 'error'); }
    finally { if (btn) btn.disabled = false; }
  });
}

export const DISCLAIMER_HTML = (text) => `<p class="disclaimer"><strong>Estimated / Internal Profit Share.</strong> ${esc(text || '')}</p>`;

/** Ownership donut (§88). Uses Chart.js loaded from CDN; silently skips if unavailable. */
export function ownershipDonut(canvas, rows) {
  if (!window.Chart || !canvas) return null;
  const css = getComputedStyle(document.documentElement);
  const colors = ['--c1', '--c2', '--c3', '--c4', '--c5'].map((v) => css.getPropertyValue(v).trim());
  return new window.Chart(canvas, {
    type: 'doughnut',
    data: { labels: rows.map((r) => `${r.name} — ${r.percentage}%`), datasets: [{ data: rows.map((r) => r.percentage), backgroundColor: colors, borderColor: css.getPropertyValue('--surface').trim(), borderWidth: 2 }] },
    options: { animation: false, cutout: '62%', plugins: { legend: { position: 'right', labels: { color: css.getPropertyValue('--text').trim(), boxWidth: 12 } }, tooltip: { callbacks: { label: (c) => ` ${c.label}` } } }, maintainAspectRatio: false },
  });
}

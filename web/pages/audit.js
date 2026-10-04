import { $, esc, errorBox, loading } from '../ui.js';

const ENTITIES = ['', 'PARTNER_WITHDRAWALS', 'PARTNER_OWNERSHIP_HISTORY', 'PARTNER_DISTRIBUTIONS', 'SETTINGS', 'SALES', 'PURCHASES', 'EXPENSES', 'STALL_SESSIONS', 'MENU_ITEMS', 'RECIPES', 'INGREDIENTS', 'USERS'];

export async function render(root, { call }) {
  root.innerHTML = `
    <div class="page-head"><h1>Audit log</h1>
      <label>Filter<select id="ent">${ENTITIES.map((e) => `<option value="${e}">${e ? e.replace(/_/g, ' ').toLowerCase() : 'All activity'}</option>`).join('')}</select></label></div>
    <section class="card" id="out"></section>`;
  const load = async () => {
    const out = $('#out', root);
    out.innerHTML = loading();
    let rows;
    try { rows = await call('listAudit', { entity: $('#ent', root).value, limit: 300 }); } catch (e) { out.innerHTML = errorBox(e); return; }
    out.innerHTML = rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td class="small">${esc(new Date(r.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))}</td><td class="small">${esc(r.user_email)}</td><td><strong>${esc(r.action.replace(/_/g, ' ').toLowerCase())}</strong><div class="muted small">${esc(r.entity_id)}</div></td>
      <td><details class="trace"><summary>View</summary>${r.before_json ? `<p class="small muted">Before</p><pre class="small" style="white-space:pre-wrap;word-break:break-word">${esc(pretty(r.before_json))}</pre>` : ''}<p class="small muted">After</p><pre class="small" style="white-space:pre-wrap;word-break:break-word">${esc(pretty(r.after_json))}</pre></details></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No audit entries.</p>';
  };
  $('#ent', root).addEventListener('change', load);
  load();
}

function pretty(s) { try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; } }

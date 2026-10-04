import { esc, inr, statusPill, DISCLAIMER_HTML, errorBox } from '../ui.js';
import { plLedger, traceBlock, stat } from './shared.js';

// §82–83: "My Business Share" + business snapshot + shortcuts for the user's role.
export async function render(root, { user, call }) {
  let d;
  try { d = await call('getMyShare'); } catch (e) { root.innerHTML = errorBox(e); return; }

  // Everyone with financial access also runs the stall (Quick Sale, Open/Close stall, purchases, inventory).
  const links = [['sale', 'Quick Sale / Open–Close Stall'], ['purchases', 'Purchases'], ['inventory', 'Inventory'], ['sales', 'Sales history'],
    ['earnings', 'Business revenue & profit'], ['audit', 'Audit']].concat(user.role === 'ADMIN' ? [['settings', 'Admin settings']] : []);

  const share = d.partner ? `
    <section class="card">
      <div class="page-head">
        <div><h1>My Business Share</h1><p class="muted">${esc(d.partner.name)} · ownership <strong>${d.partner.ownership}%</strong></p></div>
        ${statusPill(d.status)}
      </div>
      <div class="grid">
        ${stat("Today's estimated share", inr(d.today_share), traceBlock(d.today_trace, 'Calculation'))}
        ${stat("This month's estimated share", inr(d.month_share), traceBlock(d.month_trace, 'Calculation'))}
        ${stat('Total earned', inr(d.total_earned))}
        ${stat('Paid / withdrawn', inr(d.paid))}
        ${stat('Remaining payable', inr(d.remaining), '', 'hl')}
      </div>
      ${DISCLAIMER_HTML(d.disclaimer)}
    </section>` : `<section class="card"><h1>Business overview</h1><p class="muted">Your account is not linked to a partner, so no personal share is shown.</p></section>`;

  root.innerHTML = `
    ${share}
    <div class="grid two">
      <section class="card">${plLedger(d.business.today, { title: 'Today' })}</section>
      <section class="card">${plLedger(d.business.month, { title: 'This month' })}</section>
    </div>
    <section class="card"><h2>Shortcuts</h2><div class="row">${links.map(([id, l]) => `<a class="btn ghost" href="#/${id}">${esc(l)}</a>`).join('')}</div></section>`;
}

import { $, $$, esc, inr, errorBox, toast, rerender } from '../ui.js';

// Quick Sale + Open/Close Stall (§83).
export async function render(root, ctx) {
  const { call } = ctx;
  let catalog, stall;
  try { [catalog, stall] = await Promise.all([call('getCatalog'), call('getStallStatus')]); }
  catch (e) { root.innerHTML = errorBox(e); return; }

  const items = catalog.items.filter((i) => i.status === 'ACTIVE');
  const cart = {};

  root.innerHTML = `
    <div class="page-head"><h1>Quick Sale</h1>
      <div class="row">${stall.open
        ? `<span class="pill open">Stall open since ${new Date(stall.session.opened_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span><button class="btn ghost small" id="close">Close stall</button>`
        : `<span class="pill pending">Stall closed</span><button class="btn small" id="open">Open stall</button>`}</div>
    </div>
    <div class="grid two">
      <section class="card">${[...new Set(items.map((i) => i.category))].map((cat) => `
        <h3 class="eyebrow" style="font-family:var(--font-body);margin:4px 0 8px">${esc(cat || 'Menu')}</h3>
        <div class="menu-grid" style="margin-bottom:14px">${items.filter((i) => i.category === cat).map((i) => `
          <button class="menu-btn" data-id="${esc(i.item_id)}"><strong>${esc(i.name)}</strong><span class="muted">${inr(i.price)}</span><span class="count" hidden></span></button>`).join('')}
        </div>`).join('') || '<p class="muted">No active menu items. Add some in Settings → Menu.</p>'}
      </section>
      <section class="card">
        <h2>Order</h2>
        <div id="cart"></div>
        <div class="row" style="justify-content:space-between;margin:12px 0"><strong>Total</strong><strong id="total" class="num">${inr(0)}</strong></div>
        <div class="seg" id="pay" role="radiogroup" aria-label="Payment mode">${['CASH', 'UPI', 'CARD'].map((m, i) => `<button type="button" data-m="${m}" aria-selected="${i === 0}">${m}</button>`).join('')}</div>
        <div class="row" style="margin-top:12px"><button class="btn" id="charge" disabled style="flex:1">Record sale</button><button class="btn ghost" id="clear">Clear</button></div>
      </section>
    </div>`;

  const byId = Object.fromEntries(items.map((i) => [i.item_id, i]));
  const draw = () => {
    const ids = Object.keys(cart).filter((k) => cart[k] > 0);
    $('#cart', root).innerHTML = ids.length ? ids.map((id) => `
      <div class="cart-line"><span>${esc(byId[id].name)}</span>
        <span class="qty"><button class="btn ghost small" data-dec="${esc(id)}" aria-label="Remove one">−</button><strong>${cart[id]}</strong><button class="btn ghost small" data-inc="${esc(id)}" aria-label="Add one">+</button></span>
        <span class="num">${inr(cart[id] * byId[id].price)}</span></div>`).join('') : '<p class="muted">Tap items to add them.</p>';
    $('#total', root).textContent = inr(ids.reduce((s, id) => s + cart[id] * byId[id].price, 0));
    $('#charge', root).disabled = !ids.length;
    $$('.menu-btn', root).forEach((b) => { const c = $('.count', b); c.hidden = !cart[b.dataset.id]; c.textContent = cart[b.dataset.id] || ''; });
  };
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-id],[data-inc],[data-dec]');
    if (!t) return;
    const id = t.dataset.id || t.dataset.inc || t.dataset.dec;
    cart[id] = Math.max(0, (cart[id] || 0) + (t.dataset.dec ? -1 : 1));
    draw();
  });
  $$('#pay button', root).forEach((b) => b.onclick = () => $$('#pay button', root).forEach((x) => x.setAttribute('aria-selected', x === b)));
  $('#clear', root).onclick = () => { Object.keys(cart).forEach((k) => delete cart[k]); draw(); };
  $('#charge', root).onclick = async (e) => {
    e.target.disabled = true;
    try {
      const lines = Object.entries(cart).filter(([, q]) => q > 0).map(([item_id, qty]) => ({ item_id, qty }));
      const payment_mode = $('#pay [aria-selected=true]', root).dataset.m;
      const r = await call('recordSale', { lines, payment_mode });
      toast(`Sale recorded: ${r.cups} × coffee, ${inr(r.total)}`);
      $('#clear', root).click();
    } catch (err) { toast(err.message, 'error'); draw(); }
  };
  $('#open', root)?.addEventListener('click', async () => {
    const cash = prompt('Opening cash in drawer (₹)', '0');
    if (cash === null) return;
    try { await call('openStall', { opening_cash: Number(cash) || 0 }); toast('Stall opened'); rerender(root, render, ctx); } catch (e) { toast(e.message, 'error'); }
  });
  $('#close', root)?.addEventListener('click', async () => {
    const cash = prompt('Closing cash in drawer (₹)', '0');
    if (cash === null) return;
    try { const r = await call('closeStall', { closing_cash: Number(cash) || 0 }); toast(`Stall closed · ${r.cups} coffees · ${inr(r.revenue)}`); rerender(root, render, ctx); } catch (e) { toast(e.message, 'error'); }
  });
  draw();
}

import { $, esc, errorBox, onSubmit, toast, rerender } from '../ui.js';

// Stall & Contact: what customers see on the public menu (location, call, WhatsApp, Porter delivery).
export async function render(root, ctx) {
  let d;
  try { d = await ctx.call('getStallInfo'); } catch (e) { root.innerHTML = errorBox(e); return; }
  const loc = d.location_detail;
  const local = (n) => (n || '').replace(/^\+91/, '');

  root.innerHTML = `
    <div class="page-head"><div><h1>Stall &amp; Contact</h1><p class="muted small">Shown to customers on the public menu.</p></div>
      <a class="btn ghost small" href="menu.html" target="_blank" rel="noopener">Preview menu</a></div>

    <section class="card">
      <h2>Stall location</h2>
      ${loc ? `
        <p><strong>${esc(loc.label || 'Current stall location')}</strong><br>
        <span class="muted small">Updated ${esc(new Date(loc.updated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))}
        by ${esc(String(loc.updated_by).split('@')[0])}${loc.accuracy ? ` · ±${esc(loc.accuracy)} m` : ''}</span></p>
        <p><a class="btn ghost small" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${encodeURIComponent(loc.lat + ',' + loc.lng)}">Open in Google Maps</a></p>`
      : '<p class="muted">No location set yet. Customers won\'t see a "Find us" button until you set one.</p>'}
      <label style="margin:12px 0">Landmark / note for customers (optional)
        <input id="loc-label" maxlength="120" placeholder="e.g. Opposite Law Garden, near the fountain" value="${esc(loc?.label || '')}"></label>
      <button class="btn" id="here" style="width:100%">📍 We're here — use my current location</button>
      <p class="muted small" id="loc-status">Stand at the stall, tap the button and allow location access. Works best outdoors.</p>
    </section>

    <section class="card">
      <h2>Customer contact &amp; Porter delivery</h2>
      <form class="form" id="cform">
        <label>Call number<input name="phone" type="tel" inputmode="tel" placeholder="98250 12345" value="${esc(local(d.phone))}"></label>
        <label>WhatsApp number<input name="whatsapp" type="tel" inputmode="tel" placeholder="98250 12345" value="${esc(local(d.whatsapp))}"></label>
        <label class="row" style="grid-column:1/-1;color:var(--text)"><input type="checkbox" name="same" style="width:auto" ${d.phone && d.phone === d.whatsapp ? 'checked' : ''}> WhatsApp is the same as the call number</label>
        <label class="row" style="grid-column:1/-1;color:var(--text)"><input type="checkbox" name="delivery_enabled" style="width:auto" ${d.delivery.enabled ? 'checked' : ''}> Offer Porter delivery anywhere in Ahmedabad</label>
        <label style="grid-column:1/-1">Delivery note shown to customers (optional)
          <input name="delivery_note" maxlength="200" placeholder="e.g. Delivery charges as per Porter. Orders 9 am – 9 pm." value="${esc(d.delivery.note)}"></label>
        <button class="btn" type="submit">Save contact</button>
      </form>
      <p class="muted small">These numbers are public on the menu. The menu shows "Pourology", never partner names.</p>
    </section>`;

  const form = $('#cform', root);
  const syncSame = () => { if (form.same.checked) form.whatsapp.value = form.phone.value; form.whatsapp.readOnly = form.same.checked; };
  form.same.addEventListener('change', syncSame);
  form.phone.addEventListener('input', syncSame);
  syncSame();
  onSubmit(form, async (v) => {
    await ctx.call('setContact', { phone: v.phone, whatsapp: v.same === 'on' ? v.phone : v.whatsapp, delivery_enabled: v.delivery_enabled === 'on', delivery_note: v.delivery_note });
    toast('Contact saved. Customers see it on the menu now.');
    rerender(root, render, ctx);
  });

  $('#here', root).addEventListener('click', async (e) => {
    const btn = e.currentTarget, status = $('#loc-status', root);
    if (!('geolocation' in navigator)) return toast('This device cannot share location', 'error');
    btn.disabled = true;
    status.textContent = 'Getting your location…';
    try {
      const pos = await getPosition();
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      await ctx.call('setStallLocation', { lat, lng, accuracy, label: $('#loc-label', root).value });
      toast(`Location saved (±${Math.round(accuracy)} m). Customers can now find you.`);
      rerender(root, render, ctx);
    } catch (err) {
      status.textContent = err.code === 1 ? 'Location permission was blocked. Allow it in your browser settings and try again.' : (err.message || 'Could not get location.');
      toast(status.textContent, 'error');
      btn.disabled = false;
    }
  });
}

/** Best of a few seconds of GPS fixes (first fix is often coarse). */
export function getPosition() {
  return new Promise((resolve, reject) => {
    let best = null;
    const id = navigator.geolocation.watchPosition((p) => {
      if (!best || p.coords.accuracy < best.coords.accuracy) best = p;
      if (p.coords.accuracy <= 25) finish();
    }, (err) => { navigator.geolocation.clearWatch(id); clearTimeout(t); best ? resolve(best) : reject(err); },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    const finish = () => { navigator.geolocation.clearWatch(id); clearTimeout(t); resolve(best); };
    const t = setTimeout(() => (best ? finish() : (navigator.geolocation.clearWatch(id), reject(new Error('Location timed out. Try again outdoors.')))), 12000);
  });
}

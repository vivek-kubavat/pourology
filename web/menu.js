// Public customer menu. Uses only the unauthenticated getMenu / getPublicInfo actions: item names,
// prices, descriptions, stall location and the public call/WhatsApp numbers. Nothing financial,
// no partner names.
import { call } from './api.js';
import { esc } from './ui.js';

// Look of each section, from the printed menu. Categories not listed here get a plain card.
const STYLE = {
  'Pour-over': { cls: 'teal', sub: 'Brewed slow, one cup at a time', foot: 'Brewed to order' },
  'Moka': { cls: 'peach', sub: 'Stovetop, strong and sweet', foot: 'Made on the stove' },
};
const DOTS = ['var(--teal)', 'var(--peach)', 'var(--gold)', 'var(--espresso)'];
const CACHE_KEY = 'pourology.menu.v1';
const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');
const $ = (s) => document.querySelector(s);

const ICON = {
  pin: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.2.1.6-.1 1.2z"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7l-6.7 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1z"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3 2 12h3v8h5v-5h4v5h5v-8h3z"/></svg>',
};

const mapsUrl = (l) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${l.lat},${l.lng}`)}`;
const directionsUrl = (l) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${l.lat},${l.lng}`)}`;
const telUrl = (n) => `tel:${n}`;
const waUrl = (n, text) => `https://wa.me/${n.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!isFinite(m) || m < 0) return '';
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; } }
function writeCache(v) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch {} }

async function load() {
  try {
    const [items, info] = await Promise.all([
      call('getMenu', {}, { auth: false }),
      call('getPublicInfo', {}, { auth: false }).catch(() => null),
    ]);
    const data = { items, info, saved: Date.now() };
    writeCache(data);
    return { ...data, offline: false };
  } catch (e) {
    const cached = readCache();
    if (cached) return { ...cached, offline: true };
    throw e;
  }
}

// ---------- menu ----------
function renderMenu(items) {
  const groups = new Map();
  items.forEach((i) => { const c = i.category || 'Menu'; if (!groups.has(c)) groups.set(c, []); groups.get(c).push(i); });
  const adds = groups.get('Additives') || [];
  groups.delete('Additives');

  const cards = [...groups].map(([cat, list]) => {
    const st = STYLE[cat] || { cls: '', sub: '', foot: '' };
    return `<section class="cat ${st.cls}">
      <h2>${esc(cat)}</h2>${st.sub ? `<p class="sub">${esc(st.sub)}</p>` : ''}
      ${list.map((i) => `<div class="item"><div class="item-top"><h3>${esc(i.name)}</h3><span class="price">${rupees(i.price)}</span></div>${i.description ? `<p>${esc(i.description)}</p>` : ''}</div>`).join('')}
      ${st.foot ? `<div class="foot">${esc(st.foot)}</div>` : ''}
    </section>`;
  }).join('');

  const samePrice = adds.length && adds.every((a) => a.price === adds[0].price);
  const addBox = adds.length ? `<section class="adds">
    <div class="eyebrow">Additives${samePrice ? ` · ${rupees(adds[0].price)} each` : ''}</div>
    <ul>${adds.map((a, k) => `<li style="--dot:${DOTS[k % DOTS.length]}">${esc(a.name)}${samePrice ? '' : ` · ${rupees(a.price)}`}</li>`).join('')}</ul>
  </section>` : '';

  $('#menu').innerHTML = cards || addBox ? `<div class="cats">${cards}</div>${addBox}` : '<p class="muted">Menu coming soon.</p>';
}

// ---------- one-tap contact ----------
function renderContact(info) {
  if (!info) return;
  const { location: loc, phone, whatsapp } = info;
  const btns = [];
  if (loc) btns.push(`<a class="cbtn" href="${esc(directionsUrl(loc))}" target="_blank" rel="noopener">${ICON.pin} Find us</a>`);
  if (phone) btns.push(`<a class="cbtn gold" href="${esc(telUrl(phone))}">${ICON.phone} Call</a>`);
  if (whatsapp) btns.push(`<a class="cbtn wa" href="${esc(waUrl(whatsapp, 'Hi Pourology! '))}" target="_blank" rel="noopener">${ICON.wa} WhatsApp</a>`);
  if (btns.length) {
    const bar = $('#actionbar');
    bar.innerHTML = btns.join('');
    bar.hidden = false;
    document.body.classList.add('has-bar');
  }
  if (loc) {
    $('#findus').innerHTML = `<div class="findus">
      <div><b>Find us today</b><br><span>${esc(loc.label || 'Pourology stall')}</span>
      <span class="muted"> · updated ${esc(ago(loc.updated_at))}</span></div>
      <a class="cbtn light" style="border:1.5px solid var(--espresso)" href="${esc(mapsUrl(loc))}" target="_blank" rel="noopener">${ICON.pin} Open map</a>
    </div>`;
  }
}

// ---------- Porter delivery ----------
function renderDelivery(info) {
  if (!info || !info.delivery.enabled || !(info.phone || info.whatsapp)) return;
  const { location: loc, phone, whatsapp, delivery } = info;
  $('#delivery').innerHTML = `<section class="deliver" aria-labelledby="dtitle">
    <h2 id="dtitle">Coffee anywhere in Ahmedabad</h2>
    <p class="sub">Delivered fresh via Porter. Three quick steps:</p>
    <ol>
      <li><div><strong>Tell us your order.</strong> Call or WhatsApp us what you'd like.
        <div class="acts">
          ${phone ? `<a class="cbtn gold" href="${esc(telUrl(phone))}">${ICON.phone} Call to order</a>` : ''}
          ${whatsapp ? `<button type="button" class="cbtn wa" id="wa-order">${ICON.wa} WhatsApp order</button>` : ''}
        </div>
        ${whatsapp ? '<label class="row"><input type="checkbox" id="wa-loc" style="width:auto"> Add my current location to the message</label>' : ''}
      </div></li>
      <li><div><strong>Book a Porter</strong> (two-wheeler) with <em>pickup at our stall</em> and drop at your place.
        <div class="acts">
          ${loc ? `<button type="button" class="cbtn light" id="share-pickup">${ICON.share} Share our pickup location</button>` : ''}
          <a class="cbtn light" href="https://porter.in/" target="_blank" rel="noopener">Open Porter</a>
        </div>
      </div></li>
      <li><div><strong>Send us your Porter booking.</strong> We hand your coffee to the rider, hot and sealed.</div></li>
    </ol>
    ${delivery.note ? `<p class="note">${esc(delivery.note)}</p>` : '<p class="note">Delivery is booked and paid by you on Porter. Coffee is paid to us by UPI.</p>'}
  </section>`;

  $('#wa-order')?.addEventListener('click', async () => {
    let msg = "Hi Pourology! I'd like coffee delivered via Porter.\n\nMy order:\n- \n\nName: ";
    if ($('#wa-loc')?.checked && 'geolocation' in navigator) {
      try {
        const p = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 }));
        msg += `\nMy location: https://www.google.com/maps?q=${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)}`;
      } catch { msg += '\nMy location: '; }
    } else msg += '\nMy location: ';
    window.open(waUrl(whatsapp, msg), '_blank', 'noopener');
  });

  $('#share-pickup')?.addEventListener('click', async () => {
    const text = `Pourology Coffee Lab (pickup)${loc.label ? ` — ${loc.label}` : ''}`;
    const url = mapsUrl(loc);
    try {
      if (navigator.share) await navigator.share({ title: 'Pourology pickup location', text, url });
      else { await navigator.clipboard.writeText(`${text}\n${url}`); flash('#share-pickup', 'Copied! Paste it as pickup in Porter'); }
    } catch (e) { if (e.name !== 'AbortError') window.open(url, '_blank', 'noopener'); }
  });
}

function flash(sel, text) {
  const b = $(sel);
  if (!b) return;
  const old = b.innerHTML;
  b.textContent = text;
  setTimeout(() => { b.innerHTML = old; }, 2500);
}

// ---------- Add to Home Screen ----------
// Always offered (unless already installed). Chrome/Edge on Android use the native install prompt when the
// browser provides one; otherwise (iPhone Safari, in-app browsers…) we show the 2-step instructions.
function renderInstall() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return;
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); // iPadOS reports as Mac
  const steps = ios
    ? 'In <strong>Safari</strong>, tap <strong>Share</strong> (the square with ↑) → <strong>Add to Home Screen</strong> → <strong>Add</strong>.'
    : 'Open your browser menu <strong>⋮</strong> → <strong>Add to Home screen</strong> (or <strong>Install app</strong>) → <strong>Add</strong>.';
  $('#install').innerHTML = `<section class="install">
    <img src="icons/icon-192.png" alt="" width="56" height="56">
    <div><b>Keep our menu on your home screen</b><p>One tap for the menu, our location, call and WhatsApp. No app store needed.</p>
      <p class="ios-steps" id="install-steps" hidden>${steps}</p></div>
    <button type="button" class="cbtn" id="install-btn">${ICON.home} Add to Home Screen</button></section>`;

  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', () => { $('#install').innerHTML = ''; });
  $('#install-btn').addEventListener('click', async () => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      if (outcome === 'accepted') { $('#install').innerHTML = ''; return; }
    }
    $('#install-steps').hidden = false;
  });
}

// ---------- boot ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
renderInstall();
try {
  const data = await load();
  renderMenu(data.items);
  renderContact(data.info);
  renderDelivery(data.info);
  if (data.offline) $('#findus').insertAdjacentHTML('afterbegin', `<p class="offline">You're offline. Showing the menu saved on ${esc(new Date(data.saved).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))}.</p>`);
} catch (e) {
  $('#menu').innerHTML = '<p class="muted">Menu unavailable right now. Please ask at the stall.</p>';
}

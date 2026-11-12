// Public customer menu. Uses only the unauthenticated getMenu / getPublicInfo actions: item names,
// prices, descriptions, stall location and the public call/WhatsApp numbers. Nothing financial,
// no partner names.
import { call } from './api.js';
import { esc } from './ui.js';
import { ICON as ART, LINE } from './menu-art.js';

// How each category of the printed menu is drawn: line icon, photo (web/img/<name>.webp with its pixel
// size and the share of the card it takes), the small note after the heading and the tagline.
// A category that is not listed here still shows, as a plain list card.
const SEC = {
  'brewed coffee': { icon: 'dripper', img: ['brewed', 590, 748], tag: 'Pure brews that reveal coffee in its truest form.', hero: true },
  'lattes': { icon: 'cup', img: ['latte', 396, 320], note: '(Coffee + Milk)', tag: 'Smooth, balanced and made for every mood.' },
  'mocha molecule': { icon: 'atom', img: ['mocha', 298, 452, '34%'] },
  'cold coffee': { icon: 'straw', img: ['cold', 256, 328], tag: 'Chilled, bold and naturally energising.' },
  'hot chocolate': { icon: 'cup', img: ['hotchoc', 510, 376, '46%'] },
  'custom coffee': { icon: 'sliders', img: ['flask', 272, 360, '30%'] },
};
const key = (v) => String(v).trim().toLowerCase();
const CACHE_KEY = 'pourology.menu.v2';
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
const photo = (img, alt) => img ? `<img class="photo" src="img/${img[0]}.webp" width="${img[1]}" height="${img[2]}" alt="${esc(alt)}" loading="lazy">` : '';
// "Hot Latte (250 ml)" → the size is printed lighter after the name.
const itemName = (n) => { const m = /^(.*?)\s*\(([^()]*\bml)\)$/i.exec(n); return m ? `${esc(m[1])} <small>(${esc(m[2])})</small>` : esc(n); };
const row = (i) => `<div class="drink"><h3>${itemName(i.name)}</h3>${i.description ? `<p>${esc(i.description)}</p>` : ''}<span class="price">${rupees(i.price)}</span></div>`;

function section(cat, list) {
  const cfg = SEC[key(cat)] || {};
  const head = `<div class="sec-head">${cfg.icon ? `<span class="ico">${ART[cfg.icon]}</span>` : ''}
    <div><h2>${esc(cat)}${cfg.note ? `<small>${esc(cfg.note)}</small>` : ''}</h2>${cfg.tag ? `<p class="tag">${esc(cfg.tag)}</p>` : ''}</div></div>`;
  const rows = `<div class="rows">${list.map(row).join('')}</div>`;
  if (cfg.hero) return { kind: 'hero', html: `${head}<div class="shot">${photo(cfg.img, cat)}</div>${rows}` };
  // One drink sold in sizes: every item is named "<Category> (<Size>, <volume>)".
  const sized = list.length > 1 && list.map((i) => new RegExp(`^${cat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(([^,()]+),?\\s*([^()]*)\\)$`, 'i').exec(i.name.trim()));
  if (sized && sized.every(Boolean)) {
    return { kind: 'sizes', html: `${head}${photo(cfg.img, cat)}
      <div class="item"><h3>${esc(cat)}</h3>${list[0].description ? `<p>${esc(list[0].description)}</p>` : ''}</div>
      <div class="opts">${list.map((i, n) => `<div class="opt"><b>${esc(sized[n][1].trim())}</b>${sized[n][2] ? `<span>(${esc(sized[n][2].trim())})</span>` : ''}<span class="price">${rupees(i.price)}</span></div>`).join('')}</div>` };
  }
  if (list.length === 1 && key(list[0].name) === key(cat)) {
    const i = list[0];
    return { kind: 'single', style: cfg.img && cfg.img[3] ? `--pw:${cfg.img[3]};` : '',
      html: `<div class="txt">${head}${i.description ? `<p class="desc">${esc(i.description)}</p>` : ''}<span class="price">${rupees(i.price)}</span></div>${photo(cfg.img, cat)}` };
  }
  return { kind: `list${cfg.img ? ' pic' : ''}`, html: cfg.img ? `${head}<div class="body">${photo(cfg.img, cat)}${rows}</div>` : head + rows };
}

function renderMenu(items) {
  const groups = new Map();
  items.forEach((i) => { const c = i.category || 'Menu'; if (!groups.has(c)) groups.set(c, []); groups.get(c).push(i); });
  const secs = [...groups].map(([cat, list]) => section(cat, list));
  // On wide screens the cards sit on a 14-column grid like the poster: a list next to a single drink (8 + 6),
  // two single drinks side by side (7 + 7), everything else full width.
  secs.forEach((s, n) => {
    if (s.span) return;
    const next = secs[n + 1];
    const narrow = (x) => x && (x.kind === 'single' || x.kind === 'list pic');
    if (narrow(s) && next && next.kind === 'single') { s.span = s.kind === 'single' ? 7 : 8; next.span = 14 - s.span; } else s.span = 14;
  });
  $('#menu').innerHTML = secs.map((s) => `<section class="sec ${s.kind}" style="--span:${s.span};${s.style || ''}">${s.html}</section>`).join('')
    || '<p class="muted">Menu coming soon.</p>';
}

// ---------- footer of the sheet: find us, WhatsApp, Porter ----------
function renderFoot(info) {
  const { location: loc, phone, whatsapp, delivery } = info || {};
  const find = loc ? directionsUrl(loc) : phone ? telUrl(phone) : '';
  const links = [
    find ? `<a href="${esc(find)}"${loc ? ' target="_blank" rel="noopener"' : ''}>${LINE.phone} Find us</a>` : '',
    whatsapp ? `<a href="${esc(waUrl(whatsapp, 'Hi Pourology! '))}" target="_blank" rel="noopener">${LINE.wa} WhatsApp</a>` : '',
    delivery && delivery.enabled && (phone || whatsapp) ? `<a href="#delivery">${LINE.scooter} Porter delivery</a>` : '',
  ].join('');
  $('#foot').innerHTML = `<footer class="foot">
    ${links ? `<div class="links">${links}</div>` : '<div class="links"></div>'}
    <span class="city">AHMEDABAD</span></footer>`;
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
// Suggested twice: a compact banner at the top (dismissible for 7 days) and a box at the bottom.
// Chrome/Edge on Android use the native install prompt when available; otherwise (iPhone Safari,
// in-app browsers…) tapping the button shows the 2-step instructions.
const DISMISS_KEY = 'pourology.installDismissed';
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });
window.addEventListener('appinstalled', () => { $('#install').innerHTML = ''; $('#install-top').innerHTML = ''; });

function renderInstall() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return;
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); // iPadOS reports as Mac
  const steps = ios
    ? 'In <strong>Safari</strong>, tap <strong>Share</strong> (the square with ↑) → <strong>Add to Home Screen</strong> → <strong>Add</strong>.'
    : 'Open your browser menu <strong>⋮</strong> → <strong>Add to Home screen</strong> (or <strong>Install app</strong>) → <strong>Add</strong>.';

  async function install(stepsEl, container) {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (outcome === 'accepted') { $('#install').innerHTML = ''; $('#install-top').innerHTML = ''; return; }
    }
    stepsEl.hidden = false;
    container?.classList.add('open');
  }

  // Bottom box (always)
  $('#install').innerHTML = `<section class="install">
    <img src="icons/menu-192.png" alt="" width="56" height="56">
    <div><b>Keep our menu on your home screen</b><p>One tap for the menu, our location, call and WhatsApp. No app store needed.</p>
      <p class="ios-steps" id="install-steps" hidden>${steps}</p></div>
    <button type="button" class="cbtn" id="install-btn">${ICON.home} Add to Home Screen</button></section>`;
  $('#install-btn').addEventListener('click', () => install($('#install-steps')));

  // Top banner (unless dismissed in the last 7 days)
  let dismissed = 0;
  try { dismissed = Number(localStorage.getItem(DISMISS_KEY)) || 0; } catch {}
  if (Date.now() - dismissed < 7 * 864e5) return;
  $('#install-top').innerHTML = `<aside class="install-top" aria-label="Add Pourology to your home screen">
    <img src="icons/menu-192.png" alt="" width="40" height="40">
    <div><b>Get the Pourology app</b><span>Menu, location &amp; WhatsApp in one tap</span></div>
    <button type="button" class="cbtn gold" id="install-top-btn">Add</button>
    <button type="button" class="x" id="install-top-x" aria-label="Dismiss">×</button>
    <p class="steps" id="install-top-steps" hidden>${steps}</p>
  </aside>`;
  $('#install-top-btn').addEventListener('click', () => install($('#install-top-steps'), $('.install-top')));
  $('#install-top-x').addEventListener('click', () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    $('#install-top').innerHTML = '';
  });
}

// ---------- boot ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
renderInstall();
try {
  const data = await load();
  renderMenu(data.items);
  renderFoot(data.info);
  renderContact(data.info);
  renderDelivery(data.info);
  if (data.offline) $('#notice').insertAdjacentHTML('afterbegin', `<p class="offline">You're offline. Showing the menu saved on ${esc(new Date(data.saved).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))}.</p>`);
} catch (e) {
  $('#menu').innerHTML = '<p class="muted">Menu unavailable right now. Please ask at the stall.</p>';
}

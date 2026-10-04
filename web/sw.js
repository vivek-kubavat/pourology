// App-shell cache so the PWA opens instantly and installs. API calls always go to the network:
// financial data is never cached on the device.
const VERSION = 'pourology-v5';
const SHELL = [
  './', './index.html', './menu.html', './styles.css', './app.js', './api.js', './ui.js', './config.js',
  './pages/shared.js', './pages/home.js', './pages/sale.js', './pages/earnings.js', './pages/withdrawals.js',
  './pages/report.js', './pages/sales.js', './pages/purchases.js', './pages/inventory.js', './pages/expenses.js',
  './pages/settings.js', './pages/audit.js', './manifest.webmanifest', './icons/logo-tile.png', './icons/favicon-64.png', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './qr.html', './menu.js', './vendor/chart.umd.min.js', './qr/menu-qr.svg', './qr/menu-qr-logo.png', './qr/menu-card.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API, Google, CDN → network
  // Network-first so deploys show up immediately; fall back to cache when offline.
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});

/**
 * Generate the customer-menu QR code (scan → public menu page).
 *   npm run qr                          # uses the default GitHub Pages URL below
 *   npm run qr -- https://example.com/menu.html
 * Outputs (in web/qr/):
 *   menu-qr.svg       QR with the Po tile in the centre (vector)
 *   menu-qr.png       plain QR, 1200px (fallback)
 *   menu-qr-logo.png  QR with the Po tile, 1200px     } rendered with local Google Chrome (headless)
 *   menu-card.png     full branded A6 table card      } so they match the on-screen design exactly
 * Error correction "H" keeps the code scannable with the logo covering the centre.
 */
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const QRCode = require('qrcode');

const DEFAULT_URL = 'https://vivek-kubavat.github.io/pourology/menu.html';
const url = process.argv[2] || DEFAULT_URL;
if (!/^https:\/\//.test(url)) { console.error('Menu URL must start with https://'); process.exit(1); }

const OUT = path.join(__dirname, '..', 'web', 'qr');
const ESPRESSO = '#3b2414', CREAM = '#fff4e0';

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const opts = { errorCorrectionLevel: 'H', margin: 2, color: { dark: ESPRESSO, light: CREAM } };

  // SVG with the logo tile embedded (data URI, so the file works standalone).
  let svg = await QRCode.toString(url, { ...opts, type: 'svg' });
  const size = Number(svg.match(/viewBox="0 0 (\d+) \d+"/)[1]);
  const logo = fs.readFileSync(path.join(__dirname, '..', 'web', 'icons', 'logo-tile.png')).toString('base64');
  const box = size * 0.22, pad = size * 0.025, x = (size - box) / 2;
  const overlay = `<rect x="${x - pad}" y="${x - pad}" width="${box + 2 * pad}" height="${box + 2 * pad}" rx="${pad * 1.5}" fill="${CREAM}"/>` +
    `<image href="data:image/png;base64,${logo}" x="${x}" y="${x}" width="${box}" height="${box}"/>`;
  svg = svg.replace('</svg>', `${overlay}</svg>`)
    .replace('<svg ', '<svg role="img" aria-label="Scan to open the Pourology menu" ');
  fs.writeFileSync(path.join(OUT, 'menu-qr.svg'), svg);

  await QRCode.toFile(path.join(OUT, 'menu-qr.png'), url, { ...opts, width: 1200 });
  fs.writeFileSync(path.join(OUT, 'menu-url.txt'), url + '\n');
  console.log('QR →', url);

  renderBrandedPngs();
}

const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .find((p) => fs.existsSync(p));

function screenshot(pageUrl, outFile, width, height, scale) {
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    `--force-device-scale-factor=${scale}`, `--window-size=${width},${height}`, '--virtual-time-budget=8000',
    `--screenshot=${outFile}`, pageUrl], { stdio: 'ignore' });
  console.log('wrote', path.relative(process.cwd(), outFile));
}

/** PNGs that look exactly like the page: QR + logo, and the full A6 card (105×148 mm, ~290 dpi). */
function renderBrandedPngs() {
  if (!CHROME) { console.warn('Google Chrome not found: skipped menu-qr-logo.png and menu-card.png'); return; }
  const web = path.join(__dirname, '..', 'web');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pourology-qr-'));
  const wrapper = path.join(tmp, 'qr.html');
  fs.writeFileSync(wrapper, `<!doctype html><html><body style="margin:0;background:${CREAM}">` +
    `<img src="file://${path.join(OUT, 'menu-qr.svg')}" style="display:block;width:100vw;height:100vh"></body></html>`);
  screenshot(`file://${wrapper}`, path.join(OUT, 'menu-qr-logo.png'), 800, 800, 1.5);
  // Headless Chrome won't go below ~500px wide, so the card is rendered at 2× (794×1122) then ×1.5.
  screenshot(`file://${path.join(web, 'qr.html')}#export`, path.join(OUT, 'menu-card.png'), 794, 1122, 1.5);
  fs.rmSync(tmp, { recursive: true, force: true });
}

main().catch((e) => { console.error(e); process.exit(1); });

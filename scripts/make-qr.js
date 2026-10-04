/**
 * Generate the customer-menu QR code (scan → public menu page).
 *   npm run qr                          # uses the default GitHub Pages URL below
 *   npm run qr -- https://example.com/menu.html
 * Outputs web/qr/menu-qr.svg (with the Po tile in the centre) and web/qr/menu-qr.png (plain, 1200px, for print).
 * Error correction "H" keeps the code scannable with the logo covering the centre.
 */
const fs = require('node:fs');
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
}

main().catch((e) => { console.error(e); process.exit(1); });

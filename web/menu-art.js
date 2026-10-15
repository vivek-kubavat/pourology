// Artwork for the customer menu, drawn in code as inline SVG (no image files).
// Colours are fixed: the menu is always a cream "printed" sheet, in light and dark mode.
// The #wob (hand-drawn wobble) and #wash (watercolour blot) filters live in menu.html.
const INK = '#2b1a10';
const SKETCH = '#a8977e';
const TEAL = '#1d6b68';

// Blueprint crosshair, used as a faint measuring mark around the equipment.
const cross = (x, y, r = 7) => `<path d="M${x - r} ${y}H${x + r}M${x} ${y - r}V${y + r}" stroke="${SKETCH}" stroke-width=".8"/><circle cx="${x}" cy="${y}" r="2" fill="none" stroke="${SKETCH}" stroke-width=".8"/>`;
const hand = (x, y, text, rot = -8, size = 17) => `<text x="${x}" y="${y}" transform="rotate(${rot} ${x} ${y})" font-size="${size}" class="hand">${text}</text>`;
// Coffee-ground blot the equipment stands on.
const blot = (y, w = 118) => `<g filter="url(#wash)"><ellipse cx="110" cy="${y}" rx="${w}" ry="9" fill="#b08650" opacity=".38"/><ellipse cx="${110 - w * 0.5}" cy="${y + 3}" rx="${w * 0.4}" ry="6" fill="#8a5a2e" opacity=".3"/></g>
  <g fill="#6b4020" opacity=".6"><circle cx="${110 - w + 6}" cy="${y - 4}" r="1.3"/><circle cx="${110 + w - 14}" cy="${y + 5}" r="1.5"/><circle cx="${110 + w - 2}" cy="${y - 2}" r="1"/><circle cx="${110 - w * 0.6}" cy="${y + 9}" r="1.2"/><circle cx="${110 + w * 0.4}" cy="${y + 10}" r="1"/></g>`;

const V60 = `<svg viewBox="-50 0 280 340" role="img" aria-label="V60 pour-over dripper on a glass server">
  <defs>
    <linearGradient id="v-glass" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".3" stop-color="#fff" stop-opacity=".06"/><stop offset=".8" stop-color="#bba98a" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity=".35"/></linearGradient>
    <linearGradient id="v-coffee" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4318"/><stop offset=".25" stop-color="#4a2610"/><stop offset="1" stop-color="#1c0d06"/></linearGradient>
    <linearGradient id="v-paper" x1="0" x2="1"><stop offset="0" stop-color="#e9dfc8"/><stop offset=".3" stop-color="#fffdf6"/><stop offset=".7" stop-color="#f6efdf"/><stop offset="1" stop-color="#dccfb4"/></linearGradient>
    <linearGradient id="v-black" x1="0" x2="1"><stop offset="0" stop-color="#0f0c0a"/><stop offset=".35" stop-color="#4a433d"/><stop offset=".6" stop-color="#1c1714"/><stop offset="1" stop-color="#0f0c0a"/></linearGradient>
  </defs>
  <path d="M-8 64H232M-8 176H232" stroke="${SKETCH}" stroke-width=".7" stroke-dasharray="3 4"/>
  ${cross(2, 64)}${cross(222, 110)}${cross(2, 176)}${cross(226, 176)}${cross(-12, 30, 5)}
  <path d="M-24 92V214" stroke="${TEAL}" stroke-width="1" stroke-dasharray="4 4"/><path d="M-28 208l4 9 4-9z" fill="${TEAL}"/>
  ${hand(-46, 82, 'V60', -4, 20)}${hand(-48, 240, '1:16', -4, 16)}${hand(-48, 258, 'RATIO', -4, 16)}
  ${blot(312)}
  <g filter="url(#wob)">
    <!-- paper filter -->
    <path d="M30 66 44 24q66-12 132 0l14 42z" fill="url(#v-paper)" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M62 22 56 66M84 19l-4 47M110 18v48M136 19l4 47M158 22l6 44" stroke="${SKETCH}" stroke-width=".9"/>
    <!-- coffee bed -->
    <path d="M40 66h140l-46 78H86z" fill="url(#v-coffee)"/>
    <path d="M42 66q68-30 136 0q-68 14-136 0z" fill="#2a1409"/>
    <path d="M58 62q52-20 104 0q-52 8-104 0z" fill="#5a3216"/><path d="M80 56q30-9 60 0q-30 4-60 0z" fill="#8a5428" opacity=".8"/>
    <g fill="#c9965c" opacity=".9"><circle cx="64" cy="62" r="1.6"/><circle cx="84" cy="58" r="1.3"/><circle cx="101" cy="55" r="1.7"/><circle cx="121" cy="54" r="1.4"/><circle cx="140" cy="57" r="1.5"/><circle cx="156" cy="62" r="1.2"/><circle cx="112" cy="60" r="1.1"/><circle cx="92" cy="63" r="1"/><circle cx="131" cy="62" r="1.2"/><circle cx="75" cy="66" r="1"/><circle cx="148" cy="66" r="1"/></g>
    <g fill="#120804" opacity=".7"><circle cx="70" cy="64" r="1.2"/><circle cx="96" cy="60" r="1.3"/><circle cx="126" cy="58" r="1.2"/><circle cx="150" cy="60" r="1.1"/><circle cx="110" cy="64" r="1.4"/></g>
    <!-- glass cone -->
    <path d="M24 64h172l-60 90H84z" fill="url(#v-glass)" stroke="#1a100a" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M46 68q16 46 46 84M76 68q8 46 24 84M144 68q-8 46-24 84M174 68q-16 46-46 84" fill="none" stroke="${INK}" stroke-opacity=".35" stroke-width="1"/>
    <path d="M40 72q12 34 34 64" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".85"/>
    <path d="M24 64a86 7 0 0 0 172 0" fill="none" stroke="${INK}" stroke-width="1.5"/>
    <path d="M58 150h104l6 14H52z" fill="url(#v-black)" stroke="#0f0c0a" stroke-width="1"/>
    <path d="M162 152c22 0 28 8 26 18" fill="none" stroke="#17120f" stroke-width="7" stroke-linecap="round"/>
    <!-- server -->
    <path d="M152 176h38q16 0 16 16v50q0 13-13 16l-15 3" fill="none" stroke="#17120f" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M160 173h28" stroke="#6b625a" stroke-width="2" stroke-linecap="round"/>
    <path d="M110 186v58" stroke="#3a1c0a" stroke-width="2.6"/>
    <path d="M27 244c0 20 4 40 13 54q70 16 140 0c9-14 13-34 13-54q-83 12-166 0z" fill="url(#v-coffee)"/>
    <path d="M27 244q83 12 166 0" fill="none" stroke="#c08a50" stroke-width="2.2"/><path d="M60 252q50 6 100 0" fill="none" stroke="#8a5428" stroke-width="1.2" opacity=".7"/>
    <path d="M72 186C34 204 22 262 40 298q70 16 140 0c18-36 6-94-32-112z" fill="url(#v-glass)" stroke="#1a100a" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M52 216c-9 16-11 34-8 52" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".9"/>
    <path d="M166 214c6 12 8 26 7 40" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>
    <rect x="64" y="166" width="92" height="21" rx="5" fill="url(#v-black)"/>
  </g>
</svg>`;

// Octagonal body seen from the side: five visible facets between a top and a bottom edge.
const FACET = [0, 0.13, 0.37, 0.63, 0.87, 1];
const SHADE = ['#4a4743', '#8a867f', '#dedbd4', '#a8a49c', '#5e5a54'];
function facets(y1, l1, r1, y2, l2, r2) {
  const at = (l, r, f) => (l + (r - l) * f).toFixed(1);
  return SHADE.map((c, k) => `<path d="M${at(l1, r1, FACET[k])} ${y1}H${at(l1, r1, FACET[k + 1])}L${at(l2, r2, FACET[k + 1])} ${y2}H${at(l2, r2, FACET[k])}z" fill="${c}"/>`).join('');
}

const MOKA = `<svg viewBox="-46 6 264 312" role="img" aria-label="Stovetop moka pot">
  <defs><linearGradient id="m-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#2b1a10" stop-opacity=".28"/></linearGradient></defs>
  <path d="M-10 52H232M-10 157H232" stroke="${SKETCH}" stroke-width=".7" stroke-dasharray="3 4"/>
  ${cross(-16, 52)}${cross(214, 30)}${cross(-16, 157)}${cross(30, 20, 5)}${cross(206, 110, 5)}
  ${hand(-40, 30, 'MOKA', -10, 19)}
  ${hand(-48, 196, 'Pressure', -8, 15)}${hand(-46, 214, 'Heat', -8, 15)}${hand(-46, 232, 'Extraction', -8, 15)}${hand(-46, 250, 'Bold Flavour', -8, 15)}
  <!-- molecule sketch -->
  <g fill="none" stroke="${SKETCH}" stroke-width="1"><path d="M204 196l14 8v16l-14 8-14-8v-16zM204 196v-14M218 220l10 6M190 220l-10 6M204 182l-8-8M204 182l8-8M207 201l8 5M207 223l8-5"/></g>
  <g fill="${SKETCH}"><circle cx="204" cy="182" r="2.4"/><circle cx="228" cy="226" r="2.4"/><circle cx="180" cy="226" r="2.4"/></g>
  <g filter="url(#wob)">
    <!-- handle -->
    <path d="M58 62 18 56c-9-1-13 4-12 12l11 70c1 9 8 12 15 9l11-5-11-62 30 5z" fill="#17120f" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>
    <path d="M14 66l9 62" stroke="#6b625a" stroke-width="2.5" stroke-linecap="round"/>
    <!-- spout, knob, lid -->
    <path d="M164 52l18-5-12 20z" fill="#aeaaa3" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>
    <path d="M99 30l4-18h14l4 18z" fill="#17120f"/><path d="M104 14l-3 14" stroke="#6b625a" stroke-width="1.5"/>
    <path d="M54 52l56-24 56 24z" fill="#b9b5ad" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M110 28 68.6 52M110 28 95.4 52M110 28l14.6 24M110 28l41.4 24" stroke="${INK}" stroke-opacity=".45" stroke-width=".9"/>
    <path d="M54 52l56-24 14.6 24z" fill="#fff" opacity=".25"/>
    <!-- top chamber, waist, boiler -->
    <g stroke="#1a100a" stroke-width="1.1" stroke-linejoin="round" filter="url(#grain)">${facets(52, 54, 166, 150, 72, 148)}
      <path d="M70 150h80l2 14H68z" fill="#5f5b55"/>${facets(164, 70, 150, 290, 46, 174)}</g>
    <path d="M54 52h112l-18 98H72z" fill="url(#m-sheen)"/><path d="M70 164h80l24 126H46z" fill="url(#m-sheen)"/>
    <path d="M98 62l2 78M96 176l-6 104" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".75"/>
    <circle cx="150" cy="220" r="5.5" fill="#c9a45a" stroke="${INK}" stroke-width="1"/><circle cx="150" cy="220" r="1.8" fill="${INK}"/>
  </g>
</svg>`;

const FILTER = `<svg viewBox="-50 0 280 250" role="img" aria-label="South Indian filter coffee in a brass tumbler and dabara">
  <defs>
    <linearGradient id="f-brass" x1="0" x2="1"><stop offset="0" stop-color="#5e3f17"/><stop offset=".2" stop-color="#e9cf8c"/><stop offset=".38" stop-color="#b48a42"/><stop offset=".7" stop-color="#8a6326"/><stop offset=".88" stop-color="#c9a65e"/><stop offset="1" stop-color="#4f3412"/></linearGradient>
    <linearGradient id="f-brass2" x1="0" x2="1"><stop offset="0" stop-color="#4f3412"/><stop offset=".25" stop-color="#d9b971"/><stop offset=".5" stop-color="#9c7432"/><stop offset=".8" stop-color="#c9a65e"/><stop offset="1" stop-color="#5e3f17"/></linearGradient>
    <linearGradient id="f-pour" x1="0" x2="1"><stop offset="0" stop-color="#6e3d17"/><stop offset=".45" stop-color="#c58a4c"/><stop offset="1" stop-color="#6e3d17"/></linearGradient>
  </defs>
  <path d="M40 70H232M-10 160H40" stroke="${SKETCH}" stroke-width=".7" stroke-dasharray="3 4"/>${cross(216, 100)}
  ${hand(-46, 52, 'FILTER', -12, 18)}${hand(-42, 72, 'COFFEE', -12, 18)}
  ${hand(-48, 224, 'South India', -8, 15)}${hand(-36, 242, 'Classic', -8, 15)}
  <!-- India outline sketch -->
  <g fill="none" stroke="${SKETCH}" stroke-width="1" stroke-linejoin="round"><path d="M-22 96l8 6-2 8 9 4 10 2 10-4 6 4-8 6h-6l-2 9-8 8-6 12-6 15-4-11-4-14-6-10-9-4 6-6-4-6 9-4 2-8z"/><path d="M-12 172l3 5"/></g>
  <circle cx="-10" cy="156" r="2" fill="${TEAL}"/>
  ${blot(226, 96)}
  <g class="stream"><path d="M110-150V70" stroke="url(#f-pour)" stroke-width="11"/><path d="M107-150V66" stroke="#f3dbb2" stroke-width="2" opacity=".85"/><ellipse cx="110" cy="70" rx="12" ry="4" fill="#e9c999"/></g>
  <g filter="url(#wob)">
    <ellipse cx="110" cy="162" rx="72" ry="12" fill="#a9803a" stroke="${INK}" stroke-width="1.2"/>
    <!-- tumbler -->
    <path d="M68 70h84l-11 104H79z" fill="url(#f-brass)" filter="url(#grain)" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M70 84q40 8 80 0" fill="none" stroke="${INK}" stroke-opacity=".25" stroke-width="1"/>
    <ellipse cx="110" cy="70" rx="48" ry="10" fill="#f1dfa4" stroke="${INK}" stroke-width="1.2"/>
    <ellipse cx="110" cy="71" rx="41" ry="7.5" fill="#c08f58"/><ellipse cx="110" cy="70" rx="30" ry="4.5" fill="#dcb98a"/>
    <g fill="#f3e2c2" stroke="#b9824a" stroke-width=".4"><circle cx="90" cy="70" r="3.4"/><circle cx="101" cy="74" r="2.4"/><circle cx="121" cy="68" r="3.8"/><circle cx="131" cy="73" r="2.6"/><circle cx="112" cy="66" r="2"/><circle cx="82" cy="73" r="1.8"/><circle cx="140" cy="70" r="1.8"/></g>
    <!-- dabara -->
    <path d="M38 162a72 12 0 0 0 144 0l-14 56q-58 12-116 0z" fill="url(#f-brass2)" filter="url(#grain)" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M46 180q64 12 128 0" fill="none" stroke="${INK}" stroke-opacity=".28" stroke-width="1"/>
    <path d="M62 178l6 34" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".45"/>
  </g>
</svg>`;

export const ART = { 'pour-over': V60, 'moka': MOKA, 'filter coffee': FILTER };

// ---------- add-on icons ----------
const choc = (a, b, c) => `<g stroke="${INK}" stroke-width=".9" stroke-linejoin="round">
  <path d="M8 24l12-6 12 6-12 6z" fill="${a}"/><path d="M8 24v9l12 6v-9z" fill="${b}"/><path d="M32 24v9l-12 6v-9z" fill="${c}"/>
  <path d="M18 13l11-5.5 11 5.5-11 5.500z" fill="${a}"/><path d="M18 13v8l11 5.500v-8z" fill="${b}"/><path d="M40 13v8l-11 5.500v-8z" fill="${c}"/>
  <path d="M27 32l9-4.5 6 3-9 4.500z" fill="${a}"/><path d="M27 32v5l6 3v-5z" fill="${b}"/><path d="M42 30.500v5l-9 4.500v-5z" fill="${c}"/></g>`;
const ADDON = {
  vanilla: `<path d="M6 38C16 31 30 26 44 25M9 42c10-6 22-9 34-10" fill="none" stroke="#2e1a0e" stroke-width="2.4" stroke-linecap="round"/>
    <g fill="#f8efcf" stroke="${INK}" stroke-width=".9"><ellipse cx="24" cy="12" rx="4.8" ry="8.5"/><ellipse cx="24" cy="12" rx="4.8" ry="8.5" transform="rotate(72 24 21)"/><ellipse cx="24" cy="12" rx="4.8" ry="8.5" transform="rotate(144 24 21)"/><ellipse cx="24" cy="12" rx="4.8" ry="8.5" transform="rotate(216 24 21)"/><ellipse cx="24" cy="12" rx="4.8" ry="8.5" transform="rotate(288 24 21)"/></g>
    <circle cx="24" cy="21" r="3.4" fill="#e0a62c" stroke="${INK}" stroke-width=".8"/>`,
  dark: choc('#6b3d20', '#33190b', '#4f2c16'),
  white: choc('#fdf6e1', '#dfcda1', '#efe1bd'),
  honey: `<path d="M41 5 23 23" stroke="#8a5a2b" stroke-width="3.2" stroke-linecap="round"/>
    <ellipse cx="18" cy="28" rx="9.5" ry="11" transform="rotate(42 18 28)" fill="#e9a52a" stroke="${INK}" stroke-width=".9"/>
    <path d="M10 25l11 11M12 20l13 13M16 18l11 11" stroke="${INK}" stroke-opacity=".5" stroke-width=".9"/>
    <path d="M12 21c2-2 5-3 7-2" fill="none" stroke="#fff3c4" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M13 37c0 4-2 5-2 7a2.6 2.6 0 0 0 5.2 0c0-2-1.6-3-1.6-7z" fill="#e9a52a" stroke="${INK}" stroke-width=".8"/>`,
  other: `<path d="M24 8c8 10 12 16 12 22a12 12 0 0 1-24 0c0-6 4-12 12-22z" fill="#c08f58" stroke="${INK}" stroke-width="1"/>`,
};
const ADDON_KEYS = ['vanilla', 'dark', 'white', 'honey', 'other'];
function addonKey(name) {
  const n = String(name).toLowerCase();
  return n.includes('vanilla') ? 'vanilla' : n.includes('white') ? 'white' : n.includes('choc') ? 'dark' : n.includes('honey') ? 'honey' : 'other';
}
/** Position of an add-on on the printed menu (vanilla, dark, white, honey), used to keep that order. */
export const addonRank = (name) => ADDON_KEYS.indexOf(addonKey(name));
export const addonIcon = (name) => `<svg viewBox="0 0 48 48" aria-hidden="true">${ADDON[addonKey(name)]}</svg>`;

// ---------- footer line icons ----------
const line = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const LINE = {
  phone: line('<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M10.5 18.500h3"/>'),
  wa: line('<path d="M3.5 20.500l1.3-4.600A8.5 8.5 0 1 1 8.2 19.300z"/><path d="M9 8.300c-.5 2.6 3.2 6.4 6 6.200l1-1.3-1.8-1.2-1 .7c-.9-.4-1.9-1.4-2.3-2.300l.7-1L10.4 7.600z"/>'),
  scooter: line('<circle cx="5.5" cy="17" r="2.5"/><circle cx="18.5" cy="17" r="2.5"/><path d="M8 17h8l-2-9h-2.500M14.7 11H19l1.5 3.500M3 13.500h6.500l1 3.500M4 10.500h5v3"/><circle cx="16.5" cy="5" r="1.5"/>'),
};

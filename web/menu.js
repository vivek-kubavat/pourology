// Public page: calls only the unauthenticated getMenu action, which returns names, prices and
// descriptions. Nothing financial.
import { call } from './api.js';
import { esc } from './ui.js';

// Look of each section, from the printed menu. Categories not listed here get a plain card.
const STYLE = {
  'Pour-over': { cls: 'teal', sub: 'Brewed slow, one cup at a time', foot: 'Brewed to order' },
  'Moka': { cls: 'peach', sub: 'Stovetop, strong and sweet', foot: 'Made on the stove' },
};
const DOTS = ['var(--teal)', 'var(--peach)', 'var(--gold)', 'var(--espresso)'];
const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');

const el = document.getElementById('menu');
try {
  const items = await call('getMenu', {}, { auth: false });
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

  el.innerHTML = cards || addBox ? `<div class="cats">${cards}</div>${addBox}` : '<p class="muted">Menu coming soon.</p>';
} catch (e) {
  el.innerHTML = '<p class="muted">Menu unavailable right now. Please ask at the stall.</p>';
}
  

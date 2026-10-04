# Pourology

Pourology Coffee Lab (Ahmedabad) app for partners Vivek, Akash and Ishan. It covers quick sales, stall open/close, purchases, inventory and expenses, plus **partner ownership and profit sharing** (spec §70–90).

**Cost: ₹0.** It needs no server and no paid plans:

| Part | Runs on |
|---|---|
| App (installable PWA) + public menu | GitHub Pages (`web/`) |
| API, auth checks, all calculations | Google Apps Script web app (`apps-script/`) |
| Database | One private Google Sheet |
| Sign-in | Google Sign-In (Gmail accounts) |

## How profit sharing works

- **Distributable profit = Revenue − COGS − Other expenses.** Only expense categories the partners mark as distributable count (Settings → Expense rules). Unrecorded expenses are never assumed.
- **COGS** comes from each sale's recipe cost, snapshotted at the moment of sale. Stock purchases are *not* subtracted directly; they reach profit through COGS when coffee is sold, so nothing is counted twice.
- **Partner share = distributable profit × the ownership % in effect on each day.** Ownership history uses effective dates and is never overwritten, so a change on 1 Jan only affects profit from 1 Jan onwards.
- **Earned, paid and remaining** are separate. Withdrawals are recorded and audited, and remaining = earned − paid. The report applies withdrawals to the oldest period first to give each period a Pending / Partially paid / Paid status.
- **Nothing is typed in or stored as a total.** Every figure is recalculated from `SALES`, `EXPENSES`, `PARTNER_OWNERSHIP_HISTORY` and `PARTNER_WITHDRAWALS`. "Close period" writes a `PARTNER_DISTRIBUTIONS` snapshot for the record only.
- Every share shows its calculation, e.g. `₹80,000.00 × 20% = ₹16,000.00`.
- All figures are labelled **Estimated / Internal Profit Share**. This app is not accounting, GST or tax software.

## Roles (enforced in Apps Script, not just hidden in the app)

| Role | Can |
|---|---|
| `ADMIN` (Vivek) | Everything: ownership changes, expense rules, closing periods, menu/recipes, users, voids |
| `PARTNER` (Akash, Ishan) | All financial views, record their **own** withdrawals, quick sale/stall, purchases, expenses, inventory, audit log |
| `STAFF` | Quick sale, stall open/close, and today's sales list **without costs or revenue totals** |

The public `menu.html` calls one unauthenticated action, which returns item names and prices only.

## Local development

```bash
npm test        # finance unit tests + full backend tests on mock Sheets
npm run dev     # http://localhost:5173 — real backend code, demo data, "sign in as…" picker
```

## Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the step-by-step guide (Google Sheet → Apps Script → OAuth → GitHub Pages → menu QR).

## Security

- **Server-side roles:** every API action has an allowed-roles list in `apps-script/Code.js`, so hiding buttons in the app isn't the only protection.
- **Sign-in check:** Google ID tokens are pre-checked locally (shape, audience, expiry), then verified by Google. Failed tokens are cached so junk requests can't use up the quota.
- **Public endpoint:** the only unauthenticated action is `getMenu` (names, prices, descriptions). It's served from cache.
- **Formula injection:** user text is stored as plain text in Sheets (`'` prefix), and CSV exports are escaped the same way.
- **Browser:** pages have a strict Content-Security-Policy and a frame guard. Chart.js is self-hosted, and every template value is HTML-escaped.
- **Financial integrity:**
  - Partners can only withdraw their own remaining share, and amounts are capped.
  - Purchase prices that move more than 50% need the admin.
  - Closed periods can't receive back-dated entries or voids, and ownership changes can't be back-dated without an audited override.
  - Every write goes to `AUDIT_LOG`; mistakes are voided rather than deleted.
- **No secrets in the repo:** real partner emails go only into the Apps Script editor; seed values are `CHANGE_ME` placeholders.

## Project layout

```
apps-script/
  financeCore.js   pure profit/ownership/withdrawal maths (shared with tests)
  partners.js      P&L, partner earnings, report, withdrawals, ownership, period close
  ops.js           menu, recipes, quick sale, stall, purchases, expenses, inventory, users
  auth.js          Google ID-token verification + roles
  Code.js          API router (role per action), sheets.js data layer, audit.js, setup.js
web/               PWA: index.html (app), menu.html + menu.js (public menu), qr.html (printable QR card), pages/*.js, sw.js
tests/             node:test suites + in-memory Apps Script/Sheets mock
scripts/           dev server, make-icons.py (icons from brand/), make-qr.js (menu QR)
brand/             official logo + menu artwork (source files, not deployed)
```

## Menu & branding

- Colours, fonts (Fraunces + DM Sans) and the "Po" tile come from `brand/`. To change the icon, replace `brand/pourology-icon.jpg` and run `npm run icons`.
- The seed menu is the real Pourology menu (Pour-over, Moka, Additives at ₹30). **Recipe grams and ingredient costs are estimates.** Correct them in Settings → Menu & recipes before relying on profit figures. Recording a purchase also updates an ingredient's cost.
- `menu.html` is the public customer menu. Section subtitles and footers ("Brewed to order", "Made on the stove") are set in its `STYLE` map.

## Limits to know

- Apps Script free quota is roughly 20k URL fetches and 90 minutes of runtime per day, far more than one stall needs. Each call reads the sheets fresh, so expect 1–3 s responses.
- Sections 1–69 of the spec (detailed sales, inventory and stall flows) are only minimally implemented here. Extend `ops.js` when that spec is finalised.

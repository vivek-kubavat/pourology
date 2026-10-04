# Deploying Pourology (₹0)

Total time: about 30 minutes. Do it on a laptop, signed in to Chrome with **the Google account that will own the data** (recommended: Vivek, since he's the admin).

You'll set up 3 free things:

1. **Google Sheet + Apps Script.** This is the private database and API.
2. **Google OAuth Client ID.** This makes the "Sign in with Google" button work.
3. **GitHub Pages.** This hosts the app and the public menu at `https://vivek-kubavat.github.io/pourology/`.

---

## Step 1: Google Sheet and backend (Apps Script)

1. Go to <https://sheets.new>. Rename the sheet **Pourology DB**.
2. Open **Extensions → Apps Script**. Rename the project **Pourology API**.
3. Click **Project Settings** (gear icon) and tick **Show "appsscript.json" manifest file in editor**.
4. Back in the **Editor**, create one script file per file in `apps-script/`, using the same names. Apps Script adds `.gs` automatically:
   `Code`, `auth`, `audit`, `financeCore`, `ops`, `partners`, `setup`, `sheets`
   For each one, paste the full contents of the matching `.js` file. Then replace the contents of `appsscript.json` with the repo's `apps-script/appsscript.json`.
   *(Shortcut for developers: `npm i -g @google/clasp && clasp login`. Copy `apps-script/.clasp.json.example` to `.clasp.json`, add the Script ID, then run `npm run push:script`.)*
5. Open **setup.gs**. Replace the three `CHANGE_ME_…@example.com` emails with the partners' **real Gmail addresses**. Do this **only in the Apps Script editor**: never commit real emails to the public GitHub repo.
6. Pick `setupSheets` in the function dropdown and click **Run**. Approve the permission prompt: Advanced → Go to Pourology API → Allow. The Sheet now has all its tabs, partners (Vivek 20% admin, Akash 20%, Ishan 60%) and the menu.
   - The run refuses to start if any `CHANGE_ME` email is left.

## Step 2: Google sign-in (OAuth Client ID)

1. Go to <https://console.cloud.google.com/> and create a project called **Pourology**.
2. Open **APIs & Services → OAuth consent screen**:
   - User type: **External**. App name: Pourology. Use your email.
   - Under **Audience / Test users**, add all three partners' Gmails plus any staff. Leaving the app in "Testing" is fine and free.
3. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Type: **Web application**
   - Authorised JavaScript origins: `https://vivek-kubavat.github.io` (and `http://localhost:5173` if you also want to test locally)
   - Click **Create** and copy the **Client ID** (it ends in `.apps.googleusercontent.com`).
4. Back in Apps Script, go to **Project Settings → Script properties → Add property**:
   - `GOOGLE_CLIENT_ID` = the Client ID you copied

## Step 3: Deploy the API

1. In Apps Script, click **Deploy → New deployment**. Choose type **Web app**.
2. Set these options:
   - Execute as: **Me**
   - Who has access: **Anyone**. The API still checks every request against Google sign-in and the `USERS` sheet; "Anyone" only lets the app reach it.
3. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).

## Step 4: Connect the app

Edit `web/config.js` and fill in the two values. Both are public identifiers, not secrets.

```js
API_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec',
GOOGLE_CLIENT_ID: 'XXXXXXXX.apps.googleusercontent.com',
```

Commit and push. GitHub Actions runs the tests and publishes the site.

## Step 5: Turn on GitHub Pages (one time)

1. In the repo, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Go to the **Actions** tab, wait for "Test & deploy PWA to GitHub Pages" to show green, and open the URL it prints.

## Step 6: Check it works

- [ ] `https://vivek-kubavat.github.io/pourology/menu.html` shows the menu (no sign-in needed).
- [ ] `https://vivek-kubavat.github.io/pourology/` → Sign in as Vivek → you land on **My Share**, and **Settings** is visible.
- [ ] Sign in as Akash or Ishan → no admin-only buttons appear. Ownership is read-only.
- [ ] Sign in with a Gmail that's **not** in `USERS` → "not authorised".
- [ ] Record a test sale in Quick Sale → it appears in Sales and Partner Earnings.
- [ ] On each phone, open the site in Chrome/Safari and choose **Add to Home Screen**.

## Step 7: Print the menu QR

Open **Settings → Menu QR → Open printable table card** (or `/pourology/qr.html`) and print it at A6. Customers scan it and the menu opens.

- The QR points to `https://vivek-kubavat.github.io/pourology/menu.html`. It never needs reprinting when prices change, because prices come live from the Sheet.
- If the URL changes (e.g. a custom domain), run `npm run qr -- https://your-domain/menu.html`, then commit and push.

---

## Updating later

| Change | What to do |
|---|---|
| Menu items, prices, recipes, costs | In the app: **Settings → Menu & recipes**. No deploy needed. |
| Users / staff | In the app: **Settings → Users**. Also add their Gmail as an OAuth **test user**. |
| Frontend code (`web/`) | Push to `main`; it auto-deploys. |
| Backend code (`apps-script/`) | Paste the changes into Apps Script → **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The URL stays the same. |

## Security checklist (keep it this way)

- Never share the **Pourology DB** Sheet with anyone. The app reaches it only through the API, running as the owner. Partners use the app, not the Sheet.
- Real Gmail addresses live only in the Sheet and the Apps Script editor, never in the GitHub repo.
- No secrets go in the repo. `config.js` holds only public IDs, and `.clasp.json` and credentials are git-ignored.
- To remove someone's access, set their status to `INACTIVE` in **Settings → Users**. This takes effect on their next request.
- Turn on 2-step verification for the Google account that owns the Sheet and for the `vivek-kubavat` GitHub account.
- Back up regularly with File → Download → .xlsx from the Sheet, or turn on Google Drive version history (it's automatic).

## Free limits

Apps Script (free Gmail account) allows about 20,000 URL fetches and 90 minutes of script runtime per day, far above what a stall needs. Expect 1–3 s per screen, because every figure is recalculated live from the Sheet.

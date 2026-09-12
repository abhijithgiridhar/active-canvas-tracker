# Active Canvas — Money Tracker (Firebase edition)

A working prototype: girls log income/expenses/savings from any browser (phone or laptop), data is stored centrally in Firestore, and the org sees a live dashboard — both sides can download an Excel file that mirrors the original audit sheet's categories and totals.

## What's in here
- `index.html` — the girl-facing ledger (login by name + PIN, add entries, see monthly totals, download her own Excel).
- `admin.html` — the org dashboard (password-gated, all girls, month picker, flags inactive girls, download the full Excel).
- `shared.js` — categories (the same 34 line items your current sheet uses), Firestore reads/writes, and the Excel export logic (uses the SheetJS library, loaded from a CDN).
- `styles.css` — the black-and-white visual design.
- `firebase-config.js` — where you paste your Firebase project's keys.
- `firestore.rules` — the access rules for your Firestore database.

## Part 1 — Create the Firebase project (~10 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**. Name it e.g. "active-canvas-tracker". Google Analytics isn't needed — you can decline it.
2. In the left sidebar: **Build → Firestore Database → Create database**. Choose a region close to India (e.g. `asia-south1`), and start in **production mode**.
3. Once created, go to the **Rules** tab of Firestore and replace the contents with everything in `firestore.rules` from this folder. Click **Publish**.
4. Back in the project overview page, click the **`</>`** (web) icon to register a new web app. Name it anything. You don't need Firebase Hosting at this step — skip it if offered.
5. Firebase shows you a `firebaseConfig` object. Copy the whole thing and paste its values into `firebase-config.js` in this folder, replacing the `"PASTE_ME"` placeholders.
6. Add the girls' roster — no manual document creation needed:
   - Open `admin.html`, log in with the admin password.
   - Click **Download template (.xlsx)** — fill in one row per girl: Name, PIN (4-6 digits), Cohort.
   - Click **Upload filled-in roster**, pick that file. It shows a preview and flags anything malformed (missing name, bad PIN) before touching the database.
   - Click **Add N girls to roster** — done. Uploading the same file twice safely skips names already added.

## Part 2 — It's already online with GitHub Pages

Repo: [github.com/abhijithgiridhar/active-canvas-tracker](https://github.com/abhijithgiridhar/active-canvas-tracker)

- Girl-facing link: **https://abhijithgiridhar.github.io/active-canvas-tracker/**
- Org dashboard: **https://abhijithgiridhar.github.io/active-canvas-tracker/admin.html** — keep this one internal to the org team.

**To publish updates:** commit your changes, then `git push`. GitHub Pages rebuilds automatically within a minute or two of every push — no separate deploy step.

Note: GitHub Pages serves the repo publicly (a private repo needs GitHub Pro/Team/Enterprise for Pages). Since `firebase-config.js` only contains a public client-side key — the same one visible in any Firebase web app's page source — this doesn't expose anything beyond what `firestore.rules` already governs.

## Part 3 — Before you hand it to the girls

- Open `admin.html` in a text editor and change `ADMIN_PASSWORD` (currently `CHANGE_ME_2026`) to something only the org team knows.
- Test the login flow yourself with one real name + PIN from the roster first.
- Share the girl-facing link over WhatsApp/email — no app install, no account creation, just the link + her name + her PIN.

## How the Excel exports work
Both "Download my Excel" (girl) and "Download full Excel" (org) generate a real `.xlsx` file in the browser (via the SheetJS library) — nothing is emailed or uploaded anywhere. The file mirrors your current sheet's structure:
- All 34 original line items (guardian contribution, WWP support types, rent, WiFi, tuition, etc.), grouped into Income / Fixed Expenses / Variable Expenses / Savings, one column per month.
- The same roll-up rows: (A) Total Income, (B) Total Fixed, (C) Total Variable, (D) Saved, (E) Total Expenses, (F) Balance, (G) Balance + Saving.
- A raw "All Entries" sheet (every logged transaction, one row each) so anything can be re-checked or re-sliced in Excel.
- The org's export additionally includes one sheet per girl with her full breakdown, plus a cross-girl "Summary" sheet.

## Security notes — read before wider rollout
- There's no real login system: a girl is identified by picking her name and typing a PIN that's stored in plain text in Firestore and checked in the browser. This is enough to keep entries attributed to the right person in a small, trusted pilot — it is **not** protection against someone deliberately trying to see or edit another girl's data.
- The current `firestore.rules` allow anyone with the app's Firebase config (visible in the page source, unavoidable for a project like this) to read and write both the `entries` and `girls` collections — the latter is what lets the admin dashboard's roster upload work without a backend. That's necessary for the app to work without a real sign-in system, but means treat this as a **pilot with a known, trusted group**, not a public-facing product.
- Before scaling beyond a pilot, the next step up is Firebase Authentication (e.g. phone-number sign-in) with rules that check `request.auth.uid` — ask a developer to add this when you're ready; the data model here doesn't need to change, only the rules and login screen would.
- Amounts and names are the only personal data stored — no addresses, IDs, or documents. Still, limit who has the admin password and the Firebase console access.

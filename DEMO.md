# Running the demo

**Double-click `START-DEMO.bat`.** A black window opens and stays open; the
browser opens at the site. That is the whole procedure.

Close the black window to stop the server.

## It does not need the internet

Fonts are bundled in `design-system/assets/fonts/`. Nothing is fetched from
Google, Cloudflare or anywhere else. The site works on a laptop in flight mode.

Test it before you travel: turn wifi off, run `START-DEMO.bat`, and check the
headings are still IBM Plex rather than Times New Roman.

## Before you present

Open **<http://localhost:4173/website/demo-setup.html>** and press
**Load demo data**. Without it every centre reads a full allocation with no
history, which demonstrates nothing.

The data lives in the browser, so load it in **the same browser and profile**
you will present from. If you demo in Chrome but seeded in Edge, you get an
empty service.

## A route through it

1. **Instrument sets → Jahra.** Deficit flags down the Held column. Held is
   derived from the ledger, never stored.
2. **Switch to Farwaniya.** Pending chips show what is already asked for and
   not yet confirmed — visible, but not counted into Held.
3. **Press − and + on any row, then Submit.** Held does not move. That is the
   point: a clinic can ask, only an admin can make it true.
4. **Requests → the Farwaniya request.** Confirm part of it — accept the
   returns, issue fewer replacements than asked.
5. **Back to the instrument set.** Held has changed. **Item log** shows the
   audit trail, with who confirmed it and against which request.

Steps 3–5 are the argument. Everything else is scenery.

## If something goes wrong

**Browser opens but the page is blank or unstyled** — the server did not
start. Look at the black window for the error.

**"Python was not found"** — install from python.org and tick *Add python.exe
to PATH*. Nothing else is needed.

**Port 4173 already in use** — something else is on it. Edit the last line of
`START-DEMO.bat` to another number, say 4180, and use that in the browser.

**The service looks empty** — the demo data was seeded in a different browser
or profile. Re-seed from `demo-setup.html`.

**You want a clean slate mid-demo** — `demo-setup.html` → Clear everything.

## What you are showing

A working prototype against the real periodontic instrument set: 78
instruments across 5 sets, 9 dental centres. Entries are stored in the
browser, not a database, so it is not yet a system of record — that is the
next step, and `server/README.md` sets it up.

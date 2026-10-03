# Server — Cloudflare Worker + D1

> ## OUT OF DATE — do not follow these steps yet
>
> This Worker was written before the service had **centres** and **requests**.
> Its schema has tables for codes, standards and the ledger only. The app now
> keys everything by centre and routes every movement through a request that
> an admin confirms.
>
> Following the setup below will deploy an API the site cannot talk to.
> `backend: 'cloudflare'` in `website/config.js` will fail until this folder is
> rewritten to match `website/store.js`.
>
> What needs doing: a `requests` table with per-line accepted quantities, a
> `centreId` column on `ledger`, an `allocations` table, and endpoints for
> `loadAll` / `submitRequest` / `decideRequest` / `saveCodes` / `setAllocation`.
>
> Everything below is kept because the deployment mechanics, the free-tier
> figures and the data-residency note are all still correct.

The database lives in Cloudflare from the start, so there is nothing to
migrate later. The **website stays on your machine**; only the data is remote.

```
your machine                          Cloudflare (free tier)
localhost:4173  ──── fetch ────▶  Worker (this folder)  ──▶  D1 (SQLite)
```

You are deploying the **API**, not the site. That is the only way in: D1
cannot be reached from a browser, only from a Worker.

---

## Before you start

**Do not put real clinic data in until someone at the ministry has confirmed
that MOH procurement data may sit on servers outside Kuwait.** Cloudflare has
no Kuwait region. Use test centres and made-up quantities for the pilot. The
schema and the code are identical either way, so this costs you nothing now
and avoids an awkward conversation later.

---

## One-time setup

You need a free Cloudflare account and Node installed.

```bash
cd server
npx wrangler login
```

**1. Create the database**

```bash
npx wrangler d1 create moh-instruments
```

It prints a `database_id`. Paste it into `wrangler.toml`, replacing
`PASTE_DATABASE_ID_HERE`.

**2. Create the tables**

```bash
npx wrangler d1 execute moh-instruments --file=schema.sql --remote
```

The `--remote` matters. Without it you create the tables in a local
simulation and the deployed Worker sees an empty database.

**3. Set the API token**

Invent a long random string — this is the shared password between your page
and the API.

```bash
npx wrangler secret put API_TOKEN
```

**4. Deploy**

```bash
npx wrangler deploy
```

It prints a URL like `https://moh-instruments.<you>.workers.dev`.

**5. Point the site at it**

In `website/config.js`:

```js
window.MOH_CONFIG = {
  backend: 'cloudflare',
  apiBase: 'https://moh-instruments.<you>.workers.dev',
  apiToken: '<the same string you set in step 3>'
};
```

Reload the register. The header will say it is reading from the shared
database rather than this browser.

---

## Check it works

```bash
curl https://moh-instruments.<you>.workers.dev/api/health
```

`/api/health` is the only endpoint that needs no token, so it can tell you
whether the token is the problem:

```json
{ "ok": true, "schema": "ready", "tokenConfigured": true }
```

- `"schema": "missing"` — step 2 did not run, or ran without `--remote`.
- `"tokenConfigured": false` — step 3 did not run. Every other endpoint will
  return 401 until it does.

---

## About the token

**The token in `config.js` is not a secret.** Anyone who can open that file
in your browser can read it. It is a gate against casual access and crawlers,
not authentication, and it does not tell you who recorded what.

That is acceptable while the page runs only on your machine. It stops being
acceptable the moment the site is hosted or the token is shared around.

When you get there, the fix is **Cloudflare Access** — free for up to 50
users, sits in front of the Worker, and gives you real sign-in with named
people, so the `recorded_by` column means something. No code change: it is
configuration in the Cloudflare dashboard.

---

## Costs

Everything here is inside Cloudflare's free tier by a wide margin. The whole
dataset is 78 items across however many clinics — kilobytes. Free tier limits
change, so check current figures, but at this scale you would have to try
very hard to leave it:

| | Free tier | You will use |
|---|---|---|
| Worker requests | 100,000 / day | a few hundred |
| D1 storage | 5 GB | well under 1 MB |
| D1 reads | 5 million / day | a few thousand |

---

## The ledger is append-only

There is no `UPDATE` and no `DELETE` on the `ledger` table anywhere in
`src/worker.js`, and none should be added. This is a procurement record: a
correction is a new row, not an edit to an old one.

`codes` and `standards` do get updated in place, but both are mirrors — the
ledger can rebuild either one. They exist so the register loads in one query
instead of replaying every event.

## Backups

D1 is not backed up for you on the free tier. Before this holds anything you
would be upset to lose:

```bash
npx wrangler d1 export moh-instruments --remote --output=backup.sql
```

Worth putting on a calendar reminder until it is automated.

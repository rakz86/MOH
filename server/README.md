# Server — Cloudflare Worker + D1

> **Not yet run on real Cloudflare.** The Worker and schema match
> `website/store.js` and were tested against SQLite standing in for D1, and
> end to end through the pages, but have never been deployed. Expect the
> first deploy to be the real test.

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
- `"schema": "outdated"` — this database was created from the earlier
  per-clinic schema. `CREATE TABLE IF NOT EXISTS` will not reshape it, and the
  old ledger cannot be updated in place, so create a new database (step 1
  with a new name) and point `wrangler.toml` at it.
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

## What the API does

It speaks exactly the interface of `website/store.js` and returns the same
shapes as the browser-storage adapter, so no page knows which one it is using.

| Endpoint | `store.js` call | Writes |
|---|---|---|
| `GET /api/all` | `loadAll()` | nothing |
| `POST /api/requests` | `submitRequest()` | the request and its lines — **no stock moves** |
| `POST /api/requests/:id/decide` | `decideRequest()` | the decision, what was accepted, and one ledger row per accepted quantity, in one transaction |
| `POST /api/allocation` | `setAllocation()` | the centre's allocation, plus a `standard` ledger row explaining it |

The server checks what the page checks, because anything holding the token
can call it directly. In particular it refuses to accept more than a request
asked for, works out `confirmed` versus `partial` from the figures itself, and
answers `409` if a request has already been decided — so two admins
confirming at once produce one set of movements, not two.

Centres are not stored here. They come from `website/data/centres.json`; the
database only holds allocations that differ from the standard.

## The ledger is append-only

There is no `UPDATE` and no `DELETE` on the `ledger` table anywhere in
`src/worker.js`, and none should be added. This is a procurement record: a
correction is a new row, not an edit to an old one.

`schema.sql` also makes the database refuse it: triggers abort any `UPDATE`
or `DELETE` on `ledger`, `requests`, `request_lines`, `decisions` and
`decision_lines`. A request's status is not a column that gets overwritten —
it is `submitted` until a row exists in `decisions`, and that row is final.

`standards` and `allocations` do get updated in place. They are
current values; every allocation change is also logged to the ledger.

## Backups

D1 is not backed up for you on the free tier. Before this holds anything you
would be upset to lose:

```bash
npx wrangler d1 export moh-instruments --remote --output=backup.sql
```

Worth putting on a calendar reminder until it is automated.

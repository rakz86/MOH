# MOH Kuwait — Medical Requisitions

Two things live in this repository, and the split between them is deliberate.

| | What it is | Contains |
|---|---|---|
| **`design-system/`** | The source of truth. Tokens, components, guidelines, and a browsable reference of every component in light/dark and LTR/RTL. | `foundations/`, `previews/`, `src/`, `guidelines/`, `assets/`, `tools/` |
| **`website/`** | The public service itself — the pages a hospital department or supplier actually uses. | `index.html`, `instruments.html`, `item-log.html`, `catalogue.html`, request pages, `site.css` |
| **`server/`** | The API. A Cloudflare Worker over a D1 database, so the record can be shared between clinics. | `src/worker.js`, `schema.sql`, `wrangler.toml` |

**The dependency runs one way.** The website consumes the design system; the
design system knows nothing about the website. The only crossing point is the
build, which renders the website's pages as two preview cards so the finished
composition can be reviewed beside the components it is made from.

If something in `website/site.css` turns out to be reusable, it gets promoted
into `design-system/foundations/components.css` — that is how chips and
pagination got there. Nothing travels the other way.

## Run it

```bash
python tools/devserver.py 4173 .
```

Then open <http://localhost:4173/> — `index.html` at the root is a local
development index linking every page of the website, every reference in the
design system, and every guidance document. It is not part of the published
service; delete it before deploying, or leave it and deploy `website/` alone.

Direct links, if you prefer:

- Website — <http://localhost:4173/website/>
- Design system — <http://localhost:4173/design-system/previews/>

Run this from the repository root. The server needs to see both folders,
because the website loads its CSS from `../design-system/foundations/` and the
emblem from `/design-system/assets/`.

The bundled server exists because `python -m http.server` gets three things
wrong for this job: it caches (so an edited `tokens.css` looks like a CSS
bug), it is single-threaded (one held connection blocks every other client,
including your browser), and it binds IPv4 only (on Windows `localhost`
resolves to `::1` first, so the browser gets connection-refused). This one
sends `no-store`, threads, binds dual-stack, and sends `charset=utf-8`.

## Where the data lives

`website/config.js` decides, and it is the only file that needs changing:

| `backend` | Means |
|---|---|
| `'local'` | every browser keeps its own private copy. No server, no sharing. **The default.** |
| `'cloudflare'` | one shared D1 database behind a Worker. The site still runs from your machine; only the data is remote. |

The site is deliberately unaware of which is in use. `website/store.js` holds
both implementations behind one interface; `website/ledger.js` derives held
counts and deficits from whatever the store hands back. Nothing else touches
storage.

Setting up the Cloudflare side is `server/README.md` — about five commands.
It has been tested locally but not yet deployed. **Read the data-residency
note in it before real clinic data goes in.**

## Change something

Everything below runs from inside `design-system/`:

```bash
cd design-system
node tools/gen-color.js   # regenerate the colour page from tokens
node tools/build.js       # rebuild the preview cards
node tools/validate.js    # structure, token resolution, colour leaks, theme drift
node tools/contrast.js    # WCAG 2.1 contrast across every shipped pair
```

Both audits must pass before a change is accepted. See
`design-system/guidelines/contributing.md`.

## Read next

- `design-system/README.md` — what the system is and why each decision was made
- `design-system/guidelines/accessibility.md` — the WCAG floor and how it is enforced
- `design-system/guidelines/bilingual-rtl.md` — how Arabic and RTL work here
- `design-system/assets/README.md` — the emblem rules and what is still outstanding

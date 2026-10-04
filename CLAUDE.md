# MOH Kuwait — Medical Requisitions

A prototype service for the Kuwait Ministry of Health, Dental Administration:
periodontic clinics across nine dental centres request replacement instruments,
and an instrument admin confirms what actually moved.

Built to replace the visual and structural language of
[moh.gov.kw](https://www.moh.gov.kw) and [e.gov.kw](https://e.gov.kw), both
SharePoint-era.

**Status: working local prototype.** Data lives in browser storage, not a
database. It is not yet a system of record.

---

## Layout

| | What it is |
|---|---|
| `design-system/` | Source of truth. Tokens, components, guidelines, 8 browsable preview cards. |
| `website/` | The service itself — the pages people use. |
| `server/` | A Cloudflare Worker + D1 API speaking the same model as `store.js`. |
| `tools/` | `devserver.py` (dev server), `bundle-data.py` (data → script). |

**The dependency runs one way.** The website imports from the design system;
the design system knows nothing about the website. Anything in
`website/site.css` that turns out to be reusable gets promoted into
`design-system/foundations/components.css` — that is how chips, pagination and
the dialog got there.

## Run it

```bash
python tools/devserver.py 4173 .
```

Then <http://localhost:4173/> — a local index linking every page.
On Windows, `START-DEMO.bat` does the same with a double-click.

The bundled server exists because `python -m http.server` caches (an edited
`tokens.css` looks like a CSS bug), is single-threaded (one held connection
blocks the browser), and binds IPv4 only (Windows resolves `localhost` to
`::1` first, so Chrome gets connection-refused).

## Change the design system

Everything below runs from inside `design-system/`:

```bash
node tools/gen-color.js   # regenerate the colour page from tokens
node tools/build.js       # rebuild the 8 preview cards
node tools/validate.js    # structure, token resolution, colour leaks, theme
node tools/contrast.js    # WCAG 2.1 across every shipped pair
```

**Both audits must pass before any change is accepted.** `previews/` is
generated — edit `src/` and rebuild.

---

## The domain model

This is the part worth understanding before changing anything.

```
allocation   what a centre is entitled to hold. Per centre, falls back to
             the standard on the instrument set.
held         allocation − confirmed returns + confirmed issues.
             DERIVED, never stored.
deficit      allocation − held, when positive.
pending      quantities in a submitted request nobody has confirmed.
             Shown, deliberately NOT counted into held.
```

**A request is not a movement.** A clinic pressing `+` or `−` creates a
request. Stock moves only when an instrument admin confirms it on
`request-detail.html` — that is the only place the ledger is written.

Held is derived rather than stored on purpose: if it were a stored number, one
missed write would silently desync the count from its own history and nobody
would know which was right.

### Files

| File | Role |
|---|---|
| `website/ledger.js` | Pure derivation. No storage, no network, no DOM. |
| `website/store.js` | Where the record lives. Two adapters behind one interface. |
| `website/config.js` | **The switch**: `backend: 'local'` or `'cloudflare'`. |
| `website/data/*.json` | Instrument sets (78 items, 5 sets) and the 9 centres. Item codes are fixed here: two-letter set prefix + two-digit item number (`DG01`, `SG20`); `bundle-data.py` refuses duplicates. |
| `website/inventory.js` | Read-only stock position per centre. Table and grid views. |
| `website/glyphs.js` | Line-art placeholders, one per instrument type. Not photographs. |
| `website/data/bundle.js` | Generated from the JSON so pages need no `fetch()`. |

Read once, derive in memory, write through. Only load and commit await;
all derivation is synchronous against a snapshot.

---

## Hard rules

These are enforced by the audits or by the model. Breaking one is a bug.

1. **No raw colour literals** outside `foundations/tokens.css` section 1.
   No hex, no `rgb()`, no `hsl()` in components or base. `validate.js` fails
   the build. The one sanctioned exception is the `@media print` block in
   `website/site.css`, because paper has no theme.
2. **Logical properties only** — `margin-inline-start`, never `margin-left`.
   `dir="rtl"` must mirror the whole interface with no component overrides.
3. **Light is the default, unconditionally.** The service does not follow
   `prefers-color-scheme`; reintroducing that media query fails the build.
   Dark exists as an explicit `data-theme="dark"` opt-in.
4. **The ledger is append-only.** No UPDATE, no DELETE. A correction is a new
   entry.
5. **Nothing commits until confirmed.** Typing changes nothing; the Update /
   Submit button is the only thing that writes.
6. **Status never depends on colour alone** — every state carries a shape and
   a word. Print any page in greyscale and it must still be readable.
7. **Compact density is desktop-only.** It drops below the 44px target floor.
8. **The emblem** is the official State of Kuwait emblem. One version, every
   surface. No recolouring, no decorative use. See
   `design-system/assets/README.md`.

Fuller guidance: `design-system/guidelines/` — accessibility, bilingual/RTL,
page patterns, contributing.

---

## Item codes

Every item carries a canonical `code` in `periodontic-sets.json`: a two-letter
set prefix plus its number on the printed form.

    DG  diagnostic      NS  non-surgical    SG  surgical
    EX  extraction      MS  microsurgery    OI  other items    KT  kits

So `EX11` is extraction item 11. Codes are unique across all 78 items,
version-controlled here rather than typed per centre, and a centre cannot
change them: the Code column is read-only. `tools/bundle-data.py` refuses to
bundle a duplicate code, a code that does not carry its item number, or two
sets sharing a prefix.

## Images

`glyphs.js` draws one schematic line-art glyph per instrument type, chosen by
the `kind` field on each item. **These are placeholders, not photographs.**

Real product photography should come from the supplier catalogue, where the
picture is guaranteed to match what ships. Add an `image` field to an item and
the grid prefers it over the glyph. Do not substitute stock photos found on
the web: a wrong-instrument picture on a procurement screen is worse than no
picture, it would break the offline guarantee, and the licensing is not ours
to grant.

## Known gaps

- **Allocations are empty.** Every centre falls back to the standard set (191
  units). The structure is in `website/data/centres.json`; the real per-centre
  figures have not been supplied yet.
- **`server/` has not run on real Cloudflare yet.** It was tested against
  SQLite standing in for D1, and end to end through the pages, but never
  deployed. Demo data (`demo-setup.js`) seeds browser storage only, so a
  Cloudflare-backed demo starts empty.
- **The local adapter is looser than the server.** The server refuses to
  accept more than a request asked for; `store.js`'s local adapter and
  `request-detail.js` do not check this.
- **Browser storage, not a database.** No sharing between machines, no backup.
- **Arabic copy is illustrative** and has not been reviewed by a
  native-speaking content designer. Centre names are standard transliterations
  and should be confirmed against the ministry's own spelling.
- **Data residency is unresolved.** Cloudflare has no Kuwait region. Use test
  data until someone confirms MOH data may sit outside Kuwait.
- Charts, data visualisation and email templates are not covered.

## Demonstrating it

`DEMO.md`. In short: `START-DEMO.bat`, then seed from
`website/demo-setup.html` before presenting. Fonts are self-hosted, so it
works with no internet.

`website/demo-setup.js` is presenter-only and deliberately isolated — no app
code knows it exists.

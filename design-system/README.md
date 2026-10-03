# MOH Kuwait — Medical Requisition Design System

A design system for a public-facing Ministry of Health service through which
hospital departments and accredited suppliers request medical instruments and
materials.

It is a deliberate replacement for the visual and structural language of
[moh.gov.kw](https://www.moh.gov.kw/en/Pages/default.aspx) and
[e.gov.kw](https://e.gov.kw/sites/kgoenglish/Pages/HomePage.aspx), both of
which are SharePoint-era builds.

---

## What this replaces

| Legacy | Here | Why |
|---|---|---|
| Hero carousel above the fold | The task first | Carousels are near-universally ignored |
| Navigation by org chart | Navigation by intent | People arrive with a task, not a knowledge of ministry structure |
| 13px body at `#565656` / `#494848` | 16px minimum at `#161C23` | Legacy greys sit near the contrast floor |
| Open Sans + Cairo bolted together | IBM Plex Sans + IBM Plex Sans Arabic | One team, shared proportions — Arabic stops being an afterthought |
| icomoon + FontAwesome + Glyphicons | One inline SVG set | Three icon fonts is three render-blocking downloads |
| Status by colour alone | Colour + shape + word | A colour-blind user must be able to read a rejection |

## Principles

In priority order. When two decisions conflict, the lower number wins.

1. **Say the thing plainly.** Decoration that delays the answer is a defect.
2. **One task per screen.** Long requisitions are split into finishable steps.
3. **Bilingual by construction.** Arabic is not a translation layer.
4. **Accessibility is the floor.** WCAG 2.1 AA is the minimum to ship.
5. **Everything is traceable.** Reference, state, owner, history — always.

## Structure

```
foundations/
  tokens.css        Single source of truth. Primitives → semantic roles → themes.
  base.css          Reset, document defaults, typography, layout primitives.
  components.css    The component library. All logical properties, RTL-ready.
  behaviours.js     Component behaviour: mobile nav disclosure, responsive collapse.
src/                Preview fragments (authoring source).
previews/           Built standalone preview pages. Do not edit — generated.
assets/             Brand assets. See assets/README.md for what is required.
guidelines/         Accessibility, bilingual/RTL, and contribution rules.
tools/              Build + audit scripts.
```

The website that consumes this system lives one level up, in `../website/`.
The dependency runs one way: it imports from here, and nothing here imports
from it. The two exceptions are the `Homepage` and `Catalogue browse` preview
cards, which are built from the website's own pages so a finished composition
can be reviewed beside the components it is made from.

`../website/site.css` is the composition layer, and it is the proof the system
extends cleanly: it contains no raw hex, no pixel gaps, and no physical
direction properties in any declaration. Anything in it that turns out to be
reusable gets promoted into `foundations/components.css` — that is how chips
and pagination arrived.

## Run locally

From the repository root, not from here:

```bash
python tools/devserver.py 4173 .
```

- Website — <http://localhost:4173/website/>
- Design system — <http://localhost:4173/design-system/previews/>

The server needs to see both folders, because the website loads its CSS from
`../design-system/foundations/` and the emblem from `/design-system/assets/`.

The bundled dev server exists because `python -m http.server` gets three
things wrong for this job: it caches (so an edited `tokens.css` looks like a
CSS bug), it is single-threaded (one held connection blocks every other
client), and it binds IPv4 only (on Windows `localhost` resolves to `::1`
first, so the browser gets connection-refused). This one sends `no-store`,
threads, binds dual-stack, and sends `charset=utf-8`.

## Build

From inside `design-system/`:

```bash
node tools/gen-color.js   # regenerate the colour page from tokens
node tools/build.js       # inline foundations into standalone previews
```

`previews/` is generated output. Edit `src/` and rebuild — never edit a
preview directly.

## Audits — run before any change is accepted

```bash
node tools/validate.js    # brace balance, token resolution, hex leaks, theme drift
node tools/contrast.js    # WCAG 2.1 contrast across every shipped pair
```

`validate.js` enforces five rules:

- every `var()` resolves to a defined token, or supplies a fallback;
- no raw hex appears below the primitive layer;
- no `rgb`/`rgba`/`hsl` literals in the component or base layers;
- the two dark-theme blocks (media query and explicit toggle) stay identical;
- braces balance.

`contrast.js` measures every foreground/background pair the system ships.
All required pairs pass AA. One pair — `--color-accent` on a light surface —
fails deliberately at 3.10:1, and the test asserts that it fails, because the
token is restricted to large text, graphics and dark surfaces.

## Themes and density

| Attribute | Values | Where it goes |
|---|---|---|
| `data-theme` | `light`, `dark` | Root element. **Absent means light** — the service never follows the OS. |
| `data-density` | `comfortable`, `compact` | A layout wrapper, never a component. |
| `dir` | `ltr`, `rtl` | Root element. Mirrors everything. |

**Compact density is desktop-and-pointer only.** It drops below the 44px
target floor and must never be served to a touch device or to the public.

## Typefaces

IBM Plex Sans, IBM Plex Sans Arabic and IBM Plex Mono — all SIL Open Font
License, so they can be self-hosted and redistributed with no per-seat
licensing. Self-host for production; the previews load them from Google Fonts
for convenience only.

## Known gaps

- **The emblem is a raster, not a vector.** `assets/emblem-colour.png`
  (774x875) is in place and wired up, with 224px and 112px variants generated
  for the web. That is ample for the 56px header, but an SVG should replace it
  before any print or large-format use — the dhow rigging will not survive
  scaling up. See `assets/README.md`.
- Arabic copy is illustrative and has not been reviewed by a native-speaking
  content designer.
- Charts and data visualisation are not yet covered.
- Email templates are not yet covered.

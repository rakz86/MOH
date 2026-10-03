# Brand assets

## Required — drop these here

| File | What it is | Used by |
|---|---|---|
| `emblem-colour.png` **or** `emblem-colour.svg` | The official State of Kuwait emblem, full colour, transparent background | Everywhere the emblem appears |
| `emblem-colour-224.png`, `emblem-colour-112.png` | Web-sized rasters generated from the source | Header lockup at 1x and 2x |

**There is one emblem, and it is used on every surface.** No reversed,
mono, or otherwise recoloured variant exists or should be created — the
official mark is the official mark.

Until a file is present the lockup renders a dashed amber box reading
`emblem`, rather than a broken-image icon. That is deliberate: a missing
mark should be obvious in review, not silent.

**SVG is preferred for the source.** The emblem contains fine rigging on the
dhow that turns to mud in a raster when scaled up. The 774px PNG currently in
place is ample for screen, but print or large-format use wants a vector.

## Rules

- **Never** recolour, stretch, crop, rotate, outline or add effects to the emblem.
- **Never** place it on a busy photograph or a low-contrast ground.
- Width always follows from height via `--emblem-ratio` (774 / 875). Never set
  both dimensions independently.
- Clear space: at least 25% of the emblem height on all four sides.
- Minimum size 32px tall. Below that the dhow rigging is illegible — use the
  wordmark alone.
- The emblem is an official state symbol representing the State of Kuwait.
  It may carry the identity of an official government service: the header
  lockup and the browser icon of this service are legitimate, because both
  are statements that the service is official.
- It may **not** be used decoratively — no loading spinners, watermarks,
  background patterns or ornament — and never on anything that is not an
  official government service.

## Heritage gold

The emblem introduces gold to the brand world. It is tokenised as
`--color-heritage` (`#C9922B`).

It is **ceremonial only** — mastheads, seals, certificates, print furniture.
It is not a UI colour, carries no state meaning, and at 3.2:1 on white it
fails AA for body text. Never use it for a button, a status, or small text on
a light surface.

## Browser icons

Generated from `emblem-colour.png` by `tools/make-favicons.py`. The emblem is
trimmed to its own bounding box first, then centred on a square canvas, so the
mark fills as much of a 16px tile as it can.

| File | Size | Used for |
|---|---|---|
| `favicon/favicon.ico` | 16–256, multi-resolution | Browser tabs, Windows pinned sites |
| `favicon/icon-16.png`, `icon-32.png`, `icon-48.png` | as named | Modern browsers |
| `favicon/icon-192.png`, `icon-512.png` | as named | Android home screen, PWA |
| `favicon/apple-touch-icon.png` | 180 | iOS home screen |

The Apple touch icon is flattened onto white on purpose. iOS ignores
transparency on the home screen and composites onto black, which would put
the emblem black outlines on a black ground.

Regenerate after any change to the source emblem:

```bash
python design-system/tools/make-favicons.py
```

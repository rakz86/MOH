# Contributing

Every path and command on this page is relative to `design-system/`. Run them
with that as your working directory. The one exception is the dev server,
which lives at `../tools/devserver.py` and is run from the repository root
because it has to serve the website alongside the system.

## The one rule

**Components never hard-code a value.** No hex codes, no pixel gaps, no
durations. Everything resolves through a token, which is what makes theming,
density and RTL possible at all. `tools/validate.js` enforces this for colour.

## Changing a colour

1. Edit the **primitive** in `foundations/tokens.css` section 1, or add a new
   step to a ramp. Never edit a semantic role to hold a literal.
2. Run `node tools/contrast.js`. If any required pair fails, the change is
   rejected — pick a different value, do not lower the threshold.
3. If the colour appears in the dark theme, update the `[data-theme="dark"]`
   block too. Dark may never define a token that light does not —
   `validate.js` fails the build if it does. Light is unconditional: the
   service does not follow `prefers-color-scheme`, and reintroducing that
   media query fails the build as well.
4. Run `node tools/gen-color.js` to regenerate the colour preview, then
   `node tools/build.js`.

## Adding a component

1. Write it in `foundations/components.css` using **logical properties only**.
   If you type `margin-left`, stop.
2. Give it a real state set: rest, hover, focus-visible, disabled, and any
   error or selected state it needs.
3. Add a fragment in `src/`, register it in `src/manifest.json`, rebuild.
4. Look at it in all four combinations: light/dark × LTR/RTL. Then both
   densities. The preview toolbar does this in four clicks.

## Adding a request state

A new lifecycle state needs, in this order:

1. **A word** that a requester would use.
2. **A shape** distinct from the existing six in greyscale.
3. Only then, a colour.

Never reassign an existing hue. Green means approved and only approved.

## Before opening a pull request

```bash
node tools/validate.js && node tools/contrast.js && node tools/build.js
```

All three must pass. Then confirm by eye:

- [ ] Light and dark
- [ ] LTR and RTL
- [ ] Comfortable and compact
- [ ] Keyboard only — focus visible at every step
- [ ] 200% zoom without horizontal scroll

## Do not edit

`previews/` is generated output. Edit `src/` and rebuild. A change made
directly to a preview will be silently overwritten on the next build.

## Syncing to Claude Design

This project lives in a Claude Design design-system project. Push
incrementally — one component at a time — rather than replacing the project
wholesale, so review history stays meaningful.

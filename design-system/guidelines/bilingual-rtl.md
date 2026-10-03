# Bilingual and RTL

Arabic is not a translation layer applied at the end. It is one of two equal
presentations of the same service, and the system is built so that switching
between them costs one attribute.

## How mirroring works

Every component is written with **logical properties** — `margin-inline-start`
rather than `margin-left`, `border-inline-end` rather than `border-right`,
`text-align: start` rather than `left`, `inset-block-start` rather than `top`.

That means `dir="rtl"` on the root element mirrors the entire interface. **No
component in this system carries an RTL override, and none should be added.**
If a component needs a direction-specific rule, it is written with a physical
property somewhere and that is the bug to fix.

## Typography

`--font-scale-ar` (1.08) and `--line-height-scale-ar` (1.12) correct once,
globally, for two facts about Arabic:

- it is optically smaller than Latin at the same point size;
- its ascenders and descenders need more vertical room.

Never hand-tune an individual component to compensate. If Arabic looks wrong
somewhere, the global correction is wrong and should be adjusted there.

## Never do these

- **Letter-space Arabic.** It breaks the joins between letters and renders
  words unreadable. `--tracking-*` tokens are zeroed under `[lang="ar"]`.
- **`text-transform: uppercase`.** Arabic has no case. The rule either does
  nothing or mangles mixed strings. Suppressed for eyebrows and table headers.
- **Synthetic bold.** Load the real 600 weight.
- **Mirror non-directional things.** Clocks, logos, checkmarks, and media
  playback controls stay as they are.

## Do mirror these

Arrows, chevrons, steppers, progress indicators, and any icon that points.
Mark them `.icon--directional` and the system flips them.

## Numerals

Kuwait uses Western digits in both languages. **Do not switch to
Arabic-Indic forms.**

- Currency is KWD to three decimal places (the fils).
- All numeric cells use tabular lining figures so columns align.
- Reference numbers set in IBM Plex Mono and always rendered `dir="ltr"`,
  even inside Arabic text — otherwise the bidirectional algorithm reorders
  the sequence and the number the user reads is not the number stored.

The same applies to any Latin product name, model number or email address
appearing inside Arabic copy: wrap it so it is not reordered.

## Layout

- Arabic copy commonly runs **20–25% longer** than English. Translate before
  finalising layout, never after — a container sized to English copy will
  overflow.
- Set measures in `ch` units so both scripts get a comfortable line length.
- Never hard-code a width that only fits one language.

## Testing

Every preview in this system carries an **LTR / RTL** toggle. Use it. A
component is not finished until it has been looked at in both directions,
in both themes.

Beyond that:

- Have Arabic copy reviewed by a native-speaking content designer. The copy
  in these previews is illustrative and has not been.
- Test with a screen reader in Arabic, not only in English.
- Check that `lang` is set on every inline language change, or the screen
  reader will read Arabic with an English voice.

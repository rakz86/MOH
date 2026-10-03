# Accessibility

WCAG 2.1 Level AA is the minimum this service may ship. It is a floor, not a
feature, and it is not negotiable against visual preference.

## What is enforced automatically

`node tools/contrast.js` measures every foreground/background pair the system
ships, in both themes, and fails the build on any regression. Run it in CI.

Current state: all required pairs pass. Body text is 17.15:1. The lightest
permitted text colour, `--color-text-muted`, sits at exactly 4.50:1 — it may
not go lighter.

## Colour

- **Never carry meaning in colour alone.** Every request state has a colour, a
  shape and a word. Print any page in greyscale; every state must remain
  distinguishable.
- **`--color-accent` is restricted.** At 3.10:1 on white it fails AA for body
  text. Use it for large text (24px+, or 19px bold), graphics, and dark
  surfaces only. The contrast test asserts this failure so nobody "fixes" it by
  widening its use.
- **Control boundaries need 3:1.** WCAG 1.4.11. Inputs, selects, secondary
  buttons, choice cards and upload zones use `--color-border-control`, never a
  lighter decorative border.

## Keyboard

- Every interactive element is reachable and operable by keyboard.
- The focus ring is a 3px outline with a 2px offset and a contrast halo. It is
  defined once, on `:focus-visible`, and **may never be removed or restyled**.
- Focus order follows reading order. Never use positive `tabindex`.
- Dialogs trap focus, move focus in on open, and restore it to the triggering
  control on close.
- A skip link is mandatory on every page.

## Targets

44×44 CSS pixels minimum for anything the public touches. Compact density
drops below this and is therefore desktop-and-pointer only.

## Forms

- Labels are visible and persistent. A placeholder is never a label.
- Hints sit above the input, so they are read before answering.
- Errors use `aria-invalid` plus `aria-describedby` pointing at the message,
  and name the fix rather than the failure.
- On submit, an error summary appears at the top of the form, links to each
  failing field, and receives focus.
- Validate on blur, never on every keystroke.

## Motion

`prefers-reduced-motion: reduce` collapses every duration token to 1ms at the
token layer, so no component needs its own media query and none can forget one.
Nothing flashes more than three times per second.

## Announcements

- Toasts live in an `aria-live="polite"` region.
- Loading states carry `aria-busy` and a visually hidden description.
- Status changes are announced, not only rendered.

## Language

- `lang` is set correctly on the root and on any inline language change.
  Arabic inside an English page, or vice versa, must be marked — otherwise a
  screen reader pronounces it with the wrong voice.
- `dir` is set on the root element.

## The accessibility statement

A public service must publish one. It must name the standard tested against,
list known failures with dates for fixing them, and give a route to report a
barrier.

A text-to-speech widget is **not** an accessibility statement and not a
substitute for a conformant page. Both legacy sites offer one in place of this.

## Testing

Automated checks catch perhaps a third of real barriers. Before launch:

- Navigate the whole request flow using only a keyboard.
- Navigate it again with a screen reader, in both languages.
- Test at 200% browser zoom and at 400% with reflow.
- Test in Windows High Contrast Mode.
- Put it in front of users with disabilities. There is no substitute.

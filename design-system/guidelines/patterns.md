# Page patterns

Rules for assembling components into the pages of the service. The components
themselves are documented in the previews; this is about how they go together.

The pages that apply these rules live in `../../website/`, not here — a page
is a product decision, not a branding one.

## Multi-step requests

- **Break long forms into steps a person can finish in one sitting.** Save the
  draft between them. A requisition abandoned at step 4 because someone had to
  leave their desk is a failure of the form, not the user.
- **The stepper is a map, not a shortcut.** Users may jump back to any
  completed step; never forward past an incomplete one.
- **Show the constraint while the decisions are still being made.** The
  running total and remaining budget stay visible on every step. A requester
  who discovers at step 5 that they are over budget has wasted the whole form.
- **A blocked primary action explains itself.** Name what is missing and link
  straight to it. A greyed-out button with no explanation is the most common
  dead end in government forms.
- **The final step restates everything**, with an edit link per section that
  returns the user to that step and back again. Nothing is submitted that the
  requester has not seen assembled.

## Queues and tables

- **Age, not dates.** Show how long a request has waited, because that is the
  number an officer acts on. The absolute date belongs in the detail view,
  where it is evidence rather than a prompt.
- **Never truncate the reference.** It is how a request is discussed on the
  telephone and searched for later. Set it in mono, never abbreviated, always
  selectable.
- **Rows are not links.** A whole-row link makes text selection impossible and
  confuses screen readers. Put the link on the reference cell and let the row
  carry hover as an affordance only.
- **Text aligns to `start`, numbers to `end`** — both logical, so RTL handles
  itself. Numbers use tabular figures so a column of values can be scanned
  down and compared.
- **Below 840px a table becomes cards, not a horizontal scroll.** A public
  service is used on phones, and a table that needs sideways scrolling to
  reveal a status is a table nobody reads.
- **Numbered pagination, not infinite scroll.** An officer needs to be able to
  say "it is on page 3" and get back to it.

## Decisions and approvals

- **Everything needed for the decision is on one screen** — the request, the
  budget position, the attachments and the full history — with the decision
  controls pinned so nobody scrolls back up to act.
- **Reject is never one click.** It opens a dialog requiring a written reason,
  which is sent to the requester and written to the audit trail. A decision
  affecting a hospital department must be explainable afterwards.
- **Constructive and destructive actions sit apart.** Approve and Reject are
  never adjacent without separation. The most common and least consequential
  outcome — asking for more information — sits at the opposite end.
- **Show the checks before the decision**, not after. An officer should see
  which validations passed and which did not before pressing Approve.
- **History is append-only.** Every state change records who, what and when.
  Entries are never edited or deleted; a correction is a new entry. This is a
  public procurement record.
- **The requester sees the same history.** Not internal notes, but every state
  change with its timestamp and the officer responsible. Traceability applies
  in both directions.

## Empty and loading states

- **An empty result names the way out.** "No requests match these filters" plus
  a control that clears them, not a shrug.
- **Skeletons match the shape of what is arriving**, so the layout does not
  jump when it lands. They carry `aria-busy` and a visually hidden description,
  so the wait is announced rather than silent.

## Density

- **Comfortable is the default**, for requesters and suppliers and anyone
  reaching the service from a phone.
- **Compact is for the internal workbench only** — officers triaging a queue on
  a desktop. It drops below the 44px target floor, so it must never be served
  to a touch device or to a member of the public.
- Density goes on a layout wrapper, never on an individual component.

# Printed request form — design spec

The paper counterpart to the website. Clinics fill it in by hand, it is
scanned, and OCR reads it. Everything below is **measured from the approved
workbook**, not from the script that first generated it:

    D:\MOH\Perio-Instruments-Request Form Oct 2026.xlsx

That file is the source of truth. It was hand-tuned after generation, so
where this document and the generator disagree, the file wins. Re-measure
with `tools/extract-form-spec.py` rather than trusting this page if the file
has moved on.

Two tabs carry forms — **Per-Clinic Form** and **Centre-Level Form** — plus
**Code Register** for lookup and the untouched originals `Sheet1/2/3`.

---

## Page

Identical on both form tabs.

| | |
|---|---|
| Orientation | **Portrait**, A4 (`paperSize 9`) |
| Scaling | Fit to **1 page wide**, unlimited tall (`fitToPage`, `fitToHeight 0`) |
| Margins | L/R 0.25in · top 0.3in · bottom 0.45in · header 0.2in · footer 0.25in |
| Gridlines | Off |
| Centred | Horizontally |
| Repeating rows | **11:12** — the two-row column heading, on every page |
| Footer | left `Periodontic - Oral Medicine   |   Dental Instruments Request Form` · right `Page &P of &N`, 8pt |
| Emblem | One image, anchored H2, 54×59px — lifted from the department's own file |

**The sheet is deliberately wider than the page.** A4 portrait at these
margins gives 746px; the Per-Clinic tab is 1003px and prints at about 74%.
That is intentional and approved — it buys a description column wide enough
to hold an instrument name on one line. Do not "fix" it by narrowing columns.

**Page breaks are manual and hand-placed.** Per-Clinic breaks after rows
**33, 58, 83** (4 pages). Centre-Level has none (1 page). A manual break is
absolute — Excel honours it whatever the print scale — so if row heights or
content change, the breaks must be re-checked by hand or the last page will
come out part-empty.

---

## Columns

Width in Excel units; px = `units × 7 + 5`. **The two tabs differ** — each
was tuned for its own content.

| Col | Heading | Per-Clinic | Centre-Level |
|---|---|---|---|
| A | CODE | 7.0 (54px) | 7.0 (54px) |
| B | NO. | 4.86 (39px) | 4.43 (36px) |
| C | ITEM  DESCRIPTION | **67.0 (474px)** | **36.0 (257px)** |
| D | Standard / Qty / Clinic | 7.0 (54px) | 7.0 (54px) |
| E | Return / Damaged | 8.71 (66px) | 9.43 (71px) |
| F | Issue / New | 13.0 (96px) | 13.0 (96px) |
| G | TOTAL / QTY | 7.0 (54px) | 9.0 (68px) |
| H | COMMENTS | 23.0 (166px) | 23.0 (166px) |
| | **total** | **1003px** | **802px** |

---

## Rows

| Role | Height (pt) |
|---|---|
| Spacer (1, 6, 10) | 5.1 |
| Masthead line (2, 4, 5) | 21.95 |
| Title (3) | 27.0 |
| Scope line (7) | 18.0 |
| OCR heading (8) | 21.95 |
| OCR body (9) | 42.0 |
| Column heading (11, 12) | 33.95 each |
| Set banner | 21.95 |
| **Item** | **27.95** |
| **Variant** | **39.95** |
| Quota group | grows with its text — 32.25 and 54.0 both occur |

Item rows at 27.95pt give roughly 10mm of writing height. That floor is the
whole point of the layout; nothing should drop below it.

---

## Type and colour

Calibri throughout, matching the department's existing form.

| Element | Size | Weight | Colour | Fill |
|---|---|---|---|---|
| `PERIODONTIC - ORAL MEDICINE` | 14 | bold | red `FFFF0000` | — |
| Version | 10 | bold | black | — |
| `Dental Instruments Request Form` | 18 | bold | black | — |
| Header-block labels | 10 | bold | black | — |
| Header-block write boxes | 11 | — | — | white, medium bottom rule |
| Scope line | 11 | bold | navy `FF1F4E79` | — |
| OCR heading | 12 | bold | red `FFFF0000` | cream `FFFFF9E6` |
| OCR body | 10 | — | black | cream `FFFFF9E6` |
| CODE / NO. / ITEM / COMMENTS headings | 12 | bold | blue `FF0000FF` | — |
| Standard, TOTAL headings | 10 | bold | red `FFFF0000` | — |
| Return, Issue headings | 10 | bold | blue `FF0000FF` | — |
| Set banner | 12 | bold | black | grey `FFD9D9D9` |
| Item code | 11 | bold | black | — |
| Item description | 11 | — | black | — |
| Standard quantity | 12 | bold | black | `FFF2F2F2` |
| Quota-group row | 10–11 | bold | black | lilac `FFDCD2EC` |
| Variant `↳ shared` | 9 | italic | grey | — |

The four numeric headings are 10pt, not 12 — at 12 "Standard" and "Damaged"
clip in their columns.

---

## The shading rule

This is the part that does real work, and it must survive any redesign:

- **White cell → write here.** Columns E–H on item and variant rows.
- **Grey `FFBFBFBF` → do not write here.** Columns E–H on a quota-group row.
- **`FFF2F2F2` → pre-printed reference.** The Standard column.

Stated in the instructions as *"Do not write in a shaded box."*

## Quota groups

Where the form says "A **or** B", both instruments satisfy one allowance.
On paper that is enforced by layout, since a sheet cannot compute:

```
DG04    Periodontal Probe/Explorer Double ended – 23/UNC 15 or 23/CP-12
        — EITHER OPTION. 5 IN TOTAL ACROSS BOTH ROWS BELOW.     std 5    [boxes GREYED]
  DG04A   Option A  —  23/UNC 15                            ↳ shared    [boxes white]
  DG04B   Option B  —  23/CP-12                             ↳ shared    [boxes white]
```

The parent is lilac, carries the allowance, and its own entry boxes are
greyed out. The options are indented, carry `↳ shared` instead of a number,
and take the writing. There is nowhere to claim the allowance twice.

Five groups: `DG04`, `NS02`, `SG02`, `SG05`, `MS15`.

---

## Fixed text

Reproduce verbatim.

| Cell | Text |
|---|---|
| A2 | `PERIODONTIC - ORAL MEDICINE` |
| E2 | `Version October 2026` |
| A3 | `Dental Instruments Request Form` |
| A4 / E4 | `Center :` / `Department Head :` |
| A5 / E5 | `Clinic No :` / `Date :` |
| A7 | `ONE FORM PER CLINIC  -  complete a separate sheet for each clinic number` |
| A8 | `PLEASE ENSURE WRITING IS CLEAR, AND ONLY WRITE IN THE SPACES PROVIDED` |

A9, the OCR instruction, in full:

> Use black or dark blue ink - never pencil.  Write one plain numeral per
> box: 0 1 2 3 4 5 6 7 8 9.  Leave a row blank if there is nothing to report
> - no dashes, no ticks.  To correct an entry, cross the box through once and
> write the correct figure beside it.  Do not write in a shaded box.

Centre-Level A7 instead reads: `ONE FORM PER DENTAL CENTRE  -  these items
are shared across the clinics in a centre, not held per clinic`.

Footer of each form: a **FOR OFFICE USE** banner, then two rows of
*Completed by / Signature / Date* and *Received by instrument office /
Signature / Date*.

---

## Borders

- Table outer edge: **medium**. Inner horizontals and verticals: **thin**.
- Set banners: medium top and bottom.
- Header-block write boxes: medium bottom rule only.
- **Every row at the foot of a page needs its bottom border present.** A
  cleared bottom border there leaves the table visibly open at the page
  edge — it happened once on row 33 and had to be put back. Check rows 33,
  58 and 83 after any edit.

---

## Codes

Two letters for the set, two digits for the item's number on the printed
form, and a trailing letter for an either/or variant: `DG01`, `EX24`,
`DG04A`. 100 codes in total — 78 clinic-level items across DG/NS/SG/EX/MS
(191 units) and 12 centre-level across OI/KT (31 units), plus the 10
variants. They match `website/data/periodontic-sets.json` exactly and are
permanent: an item keeps its code even if the form is renumbered, so old
requests stay readable.

`OTHER ITEMS` on the source form is numbered 1, 2, 3, 4, 6, 7 — there is no
item 5, and the codes follow the form rather than closing the gap.

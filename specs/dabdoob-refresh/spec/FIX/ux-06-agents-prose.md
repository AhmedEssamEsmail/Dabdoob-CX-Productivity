# FUX-06: agents — trim "Productivity workbook" prose wall to one hint line
Kind: mini
ID: FUX-06
Parent: FIX-UX1
Owner: dev
Depends: none
Criteria: reports/ux-1.md ux-6 (MED); PLAN #5 (no prose walls)
Skills: none
Budget: files=1; actions=2; changed_lines=20; minutes=5

## Goal
The "Productivity workbook per month" block carries a 4-sentence
implementation paragraph ("reads each month's workbook … fallback holds
that month's rows"); PLAN §5 forbids prose-wall descriptions. Trim it to
one hint line — the dynamic tab list and fallback id are implementation
detail and get dropped (`data` stays used by the form below).

## Files
- Edit: `src/features/cx-people/components/agents-page.tsx` | `.block` paragraph only (~L286-298)

## Context
- `agents-page.tsx:285-298` | `.block` → `.block-title` + `<p className="block-text">` wall (uses `data?.tabs.join`, `data.fallbackId`)
- `agents-page.tsx:299-301` | `{error ? <LoadError…>}` + `{data ? (<form…` — everything after the `<p>` is untouched; `data` remains used (`data.current` placeholder ~L319)
- `src/app/refresh.css:165` | `.card-hint` — the single-line hint class
- `reports/ux-1.md` row ux-6 | example line given

## Contract
- Replace the whole `<p className="block-text">…</p>` with ONE line:
  `<p className="card-hint">{D("Reads each month's workbook into V2; months without one use the fallback.")}</p>`
  (use `D()` — this is a user-facing string; the source string is
  English, the Arabic variant lands in the dictionary if missing).
- Keep `.block`, `.block-title`, `{error ? <LoadError/>}`, the `data`-gated
  form, `save`/`refresh`/`remove`, `note`/`noteErr` output — all untouched.
- Out of scope: any other `.block-text`/`block` on the page, the form
  fields, the `api.*` calls.

## Actions
1. Swap the paragraph for the single `.card-hint` `D()` line.
2. `npx eslint src/features/cx-people/components/agents-page.tsx` + `npx tsc --noEmit` clean.

## Done when
- The section shows exactly one hint line; no multi-sentence description, no `data?.tabs`/`fallbackId` text remains.
- `npx tsc --noEmit` clean; `data` still compiles (used below).

## Verify
- Run: `npx eslint src/features/cx-people/components/agents-page.tsx && npx tsc --noEmit` -> clean

## Handoff
none.
Write results/FUX-06.md (<=10 lines); TL alone updates TRACKER.md.

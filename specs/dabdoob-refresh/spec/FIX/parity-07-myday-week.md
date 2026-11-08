# PX-07: /my-day — Week view + page-level Book-focus-block CTA
Kind: mini
ID: PX-07
Parent: FIX-PARITY
Owner: dev
Depends: none
Criteria: reports/ux-parity.md M3 (MED)
Skills: none
Budget: files=1; actions=7; changed_lines=150; minutes=9

## Goal
Mock 03 `/my-day` has a `Today/Week` seg and a `Book focus block` CTA in
`.page-actions`. The app's seg is `Today/Tomorrow` and booking only
exists inside cards. Change the seg to `today | week` (Week = the loaded
two-day window: both days' events, gaps and deadlines — the API only
serves today+tomorrow) and add a head CTA that books the earliest open
gap via the existing `Fs.createFocusBlock` + `C('core')` reload.

## Files
- Edit: `src/features/cx-hub/components/my-day-page.tsx` | `pd` state + seg (~L896, L979-997), `TimelineCard` (~L616-690) + `FocusBlocksCard` (~L805-895) week handling, `Book focus block` button in `.page-actions`

## Context
- `mockups/pages/03-my-day.html` | head anatomy: seg `Today/Week` +
  primary `Book focus block` button in `.page-actions`
- `my-day-page.tsx:896,979-997` | `pd: 'today'|'tomorrow'` + `.seg`
  buttons — change options to `'today'|'week'`
- `my-day-page.tsx:616-690` | `TimelineCard({day,dayKey})` builds `rows`
  from `day.events[dayKey]` + gaps/deadlines matching
  `day[dayKey]` date — `dayKey` must accept `'week'`
- `my-day-page.tsx:805-895,819-825,218` | `FocusBlocksCard` filters gaps by the `dayKey` date (`Gm(g.start) === date`); `Fs.createFocusBlock(g.start,g.end,'Focus time')` + `C('core', true)` reload pattern; `w` shape = `events.today`/`events.tomorrow`/`focus.data` (all gaps, `g.start` carries its date)/`deadlines.data`/`today`/`tomorrow`

## Contract
- `pd` type `'today'|'week'`; seg labels `Today`/`Week` (`aria-pressed`).
- Week = the loaded window `[w.today, w.tomorrow]` (note it in a code
  comment: API scope is two days). Concretely:
  - `TimelineCard`: when `dayKey==='week'` build rows for BOTH dates —
    iterate both `events` sections, tag each row with its day
    (`sub` prefix or a `day` field shown as a small label), include ALL
    `focus.data` gaps + all deadlines; keep `now` flags + sort.
  - `FocusBlocksCard`: `dayKey==='week'` → `gaps = focus.data` unfiltered
    (already flat `Q[]`); keep booked-state + per-gap Book buttons.
  - `DaySection`s: in week view keep BOTH (Today + Tomorrow) — they
    already render all days; no change needed there.
- `Book focus block` CTA: `.btn btn-primary` in `.page-actions` (before
  the seg); `disabled` when no open gap across the visible scope;
  onClick = `createFocusBlock` on the earliest still-open gap
  (`R(w.today).concat(R(w.tomorrow))` earliest by `start`, skipping
  `g.booked`), then `C('core', true)`; show `Booking…` while busy and
  surface the existing error toast/`u` banner on failure (reuse the
  card's `book()` error handling).
- Keep `Km`/`If`/`md-fresh`/Refresh controls, all ids, the `md-banner`s,
  `Ym(w,_)` up-next logic, `R()` signature.
- i18n: use `D('Week')`, `D('Book focus block')` — AR dict entries are
  NOT required in this leaf (missing keys fall back to English).

## Actions
1. Change `pd` union + default stays `today`; rename seg options/labels.
2. `TimelineCard`: accept `'week'`; branch the row builder.
3. `FocusBlocksCard`: accept `'week'`; skip the date filter.
4. `R()` gains a week variant (or callers compose both days) — keep
   `DaySection` props working.
5. Add the `Book focus block` CTA + its busy/disabled logic.
6. Ensure `If`/`Nf` (up-next) still shows in both views.
7. `npx eslint` the file + `npx tsc --noEmit` clean.

## Done when
- Seg shows `Today`/`Week`; Week lists both days' events + all gaps +
  deadlines in `TimelineCard` and all open gaps in `FocusBlocksCard`.
- Head `Book focus block` books the earliest open gap and refreshes.
- `npx tsc --noEmit` clean; no removed ids/e2e hooks.

## Verify
- Run: `npx eslint src/features/cx-hub/components/my-day-page.tsx && npx tsc --noEmit` -> clean
- Run: `grep -n "week\|Week\|Book focus block" src/features/cx-hub/components/my-day-page.tsx` -> seg option + CTA + week branches present

## Handoff
'Week' = the API's two-day window (today+tomorrow) — the endpoint only
returns those days; wider ranges would need an API change (out of scope,
record in results).
Write results/PX-07.md (<=10 lines); TL alone updates TRACKER.md.

# PX-02: /queue — search into page-head + Export button (CSV of loaded queues)
Kind: mini
ID: PX-02
Parent: FIX-PARITY
Owner: dev
Depends: none
Criteria: reports/ux-parity.md H4 (HIGH) + LOW (queue search in head)
Skills: none
Budget: files=1; actions=5; changed_lines=90; minutes=8

## Goal
Mock 04 `/queue` has a `.page-actions` search field + `Export` button in
the page head. The app filters via a `.cx-filters` search row above the
table and has no export. Move the queue-name search into the head aside
and add an `Export` button that downloads the currently loaded (and
filtered) queue rows as CSV — no new endpoint (none exists).

## Files
- Edit: `src/features/cx-queue/components/queue-page.tsx` | `Board` (~L114-240): `head` aside fragment, `CxFilters` usage (~L235), export helper (module scope near `headStats`)

## Context
- `mockups/pages/04-queue.html` | head anatomy (`input` + `Export` btn)
- `queue-page.tsx:114-235` | `Board`: `r`/`i` search state filters
  `t.queues` into `f`; `Head` `aside` currently only `<RefreshNow>`;
  `CxFilters` ~L235 renders the search row
- `src/features/cx-queue/components/shared.tsx:36` | `Head` — keep its
  signature (`aside` slot renders `.dq-head__aside`)
- `src/app/cx-kit.css` `.cx-filter`/`.input` | reuse `.input` class for
  the head search so it styles like mock

## Contract
- Head aside = `<>` fragment: `.input` search (`type="search"`,
  `aria-label='Filter queues'`, placeholder 'Search queue names',
  `value={r}` `onChange`→`i`, `style={{width:'11rem'}}` or a small class),
  `Export` `.btn btn-quiet` button, then the existing `<RefreshNow>`.
- Delete the `<CxFilters …/>` row entirely (its only control was the
  moved search). If `CxFilters` becomes an unused import, remove it from
  the import list too. Do NOT remove the shared `CxFilters` export from
  shared.tsx.
- Export: on click, build CSV of the FILTERED `f` rows — header
  `queue,open,<band labels…>,over_top,oldest_h` (use the real field
  names on `t.queues` rows + `t.bands.labels`); download as
  `queue-health-<today>.csv` via a Blob + `URL.createObjectURL` +
  temporary `<a>` click (standard client download, no deps). Quote cells
  containing commas. Disabled/`aria-disabled` while `!t`.
- Keep `id`/`aria` hooks, the age-band chip filtering, and all existing
  ids (e.g. `#page-title`, `#age-h`).

## Actions
1. Add module-scope `exportCsv(rows, labels, date)` helper (~25 lines: header+rows, escape, blob download).
2. Replace `aside={<RefreshNow onDone={s} />}` with the search+Export+RefreshNow fragment.
3. Remove the `<CxFilters …/>` row + now-unused import.
4. Wire Export onClick → `exportCsv(f, t.bands.labels, <today>)`.
5. `npx eslint` the file + `npx tsc --noEmit` clean.

## Done when
- `/queue` head shows the search field + `Export` button + refresh; no
  separate filter row above the table.
- Typing in the head search filters the queue table exactly as before.
- Export downloads a CSV whose row count = filtered rows, columns match
  the table, bands expanded with their labels.

## Verify
- Run: `npx eslint src/features/cx-queue/components/queue-page.tsx && npx tsc --noEmit` -> clean
- Run: `grep -n "CxFilters\|Export\|exportCsv" src/features/cx-queue/components/queue-page.tsx` -> no CxFilters usage; Export button + helper present

## Handoff
none.
Write results/PX-02.md (<=10 lines); TL alone updates TRACKER.md.

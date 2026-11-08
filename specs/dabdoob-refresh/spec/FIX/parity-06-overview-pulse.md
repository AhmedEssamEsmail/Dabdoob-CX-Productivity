# PX-06: /overview — Team pulse = 4 real KPI bars + drop extra Ecosystem row
Kind: mini
ID: PX-06
Parent: FIX-PARITY
Owner: dev
Depends: none
Criteria: reports/ux-parity.md M2 (MED) + LOW (extra Ecosystem row)
Skills: none
Budget: files=2; actions=5; changed_lines=200; minutes=10

## Goal
Mock 02's "Team pulse" card shows 4 KPI bars (Quality / Productivity /
FCR / Schedule adherence). The app renders age-band mini-bars
(`e.ladder` — duplicates the "Queues right now" age bands) and an extra
`cx-section` Ecosystem link row the mock lacks. Server: add `pulse`
(quality/productivity/fcr over the last 7 days from the same stores
`kpiPayoutFor` uses; adherence has NO data source → `null`). Client:
render the 4 hbar rows (mock anatomy) and delete the ecosystem row.

## Files
- Edit: `src/features/cx-hub/lib/aggregates.ts` | `getHomePage` (~L65-280): after `oldest`/roster scoping, read `sc_daily`+`prod_daily_layers`+`fcr_daily` (+roster already loaded), compute scoped `pulse`, set `out.pulse`
- Edit: `src/features/cx-hub/components/overview-page.tsx` | Team pulse card (~L598-623) → 4 hbar rows; delete the Ecosystem `cx-section` (~L498-513)

## Context
- `mockups/pages/02-home.html` | `.hbar-row` anatomy: label / `.bar`
  fill / `nn%` (`bar blue` on adherence)
- `src/features/cx-people/lib/kpi/server.ts:78-165` | EXACT derivation to
  reuse: `sc_daily` wins (matrix_day rows: targets/achieved → prod%,
  scoreXaudits/audits → qual, fcr passed/failed → fcr); else
  `prod_daily_layers` (layer 'effective' else 'raw', same fields); else
  `fcr_daily`. Copy this logic into a module-scope helper here — do NOT
  import kpi/server.ts (it pulls the whole payout domain).
- `aggregates.ts:65-280` | `user` has `role`/`email`/`specialist`;
  `roster` rows have `email`+`tl_email` → TL scope = roster agents where
  `tl_email` = user.email (+ the TL themself); agent scope = own email;
  admin = all rows. 7-day window: `dqDateKey_`-style keys already exist
  in-file (`addDays`/date helpers — use whatever the file already uses
  for `decidedFrom`-style windows).
- `overview-page.tsx:598-623` | current `pulseRows`/`.hbar-row` markup —
  keep `.hbar-row`, swap rows to the 4 KPIs
- `overview-page.tsx:498-513` | the extra Ecosystem `cx-section` to remove
  (`e.ecosystem` payload + route stay — only the row is dropped)

## Contract
- `pulse = { quality: pct|null, productivity: pct|null, fcr: pct|null, adherence: null }`
  scoped like `oldest` (admin all; tl own team; agent own) over the last
  7 days ending today. Percent = `round1`. `null` → bar at 0% width +
  `–` value (transparent, no fabrication).
- Sources: try `sc_daily` first (only rows in window + scope; `matrix_day`
  truthy rows feed prod/qual; all rows feed fcr counts) → else
  `prod_daily_layers` ('effective' layer else 'raw') → fcr from
  `fcr_daily` when sc wasn't used. A missing/unreadable store yields
  `null` for that metric — never throw, never invent.
- Card copy: title stays 'Team pulse'; hint becomes
  `Your scope, last 7 days` (or 'Team, last 7 days' for admin).
- Row order = mock: Quality, Productivity, FCR, Schedule adherence;
  adherence renders `bar blue`, `–` value, sub-note 'no source' omitted —
  just the `–`.
- Keep `aria-label`s/skeleton/`Hi` fmt for counts where reused; remove
  now-unused `pulseRows`/`bandLabels`/`bandTotal` vars if orphaned.

## Actions
1. In `aggregates.ts`: module-scope `pulseFor_(rows…)` helper implementing the sc_daily→prod_daily_layers→fcr_daily cascade for a given email set + 7d window.
2. In `getHomePage`: `Promise.all` the three stores with the existing reads; build `scopeEmails`; `out.pulse`.
3. In `overview-page.tsx`: rewrite the Team pulse card body to the 4 `.hbar-row`s.
4. Delete the Ecosystem `cx-section` block (~L498-513).
5. `npx eslint` both files + `npx tsc --noEmit` clean.

## Done when
- `/overview` Team pulse shows exactly the 4 labelled bars with real %
  (or `–`); values match the sc_daily/prod_daily_layers data for scope.
- No Ecosystem row renders; everything else (stats, needs, queues) intact.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx eslint src/features/cx-hub/lib/aggregates.ts src/features/cx-hub/components/overview-page.tsx && npx tsc --noEmit` -> clean
- Run: `grep -n "pulse\|ecosystem" src/features/cx-hub/lib/aggregates.ts src/features/cx-hub/components/overview-page.tsx` -> `out.pulse` + 4-row card; no Ecosystem section JSX

## Handoff
Adherence: NO source exists in the codebase (verified: no
adherence column/store) → `null`/`–` by design; record it in results.
Write results/PX-06.md (<=10 lines); TL alone updates TRACKER.md.

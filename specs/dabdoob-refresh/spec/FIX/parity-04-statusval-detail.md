# PX-04: /status-validation — restore 3-stat summary incl. Score effect (+H7b divergence)
Kind: mini
ID: PX-04
Parent: FIX-PARITY
Owner: dev
Depends: PX-03 (same file — serial)
Criteria: reports/ux-parity.md M7 (MED) + H7b (HIGH → documented divergence)
Skills: none
Budget: files=2; actions=4; changed_lines=110; minutes=9

## Goal
Mock 07's flag detail has a 3-stat summary (Suggested status / Cases
inside window / Score effect) which the app replaced with `FlagStrip` +
a 2-col case table (H7b dropped TOUCHES/DUR./EVIDENCE). Restore the
stats row *above* `FlagStrip` with real values; compute Score effect
server-side from `prod_intervals`. H7b is a DOCUMENTED DIVERGENCE:
`prod_flags.case_ids_json` stores only `[id, channel]` pairs and
`prod_tph_cases` holds hour-level counts, not per-case touches —
per-case Touches/Dur./Evidence do not exist anywhere. Keep the 2-col
table and record the divergence in results + a code comment.

## Files
- Edit: `src/app/api/prod/flags/[flagId]/route.ts` | after the scope check (~L40-57): `prod_intervals` sum for the flag's `agent_email` + `date`; add `scoreEffect` to the JSON payload
- Edit: `src/features/cx-productivity/components/status-validation-page.tsx` | `FlagDetail` (~L120-215): stats grid above `<FlagStrip>`; widen the `useSe` payload type; keep everything else

## Context
- `mockups/pages/07-status-validation.html` | the `.grid`/stat trio
  above the window table
- `route.ts` ([flagId]) | `flag` row available: `agent_email`, `date`,
  `flagged_min` already in the row/`flagView`
- `src/features/cx-productivity/lib/prod-validation.ts:36-70` |
  `FlagView` fields (flaggedMin, intervalMin, distinctCases, cases)
- `status-validation-page.tsx:118-160` | `FlagDetail`: `r.flag` = `f`;
  `.stat` markup pattern used across pages (`.stat`, `.stat-l`,
  `.stat-v`, `.stat-d`)
- `src/app/api/prod/flags/[flagId]/decide/route.ts:82-88` | existing
  `prod_intervals` query pattern (`select('status').gte('date'…)`)

## Contract
- Route: after `flagInScope` passes, query
  `supabase.from('prod_intervals').select('interval_min')
  .eq('agent_email', flag.agent_email).eq('date', flag.date)` —
  `dayMin = sum(interval_min)`; `scoreEffect = dayMin>0 ?
  round1(flagged_min/dayMin*100) : null` (share of the logged day the
  flag reclassifies — the honest derivable proxy for the mock's "Score
  effect"). Return `{ flag, openedAt, scoreEffect }`; do NOT change the
  flag shape.
- `FlagDetail`: under the `card-head` (before `FlagStrip`), render
  `<div className="grid grid-3" style={{marginBlock:'0 1rem'}}>` with
  three `.stat`s:
  1. `Suggested status` → `f.suggestedStatus` (sub `{G(f.flaggedMin)} of
     {G(f.intervalMin)}`)
  2. `Cases inside window` → `f.distinctCases` (sub `{f.caseCount} touches
     logged` if caseCount≠distinctCases else ids count)
  3. `Score effect` → `r.scoreEffect != null ? r.scoreEffect+'%' : '–'`
     (sub `of the day's logged minutes`)
- H7b: keep the Case/Channel table. Add a `// PARITY:` comment noting
  per-case Touches/Dur./Evidence are not persisted (`case_ids_json`
  pairs only) — documented divergence, no fake data.
- `useSe` type: `{ flag: FlagView; openedAt: string; scoreEffect: number | null }`.

## Actions
1. Route: add the intervals query + `scoreEffect` in the payload (guard
   errors: failed query → `scoreEffect: null`, don't 500).
2. `FlagDetail`: widen payload type; add the `grid-3` stats above `FlagStrip`.
3. Add the PARITY divergence comment at the cases table.
4. `npx eslint` both files + `npx tsc --noEmit` clean.

## Done when
- Opened flag shows the 3-stat summary (Suggested status / Cases inside
  window / Score effect) with real values; '–' when intervals absent.
- JSON of `GET /api/prod/flags/<id>` includes `scoreEffect`.
- H7b divergence comment present; no invented columns.

## Verify
- Run: `npx eslint src/app/api/prod/flags/[flagId]/route.ts src/features/cx-productivity/components/status-validation-page.tsx && npx tsc --noEmit` -> clean
- Run: `grep -n "scoreEffect\|Score effect\|PARITY" src/app/api/prod/flags/[flagId]/route.ts src/features/cx-productivity/components/status-validation-page.tsx` -> payload + stats + comment present

## Handoff
State in results that H7b is divergence + why (case_ids_json pairs only;
no per-case touches/duration store exists).
Write results/PX-04.md (<=10 lines); TL alone updates TRACKER.md.

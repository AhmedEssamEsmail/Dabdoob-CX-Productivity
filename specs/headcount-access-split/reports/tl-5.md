# tl-5 — FIX round for reports/data-1.md (headcount-access-split)

Source report: `reports/data-1.md` (data-analyst round 1, FAIL, open 0/0/2/3).
Spec: `spec/fix-data-1.md` (leaves data1-01..03). All 3 dispatched, all done.
Wave: 3 parallel workers, disjoint file sets — no serial chains needed.

## Completed leaves (DELTA scope for re-review)

| Leaf | Finding | Owner | Files changed | Evidence |
|---|---|---|---|---|
| data1-01 | data-1 MED | dev | `src/features/cx-productivity/lib/tph/write.ts` (+1 import, predicate swap); `tests/perf/tph-write-gate.test.ts` (new, 5 pins) | `tphCheckAgent_` now `!p \|\| !isCxAgent_(p)`; 5/5 tests, tsc clean — results/data1-01.md |
| data1-02 | data-2 MED | dev | `src/features/shared/lib/adapters.ts` (pwDirectory_), `src/features/cx-queue/lib/jobs.ts` (dqActiveTlEmails_), `src/features/cx-hub/lib/roster.ts` (wasActive, mgrActive, people map), `src/features/cx-hub/lib/myday.ts` (asTlFollowUps_) — 5 roster-row `active` coercions unified to `!== false && String().toLowerCase() !== 'false'`; `tests/platform/roster-active.test.ts` (new, 3 pins) | NULL now = active everywhere, matching DEFAULT TRUE; 105 tests green — results/data1-02.md |
| data1-03 | data-2 MED (optional half) | supabase-expert | `supabase/migrations/20261112165047_roster_active_not_null.sql` (new, local-only) | UPDATE NULLs→TRUE then `ALTER COLUMN active SET NOT NULL`, DEFAULT TRUE kept; no remote commands — results/data1-03.md |

Note: data1-02 covered 5 divergent sites (report named 3 impls); myday.ts:523
and roster.ts:336/445 had the same root-cause `=== 'true'` coercion on roster
rows and are included. Non-roster `active` reads untouched. `isTrue_` kept
(meeting_series caller). Legacy `tph/index.ts` copies untouched (data-4, LOW).

## Deferred (LOW per FIX routing)
- data-3 (adapters `by` synthetic admins — no live impact)
- data-4 (legacy tph copies role-keyed — no src callers)
- data-5 (`dqHctActive_` LWD guard doc + LWD check — folded into the pending
  approved backfill run; see TRACKER "Blocked / needs user")

## Integration gates (checkpoint after this wave)
- `npx tsc --noEmit` — PASS (no diagnostics) — logs/gate-tsc-5.log
- `npx eslint <7 touched files>` — PASS exit 0 — logs/gate-eslint-5.log
- `npx vitest run` (8 files: 2 new + 6 affected suites) — PASS 133/133 — logs/gate-vitest-5.log

## Needs user / approval
- Pre-existing: S07-01 real backfill run still NEEDS_APPROVAL (unchanged).
- data1-03 migration is local-only; auto-applies on merge to main like S01-01 —
  covered by normal merge approval, no separate action.
- No review gates run by TL (per role rules); re-review of the DELTA above is
  the PM's to dispatch.

Status: fix wave complete, all blocking findings resolved, gates green.

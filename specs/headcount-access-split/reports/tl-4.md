# tl-4 — FIX round for reports/qa-1.md (headcount-access-split)

Verdict of round: all 6 blocking findings fixed, targeted gates green.
Routing: all findings -> `dev` (no DB/pipeline/docs/test-only findings; none
asked for a reviewer role — nothing to ignore).
`qa-7` (LOW, stray repo-root log file) -> deferred per FIX routing; note the
file `C:UsersAHMEDAppDataLocalTemps0301-vitest.log` still sits at repo root for
the PM/user to delete or fold into a later leaf.

## Leaves (spec/fix-qa-1.md; preflight structural+semantic PASS x6)

| Leaf | Finding | Files changed | Result |
|---|---|---|---|
| qa1-01 | qa-1 HIGH | `src/features/shared/lib/title-level.ts` (NEW, dqTitleLevel_ verbatim), `src/features/shared/platform/identity.ts` (import+re-export), `src/features/shared/lib/adapters.ts` (DirectoryPerson.titleLevel; managerOf/agentsOf/tls title-keyed) | results/qa1-01.md — tlqueue+people-jobs 64/64, no fixture reconciliation needed |
| qa1-02 | qa-2 HIGH | `src/features/cx-people/lib/one-on-ones.ts` (pwPair_ gate+kind via dqTitleLevel_) | results/qa1-02.md — people.test 24/24, no fixture change |
| qa1-03 | qa-3 MED | `src/features/cx-hub/lib/myday.ts` (asTlFollowUps_ predicate -> dqTitleLevel_==='tl') | results/qa1-03.md — tsc+eslint clean |
| qa1-04 | qa-4 MED | `src/features/shared/platform/viewas.ts` (viewAsAuditors = qaAuditors_ predicate) | results/qa1-04.md — tsc+eslint clean |
| qa1-05 | qa-5 MED | `src/features/cx-people/lib/coaching.ts` (people filter -> titleLevel!=='manager') | results/qa1-05.md — tsc+eslint clean |
| qa1-06 | qa-6 MED | `src/features/cx-people/lib/meetings.ts` (payload +titleLevel; :416 check), `src/features/cx-people/components/meetings-page.tsx` (eligibleOwners + chair filter) | results/qa1-06.md — tsc+eslint clean |

Churn: 9 files, ~80 added/deleted lines total (logs/fix-qa1-diff.log).
Waves: 4 + 2 parallel; all file-sets disjoint, no serial chains.
Note: several workers wrote `results/qa1-0x.md` to the repo-root `results/`;
TL consolidated all six under `specs/headcount-access-split/results/`.

## Integration gates (checkpoint)

- `npx tsc --noEmit` — PASS exit 0 (logs/gate-tsc-4.log)
- `npx eslint <9 touched files>` — PASS exit 0 (logs/gate-eslint-4.log)
- `npx vitest run tests/golden/{people,queue-tlqueue,people-jobs} tests/platform/{directory-title,calendar} tests/perf/identity-roster` — PASS 108/108 (logs/gate-vitest-4.log)
- Full `npx vitest run` / `npm run test:e2e` NOT re-run — unchanged known
  baselines (4 audit-queue-memo fails; e2e suite instability) documented in
  qa-1.md and the tracker gate log; full gates are the reviewer's call.

## Design note for the reviewer (DELTA scope)

- `dqTitleLevel_` now lives in `src/features/shared/lib/title-level.ts` (pure)
  and is re-exported by `platform/identity` — all existing imports unchanged;
  adapters stays dependency-free. This was QA's "share one builder" option.
- `pwDirectory_` (adapters) mirrors `pwDirectory` (identity): titleLevel set at
  row-build, synthetic admin gets dqTitleLevel_('','admin')='manager'; the
  admins.forEach role mutation runs after build, so rostered admins keep
  position-derived level — exact parity with identity.
- Role-keyed access gates (requireRole, pwCanSignal_, pwCanChair_, caller
  checks) deliberately untouched — access axis stays on `role` per PLAN #5.

## Still open / needs user

- qa-7 LOW: stray root file `C:UsersAHMEDAppDataLocalTemps0301-vitest.log` — deferred.
- S07-01 real backfill + remote migration apply: NEEDS_APPROVAL (unchanged).
- qa-1.md non-blocking gaps: no component test for offqueue date input;
  webkit/firefox e2e console noise unattributed (pre-existing).

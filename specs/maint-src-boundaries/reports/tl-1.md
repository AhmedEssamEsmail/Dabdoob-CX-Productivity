# TL report 1: maint-src-boundaries (BUILD)

## Outcome
Dispatched and completed 45 of 51 mini-leaves. All PLAN gates pass on the
integrated tree. 5 leaves are `needs-split` (see below); S07-02 is blocked
behind one of them.

## Completed (see TRACKER.md for per-leaf evidence)
- S01 (PLAN #1) COMPLETE: `shared/lib/fetch-json.ts` created; 9 consumers
  repointed (S01-02..04); pv-shared export removed (S01-05).
- S02 (PLAN #2) COMPLETE: grid-slots.ts moved to
  `cx-productivity/lib/tph/grid-slots.ts`; consumers + test repointed;
  old shared/jobs/grid-slots.ts deleted.
- S03 (PLAN #3) 31/32: foundation (decl + vitest alias + stub) and all
  marking leaves S03-02..31 done — `import 'server-only'` across
  platform/jobs/vendor/migration/shared-lib + feature lib/jobs modules.
  Only S03-32 (tsx shim + client probe) remains.
- S04 (PLAN #4) COMPLETE: zero `as never` in QA dispatcher route; P params
  typed `Record<string, unknown>`; qaImportHistory via `Parameters<>`.
- S05 (PLAN #5) 5/6: status-validation, my-status, productivity-analytics,
  admin/config, admin/roster are thin routes over feature components.
  S05-01 (tph-grid) remains.
- S07-01 (PLAN #7 partial): eslint `no-restricted-imports` guard landed,
  lints clean (exempts jobs/env.ts + jobs/mirrors.ts).
- S07-02 (docs) blocked: depends on S03-32.

## needs-split -> RESHARD_NEEDED (checker cap minutes=10 vs LIMITS.md <=15)
| Leaf | Path | Violated limit | Remaining |
|---|---|---|---|
| S03-32 | spec/S03/32-probe-tsx-shim.md | minutes=15 > 10 | whole leaf |
| S05-01 | spec/S05/01-tph-grid.md | minutes=15 > 10 | whole leaf |
| S06-01 | spec/S06/01-auth-test.md | minutes=15 > 10 | whole leaf |
| S06-02 | spec/S06/02-qa-dispatcher-test.md | minutes=15 > 10 | whole leaf |
| S06-03 | spec/S06/03-security-spec.md | minutes=15 > 10 | whole leaf |
All five are LIMITS-compliant (<=15 min); they fail only the checker's
hard cap of 10. A one-word budget relabel (or PM ruling) unblocks them.

## Deviations
- S02-02 was dispatched before re-preflight: checker fails the `Delete:`
  Files verb (not Edit/Create/Generated). Work verified scoped (one file
  deleted, zero refs, tests pass). Kept, flagged.
- A concurrent session was editing shared/platform, cx-quality/server.ts,
  cx-queue/jobs.ts, cx-people/one-on-one-reminders.ts. Marking leaves on
  those files (S03-04/05/15/16/20) were deferred until its tree went
  clean, then dispatched normally. Baseline edits never reverted.

## Integration gates (PLAN commands, project root)
- `npx tsc --noEmit` PASS · `npx vitest run` PASS 53/1152 · `npx eslint .`
  PASS 0 errors (370 pre-existing warnings) · `npm run test:security`
  PASS 22/22 · `npx next build` PASS (thin routes present).
- `npm run test:e2e` NOT RUN — needs seeded live env/approval.

## Changed files (high level)
~100 files: new shared/lib/fetch-json.ts, cx-productivity/lib/tph/grid-slots.ts,
src/types/server-only.d.ts, tests/stubs/server-only.ts, 5 new feature
components + thin routes; `import 'server-only'` added to 89 modules;
eslint.config.mjs, vitest.config.mjs, route.ts/qa-shared.tsx typing.
Full per-leaf file lists: results/*.md + TRACKER.md.

## Notes for reviewers
- No shard asked for reviewer/debugger/architect roles; none spawned.
- PLAN #6 untested until S06 reshards land; fixture-only suites still in
  place (old tests still pass — gate above).
- `/tph` re-export untouched; golden-oracle paths preserved.

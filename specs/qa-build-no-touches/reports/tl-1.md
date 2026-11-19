# tl-1 — qa-build-no-touches FIX (debug-1, all rows blocking)

Verdict: BOTH blocking findings fixed and verified; all PLAN gates PASS.

## Changed files (reviewer DELTA scope)
- `src/features/cx-hub/lib/roster.ts` (+12): `dqSyncRoster_` manual-source
  branch (~line 367) now diffs `freshdesk_id`/`freshdesk_name`/`maqsam_name`
  and pushes a patch via `updates` (with `synced_at`) before returning —
  `source` stays 'manual', manual fields untouched. (dbg-1)
- `src/features/cx-quality/lib/engine-live.ts` (+2): `qeReadAgentRoster_`
  indexes each rec under `freshdesk_name || fd_name` in `byName`,
  first-writer-wins; `rec.name` unchanged. (dbg-2)
- `tests/platform/dq-hct-snapshot.test.ts` (+25): one test — manual row gains
  fd columns on sync while `source` stays 'manual'.
- `tests/quality/qe-performer-resolution.test.ts`: debugger-authored
  regression, untouched; now 3/3 pass (was failing pre-fix).
- Spec artifacts: `spec/fix-debug-1.md`, `TRACKER.md`, `results/debug1-0*.md`.

## Leaves
| Leaf | Finding | Status | Evidence |
|---|---|---|---|
| debug1-01 (dev) | dbg-1 | verified | vitest dq-hct-snapshot 8/8 |
| debug1-02 (dev) | dbg-2 | verified | vitest qe-performer-resolution 3/3 |

## Gates (final integration)
- `npx tsc --noEmit -p tsconfig.json` — PASS exit=0
- `npx eslint src/features/cx-quality src/features/shared/jobs` — PASS exit=0
- `npx vitest run src/features/cx-quality` — matches NO test files (tests live
  under `tests/`); ran equivalent `vitest run tests/quality
  tests/platform/dq-hct-snapshot.test.ts` — PASS 39/39 (10 files)
- `npx next build` — PASS exit=0 (logs/next-build.log)

## Notes
- Baseline dirty tree (other specs' WIP) recorded in TRACKER; untouched.
- Data note from debug-1: fd columns populate on next admin "Sync roster";
  optional one-off backfill SQL needs user approval — deferred, not assigned.
- No reviewer-shard requests in the findings; none ignored.

# TRACKER: qa-build-no-touches
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Mode: FIX — input `reports/debug-1.md` (every row blocking).
Fix spec: `spec/fix-debug-1.md`.

Baseline dirty tree (pre-existing, NOT ours — do not revert):
`M` specs/ui-shell-polish report PNGs; `M` src/app/styles/quality.css;
`M` src/features/cx-hub/components/hub-shared.tsx, overview-page.tsx;
`M` src/features/cx-quality/components/audit-queue-coverage.tsx, qa-shared.tsx;
`A` tests/quality/qa-cov-center.test.tsx;
`??` specs/next-security-upgrade/, specs/overview-single-refresh/,
specs/qa-build-no-touches/, specs/unified-page-format/logs/,
tests/overview-single-refresh.test.ts,
tests/quality/qe-performer-resolution.test.ts (debugger's regression test —
in scope as read/run, edited by debug1 owners only if their leaf says so).

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| debug1-01 | mini/fix-debug-1 | dev | none | 2/2/120/10 | PASS preflight | verified | results/debug1-01.md; +12l roster.ts, +25l test; vitest 8/8 |
| debug1-02 | mini/fix-debug-1 | dev | none | 1/1/15/10 | PASS preflight | verified | results/debug1-02.md; +2l engine-live.ts; regression 3/3 |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | typecheck | `npx tsc --noEmit -p tsconfig.json` | PASS exit=0 (logs/tsc.log) |
| 1 | lint | `npx eslint src/features/cx-quality src/features/shared/jobs` | PASS exit=0 |
| 1 | unit | PLAN's `vitest run src/features/cx-quality` matches no files (tests live in tests/); ran `npx vitest run tests/quality tests/platform/dq-hct-snapshot.test.ts` | PASS 39/39 (10 files) |
| 1 | build | `npx next build` | PASS exit=0 (logs/next-build.log) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| dbg-1: roster sync skips manual rows -> fd cols never populate | reports/debug-1.md | debug1-01 (dev) | fixed+verified | roster.ts:367 branch patches fd identity fields |
| dbg-2: byName never indexes freshdesk_name | reports/debug-1.md | debug1-02 (dev) | fixed+verified | engine-live.ts:136 fdName alias index |

## Blocked / needs user
- Optional one-off roster backfill SQL (debug-1 "Data/rollout notes") needs
  user approval; NOT required for correctness — deferred, not assigned.

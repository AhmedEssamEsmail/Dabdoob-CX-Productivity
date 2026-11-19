# tl-7: FIX round for reports/qa-3.md (qa-7 only, user-approved)

## Scope
- Approved finding: qa-7 LOW — dead `.grid-4`/`.grid-5` utility rules + media mentions in `src/app/refresh.css` (:177-178, 1180px block :181-183, 820px selector list :185-186). ux1-01 removed the last `grid-4` consumer; `grid-5` never had one.
- Fix spec: `spec/fix-qa-3.md#qa3-01` (1 mini leaf, files=1/actions=3/lines=10/min=5). Preflight: check_shards.py PASS + semantic PASS.
- Explicit constraints honoured: `grid-2`/`grid-3`/`cols-*` kept (live consumers: admin-config, admin-roster, overview, status-validation); `/` kicker stays removed (not touched).

## Leaves
| ID | Owner | Status | Evidence |
|---|---|---|---|
| qa3-01 | dev | verified | results/qa3-01.md — worker 14eb7b7a, single attempt, no stale |

TL-verified scoped diff (`git diff src/app/refresh.css`): `:root .grid-4`/`:root .grid-5` rules deleted, whole `@media (max-width:1180px) and (min-width:821px)` block removed (only held grid-4/grid-5), 820px selector list now `grid-2, grid-3, cols-32, cols-75`. No other file touched by the leaf.

## Gates (round qa3-fix)
| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS exit 0 (logs/gate-tsc-qa3.log empty) |
| `npx eslint .` | identical pre-existing baseline — 1 error tests/golden `any` @123 + 6 out-of-scope warnings; zero in refresh.css (logs/gate-eslint-qa3.log) |
| `npx vitest run` | 114/114 project files, 1471/1471 tests PASS; sole failed file = known stray reviewer probe `logs/ux-probe/frame-dark-rtl.spec.ts` (Playwright spec collected by vitest — PM-flagged, untouched) (logs/gate-vitest-qa3.log) |
| targeted | `grep -rn "grid-4\|grid-5" src/ tests/ e2e/ docs/` = 0 hits; `vitest run tests/css-form-guards.test.ts` = 22/22 (leaf run) |
| e2e | SKIPPED — dead-code removal, zero consumers repo-wide; no rendered diff possible. Last full e2e green: ux1-fix 85/85 on a tree differing only by this removal |

## Changed files (reviewer DELTA scope)
- `src/app/refresh.css` — net -7 lines in GRID block only
- `specs/unified-page-format/spec/fix-qa-3.md`, `results/qa3-01.md`, `TRACKER.md`, this report

## Status
- qa-7: verified fixed. No open findings from qa-3; TRACKER updated. No RESHARD/blocked items.
- Carried-over non-blockers (PM-owned, unchanged): stray ux-probe spec breaks vitest exit code; Next.js security-upgrade nudge (needs approval).

# TRACKER: qa-card-compact-strips
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree at start (untracked, not ours): `mockups/disputes-compact/`,
`specs/qa-card-compact-strips/`, `supabase/APPLY_MANUAL_20261109.sql`.

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | mini/- | dev | none | 1/3/70/8 | PASS | done | results/S01.md (worker wrote to repo-root results/); +28 lines append-only quality.css; tsc N/A (deps not installed at time) |
| S02 | mini/- | dev | S01 | 1/5/140/10 | PASS | verified | specs/.../results/S02.md; ctls-page.tsx ~111 lines churn; strip rows + qa-list + size=sm |
| S03 | mini/- | dev | S01 | 1/5/110/10 | PASS | verified | repo-root results/S03.md; disputes-page.tsx ~57 lines; <details>/<summary>/qa-detail + caps |
| S04 | mini/- | dev | S01 | 1/5/110/10 | PASS | verified | specs/.../results/S04.md; my-audits-page.tsx ~37 lines; <details> strip + qa-list x2 |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | typecheck | npx tsc --noEmit | PASS exit 0 (gates.log) |
| 1 | lint | npx eslint src/features/cx-quality src/app/styles | styles dir ignored by eslint config (exit 2, config artifact); src/features/cx-quality alone exit 0, clean |
| 1 | tests | npx vitest run | PASS 55 files / 1129 tests (gates.log) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|

## Blocked / needs user
- (none)

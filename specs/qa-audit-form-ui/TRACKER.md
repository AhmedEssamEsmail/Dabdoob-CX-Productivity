# TRACKER: qa-audit-form-ui
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Mode: FIX round 1 `reports/debug-1.md` + PLAN.md finding 4 (done); FIX round 2
`reports/qa-1.md` (done); FIX round 3 `reports/ux-1.md` — blocking MEDs ux-1,
ux-2 plus trivial LOW ux-4 per PM scope; ux-3/ux-5/ux-6 deferred.
Baseline dirty tree at start: `spec/fix-debug-1.md`, `TRACKER.md` (this file,
TL-authored); source tree clean except those.

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| fix-debug-1 | package/- | - | - | n/a | not dispatchable | done | spec/fix-debug-1.md; 4/4 children done |
| dbg1-01 | mini/fix-debug-1 | dev | none | 2/4/80/10 | PASS | verified | results/dbg1-01.md; vitest 2/2, tsc+eslint clean; churn ~45 lines |
| dbg1-02 | mini/fix-debug-1 | dev | dbg1-01 | 1/2/15/5 | PASS | verified | results/dbg1-02.md; targeted tests ok; churn ~8 lines CSS |
| dbg1-03 | mini/fix-debug-1 | dev | dbg1-02 | 1/1/3/5 | PASS | verified | results/dbg1-03.md; +1 rule |
| dbg1-04 | mini/fix-debug-1 | dev | dbg1-03 | 1/2/8/5 | PASS | verified | results/dbg1-04.md; ~4 lines CSS |
| fix-qa-1 | package/- | - | - | n/a | not dispatchable | done | spec/fix-qa-1.md; 1/1 children done |
| qa1-01 | mini/fix-qa-1 | test-engineer | none | 1/1/6/5 | PASS | verified | results/qa1-01.md; `type El` retyped w/o `any`; eslint/tsc/vitest green; churn ~5 lines |
| fix-ux-1 | package/- | - | - | n/a | not dispatchable | done | spec/fix-ux-1.md; 3/3 children done |
| ux1-01 | mini/fix-ux-1 | dev | none | 1/1/3/5 | PASS | verified | results/ux1-01.md; `#qa-when` gained `justify-self:start`; churn 1 line |
| ux1-02 | mini/fix-ux-1 | dev | ux1-01 | 1/1/3/5 | PASS | verified | results/ux1-02.md; `.qa-q .cx-select{inline-size:auto;min-inline-size:6.5rem}` @L26; churn 1 line |
| ux1-03 | mini/fix-ux-1 | dev | none | 1/1/2/5 | PASS | verified | results/ux1-03.md; answer Select `aria-required`; eslint+vitest green; churn 1 line |

Serialisation: dbg1 leaves + ux1-01 + ux1-02 all write
`src/app/styles/quality.css` -> strict Depends chain, one writer at a time.
ux1-03 writes `qa-shared.tsx` -> parallel-safe with ux1-01.

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| dbg1-02 | tests/quality | `npx vitest run tests/quality` | 11/12; FAIL `qe-fd-cache.test.ts` "logs cache failures to refresh_log" — PRE-EXISTING baseline failure (qeReadTicketDetail/refresh_log backend; untouched by this spec). Log: reports/qe-fd-cache.log |
| final | tsc | `npx tsc --noEmit` | PASS (exit 0) |
| final | eslint | `npx eslint src/features/cx-quality/components/qa-shared.tsx` | PASS (exit 0, 0 warnings) |
| final | tests/quality | `npx vitest run tests/quality` | 11/12 — only FAIL is pre-existing `qe-fd-cache.test.ts` (same as above). reports/final-gates.log |
| qa1-01 | eslint | `npx eslint tests/quality/audit-form-controls.test.tsx` | PASS (exit 0, 0 warnings) — TL re-verified |
| qa1-01 | tsc + vitest | `npx tsc --noEmit`; `npx vitest run tests/quality/audit-form-controls.test.tsx` | PASS exit 0; 2/2 (owner-reported, results/qa1-01.md) |
| ux-1 round | tsc | `npx tsc --noEmit` | PASS (exit 0) — reports/tl-3-gates.log |
| ux-1 round | eslint | `npx eslint src/features/cx-quality/components/qa-shared.tsx` | PASS (exit 0, 0 warnings) — reports/tl-3-gates.log |
| ux-1 round | tests/quality | `npx vitest run tests/quality` | 11/12 — only pre-existing `qe-fd-cache.test.ts` baseline failure — reports/tl-3-gates.log |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| dbg-1 `.qa-request` flex -> mismatched field sizes | reports/debug-1.md | dbg1-02 (dev) | fixed | `.qa-request` now auto-fit grid |
| dbg-2 answer/why `Seg` squeezed in `width:1%` cell | reports/debug-1.md | dbg1-01 (dev) | fixed | vitest 2/2 green post-fix |
| dbg-3 `#qa-when` full-width | reports/debug-1.md | dbg1-03 (dev) | fixed | `#qa-when{inline-size:auto}` added |
| plan-4 `.qa-score` oversized box | PLAN.md symptom 4 | dbg1-04 (dev) | fixed | `__num` -> `--cx-text-lg`, tight padding, flex baseline |
| qa-1 MED `no-explicit-any` test file :82 | reports/qa-1.md | qa1-01 (test-engineer) | fixed | `El.props` -> `Record<string, unknown>` + callable `onChange`; eslint exit 0 |
| ux-1 MED `#qa-when` no-op in grid `.cx-field` | reports/ux-1.md | ux1-01 (dev) | fixed | `justify-self:start` added; vitest no new failure |
| ux-2 MED selects collapse to 53px in `width:1%` cell | reports/ux-1.md | ux1-02 (dev) | fixed | intrinsic `inline-size:auto` + `min-inline-size:6.5rem` |
| ux-3 LOW dead `.qa-score` media declaration | reports/ux-1.md | — | deferred | LOW, out of PM scope |
| ux-4 LOW `aria-required` parity answer select | reports/ux-1.md | ux1-03 (dev) | fixed | `{...{ 'aria-required': 'true' }}` on answer Select; eslint/vitest green |
| ux-5 LOW `.qa-request` narrow fields on own rows | reports/ux-1.md | — | deferred | LOW polish, out of scope |
| ux-6 LOW blank empty `<option>` row | reports/ux-1.md | — | deferred | LOW, out of scope |

## Blocked / needs user
- (none)

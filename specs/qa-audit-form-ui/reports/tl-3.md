# tl-3 — FIX round for reports/ux-1.md (qa-audit-form-ui)

## Scope
Blocking MEDs ux-1, ux-2 + trivial LOW ux-4 (per PM task). LOW ux-3/ux-5/ux-6
deferred — recorded in TRACKER "Review findings".

## Leaves (spec/fix-ux-1.md — preflight PASS x3)
| Leaf | Finding | Files changed | Status / evidence |
|---|---|---|---|
| ux1-01 (dev) | ux-1 `#qa-when` no-op in grid `.cx-field` | `src/app/styles/quality.css` (L10) | done — added `justify-self:start`; results/ux1-01.md |
| ux1-02 (dev) | ux-2 selects collapse to 53px | `src/app/styles/quality.css` (new L26) | done — `.qa-form .qa-q .cx-select{inline-size:auto;min-inline-size:6.5rem}`; results/ux1-02.md |
| ux1-03 (dev) | ux-4 aria-required parity | `src/features/cx-quality/components/qa-shared.tsx` (~L931) | done — `{...{ 'aria-required': 'true' }}` mirrors why-select; results/ux1-03.md |

Waves: ux1-01 ∥ ux1-03 (disjoint files), then ux1-02 (serial writer on
quality.css). Actual churn: ~3 handwritten lines total — within budgets.

## Integration gates (reports/tl-3-gates.log)
- `npx tsc --noEmit` — PASS (exit 0)
- `npx eslint src/features/cx-quality/components/qa-shared.tsx` — PASS (0 warnings)
- `npx vitest run tests/quality` — 11/12; only failure is pre-existing baseline
  `qe-fd-cache.test.ts` ("logs cache failures to refresh_log" — backend,
  untouched by this spec; documented since dbg1-02).

## Reviewer DELTA scope for re-check
ux-1: `#qa-when` rule now `justify-self:start;inline-size:auto;max-inline-size:100%`.
ux-2: new rule `.qa-form .qa-q .cx-select{inline-size:auto;min-inline-size:6.5rem}`.
ux-4: answer `Select` in `AuditForm` now carries `aria-required="true"`.

## Notes
- No DB, no deps, no reviewer shards requested. No blocked items.
- Visual re-verification at 375/1024 belongs to the ux re-review gate (PM).

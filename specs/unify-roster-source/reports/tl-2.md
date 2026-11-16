# TL report 2 — unify-roster-source (FIX round for reports/qa-1.md)

## Status: COMPLETE — 3/3 actionable findings fixed; qa-1 stays blocked on approval

| Leaf | Finding | Owner | Files changed | Evidence |
|---|---|---|---|---|
| qa1-01 | qa-2 stray `nul` | dev | `nul` (deleted, repo root) | results/qa1-01.md; `git status --porcelain` no longer lists `?? nul` |
| qa1-02 | qa-3 dedupe masks case-variants | data-engineer | `scripts/ops/verify-hct-parity.mts` | results/qa1-02.md; `indexByEmail` keys on raw `String(r.email)` last-wins — mirrors roster.ts:285; blank = null/undefined/`''` only (production null-filter); new bounded `case-variants:` diagnostic in `main()` (per-side count + capped raw-key groups); variants now surface as only-sheet/only-table diffs -> exit 1 |
| qa1-03 | qa-4 probe eslint noise | dev | `scripts/ops/probe-sync-health.ts`, `scripts/ops/probe-aging-stale.ts`, `specs/qa-audit-form-ui/logs/ux-check.cjs` | results/qa1-03.md; `require('dotenv')` -> `import dotenv` + `dotenv.config` in both .ts probes; file-level `eslint-disable @typescript-eslint/no-require-imports` in ux-check.cjs (legit CJS); logic unchanged |

DELTA scope for re-review: `nul` (gone), `scripts/ops/verify-hct-parity.mts`,
`scripts/ops/probe-sync-health.ts`, `scripts/ops/probe-aging-stale.ts`,
`specs/qa-audit-form-ui/logs/ux-check.cjs`, `spec/fix-qa-1.md`, TRACKER/results.
No `src/`/`tests/` files touched — vitest delta unchanged.

## Gates (round 2, project root) — logs in results/gates/
- `npx tsc --noEmit`: PASS exit 0
- `npx eslint .`: PASS — **0 errors** (was 5, all in the probe files qa1-03
  fixed); 3 remaining warnings pre-existing in unrelated files
  (ux3-people-capture.mjs unused var, admin-page.tsx local/no-raw-controls)

## Still blocked / needs user
- qa-1 (HIGH): `npx tsx --tsconfig scripts/tsconfig.json scripts/ops/verify-hct-parity.mts`
  pre-merge — requires user-approved remote read. Now safe to run: qa1-02
  removed the case-variant masking the reviewer flagged.
- S02-01 migration remote apply stays merge-gated (auto-apply on merge to main).

## Notes
- Worker housekeeping: two owners wrote results to repo-root `results/`;
  TL moved them to `specs/unify-roster-source/results/` — no code impact.
- User's concurrent edits (`MM` staged+unstaged on quality.css,
  quality-analytics-page.tsx) observed during this round — not ours, left alone.
- No leaf requested reviewers/devops; none spawned per rules.

# TL report 2: maint-src-boundaries (BUILD resume, post-RESHARD)

## Outcome
8 of 9 remaining leaves completed. All PLAN gates pass on the integrated
tree. One leaf blocked by a spec defect; one leaf (S07-02) waits on it.

## Completed this round
- S03-32: `scripts/tsconfig.json` paths shim — `tsx` resolves `server-only`
  (verified via `tsx --tsconfig scripts/tsconfig.json`).
- S05-01: `tph-grid/page.tsx` thin route over
  `cx-productivity/components/tph-grid-page.tsx`; `/tph` re-export intact.
  PLAN #5 complete (all 6 routes thin).
- S06-01: real `shared/lib/auth.test.ts` (12 tests, real module + mocked
  seams) — replaces fixture-only suite.
- S06-02 + S06-04: real QA-dispatcher route tests in
  `src/app/api/__tests__/integration.test.ts` (11 tests: POST positional
  args, 404, malformed body, GET `?args=`/`?argN=`, apiError 401/403/500).
- S06-03 + S06-05: real authz `tests/security/security.spec.ts`
  (4 tests: 401 Unauthorized, requireRole 403, view-as write refusal 403,
  happy path).
- PLAN #6 complete.

## needs-split -> RESHARD_NEEDED
| Leaf | Path | Problem | Remaining |
|---|---|---|---|
| S03-33 | spec/S03/33-client-probe.md | SPEC DEFECT: probe dir `src/app/__svonly_probe__/` is a Next.js **private folder** (`_` prefix) — excluded from routing, never bundled, so the client-component probe cannot trigger the server-only error. Evidence impossible as specced. | Whole leaf; fix = routable dir (e.g. `src/app/svonly-probe/page.tsx`). Probe was cleaned up; nothing residual. |

## Blocked
- S07-02 (docs, tech-writer): depends on S03-33 — dispatch after reshard lands.

## Integration gates (round 2, project root)
- `npx tsc --noEmit` PASS · `npx vitest run` PASS 53 files / 1111 tests
  (count 1152→1111: fixture-only suites replaced by fewer real tests) ·
  `npx eslint .` PASS 0 errors (368 pre-existing warnings) ·
  `npm run test:security` PASS 4/4 · `npm run test:integration` PASS 11/11 ·
  `npx next build` PASS (all routes incl. /tph-grid present).
- `npm run test:e2e` NOT RUN — needs seeded live env/approval.

## Package status
S01 done · S02 done · S04 done · S05 done (6/6) · S06 done (5/5) ·
S03 32/33 (S03-33 needs-split) · S07 1/2 (S07-02 blocked by S03-33).

## Deviations
- S03-33 agent correctly stopped instead of self-expanding to a different
  probe path; deleted the private-dir probe; results/S03-33.md documents it.
- No reviewer/debugger/architect shards requested or spawned.

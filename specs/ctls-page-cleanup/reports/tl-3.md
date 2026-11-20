# tl-3 — FIX round for reports/ux-1.md (ctls-page-cleanup)

Input: `reports/ux-1.md` (Verdict FAIL, Open 0/0/1/3).

## Fix leaves dispatched
| Leaf | Finding | Owner | Status | Changed files |
|---|---|---|---|---|
| ux1-01 (`spec/fix-ux-1.md#ux1-01`) | ux-1 MED: ref lookup ignores `canClose` -> dead-end submit | dev | done | `src/features/cx-quality/components/ctls-page.tsx` (+1 line: `c.canClose &&` in `findOpenCtls` predicate, ~L37) |

Non-closeable open CTLs (another team's ticket in 'all' scope, shift_tls row
while off-shift) no longer match the ref lookup; they resolve to the existing
"No open CTL of yours matches" hint. Ref path now mirrors the per-row
"Open in the form" button gate; server.ts:1281 reject stays as defence in depth.

## Deferred (LOW per FIX rules)
ux-2 (empty-state copy under 'all'), ux-3 (shift-reason meta line, same root as
deferred qa-2), ux-4 (busy affordance during scope refetch — logged-only,
apply to both pages together if ever done).

## Integration gates (round 2)
- `npx tsc --noEmit` -> PASS (logs/tsc-r2.log)
- `npx vitest run tests/quality/qa-ctl-scope.test.ts` -> PASS 4/4 (logs/vitest-r2.log)
- `npm run lint` -> same baseline: 1 pre-existing error
  `tests/golden/queue-aggregates.test.ts:123` (no-explicit-any, untouched file)
  + 7 baseline warnings; changed file clean (logs/lint-r2.log)
- `npm run test:security` -> PASS 4/4 (logs/sec-r2.log)
- e2e/build: skipped per PLAN gates.

## Notes
- Worker's `results/ux1-01.md` was first written to project-root `results/`;
  TL moved it to `specs/ctls-page-cleanup/results/ux1-01.md`.
- No shards requested reviewer roles. No RESHARD_NEEDED, no blockers.
- DELTA scope for re-review: `ctls-page.tsx` `findOpenCtls` predicate only.

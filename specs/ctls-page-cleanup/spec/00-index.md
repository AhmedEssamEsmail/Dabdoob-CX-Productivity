# Spec index — ctls-page-cleanup

PLAN: `../PLAN.md` | Size gate: PASS

| Pkg | File | Outcome | Owner |
|-----|------|---------|-------|
| S01 | `S01.md` | CTL desk cleanup: history closeout migration + scoped/active CTL page | mixed |

## Children (all in `S01.md`)

| Leaf | Owner | Depends | PLAN criteria | Budget (files/act/lines/min) |
|------|-------|---------|---------------|------------------------------|
| S01-01 | supabase-expert | none | #1, #2 | 1 / 3 / 80 / 10 |
| S01-02 | dev | none | #3, #4(server), #5(server), #6 | 4 / 6 / 170 / 10 |
| S01-03 | dev | S01-02 | #4(client), #5(client) | 2 / 4 / 70 / 10 |

## Gates (PM-run, not shards)
- typecheck `npx tsc --noEmit` · lint `npm run lint` · unit `npx vitest run tests/quality/qa-ctl-scope.test.ts` · security `npm run test:security` (db flag)
- Review gates: QA + Security + UX/UI per PLAN.

## Notes
- S01-01 and S01-02 are independent (different files); S01-03 needs the S01-02
  row contract (`scope`, `canClose`) before dispatch.
- Migration auto-applies on merge to `main`; no manual remote run (AGENTS.md).

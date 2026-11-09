# FIX-08b: cron/integration Bearer gate fails closed + `Bearer undefined` regression test (batch B)
Kind: mini
ID: FIX-08b
Parent: -
Owner: dev
Depends: none
Criteria: sec-2 finding sec-4 (MED) — `Bearer undefined` passes 401 gate
Skills: none
Budget: files=7; actions=8; changed_lines=100; minutes=9

## Goal
Same fail-closed Bearer fix as FIX-08a for the remaining 6 routes (2 cron +
4 integrations), plus a regression test proving the literal header
`Bearer undefined` is rejected when `CRON_SECRET` is unset in production.

## Files
- Edit: `src/app/api/cron/job-tph-hourly/route.ts` | gate lines 15-18
- Edit: `src/app/api/cron/scorecard-nightly/route.ts` | gate lines 19-22
- Edit: `src/app/api/integrations/freshchat/route.ts` | gate lines 15-18
- Edit: `src/app/api/integrations/freshdesk/route.ts` | gate lines 5-8
- Edit: `src/app/api/integrations/gmail/route.ts` | gate lines 5-8
- Edit: `src/app/api/integrations/maqsam/route.ts` | gate lines 15-18
- Edit: `tests/jobs/routes.test.ts` | add fail-closed regression test

## Context
- `src/app/api/cron/job-data-tick/route.ts:11-14` | cronOk parity: `if (!secret) return process.env.NODE_ENV !== 'production' // fail-closed in production`
- `reports/sec-2.md` row sec-4 | attack: expected header = literal `Bearer undefined`
- `tests/jobs/routes.test.ts:86-92` | existing fail-closed regression test shape (routeNightly)
- `src/features/shared/lib/supabase.ts:10-26` | lazy proxy — importing gmail route is side-effect-free

## Contract
Route edits — identical to FIX-08a. In EACH route file replace:

```ts
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
```

with:

```ts
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // fail-closed in production; dev/no-secret mode still lets requireJobCaller gate the caller
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
```

No other route-file changes.

Test edit — in `tests/jobs/routes.test.ts`:
- Add `import * as routeGmail from '@/app/api/integrations/gmail/route'` next to
  the existing route imports.
- Add one test inside `describe('cron routes')`: `vi.stubEnv('NODE_ENV',
  'production')`, `delete process.env.CRON_SECRET`, then assert 401 for BOTH:
  `routeHourly.GET` and `routeGmail.POST` called with
  `new Request('http://localhost/x', { method: 'POST', headers: { authorization: 'Bearer undefined' } })`
  (GET for routeHourly). Also assert 401 with no authorization header for
  routeHourly. `vi.unstubAllEnvs()` at the end (beforeEach re-sets CRON_SECRET).
Out of scope: the 10 routes owned by FIX-08a, other test files, identity.ts.

## Actions
1. Apply the gate replacement in job-tph-hourly/route.ts.
2. Apply it in scorecard-nightly/route.ts.
3. Apply it in integrations/freshchat/route.ts.
4. Apply it in integrations/freshdesk/route.ts.
5. Apply it in integrations/gmail/route.ts.
6. Apply it in integrations/maqsam/route.ts.
7. Add the routeGmail import in tests/jobs/routes.test.ts.
8. Add the `Bearer undefined` fail-closed regression test (both routes, 401).

## Done when
- `grep -rn "Bearer \${process.env.CRON_SECRET}" src/app/api/cron/job-tph-hourly src/app/api/cron/scorecard-nightly src/app/api/integrations` -> 0 matches.
- New test asserts 401 for `Bearer undefined` under NODE_ENV=production with
  CRON_SECRET deleted, for one GET cron route and one POST integration route.
- `npx vitest run tests/jobs/routes.test.ts` -> all green.

## Verify
- Run: `npx vitest run tests/jobs/routes.test.ts` -> green; `npx tsc --noEmit` -> 0.

## Handoff
none. Write results/FIX-08b.md (<=10 lines); TL alone updates TRACKER.md.

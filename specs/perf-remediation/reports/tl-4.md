# tl-4 — FIX round for reports/sec-2.md (round 2 DELTA)

Input: `reports/sec-2.md` — 1 open finding, sec-4 (MED): 16 routes gated on
`authHeader !== `Bearer ${process.env.CRON_SECRET}``; with `CRON_SECRET` unset
the expected header is the constant `Bearer undefined`, so any internet caller
passes the 401 gate (and `requireJobCaller()` early-returns sessionless).

## Disposition
sec-4 is one root cause across 16 files > the 10-file leaf cap -> split into
two mini-shards by file group (preflight: check_shards.py PASS both; semantic
review within all LIMITS caps). Parallel wave, disjoint files.

| Leaf | Owner | Files | Result |
|---|---|---|---|
| FIX-08a | dev | 10 cron routes | done — results/FIX-08a.md |
| FIX-08b | dev | 2 cron + 4 integration routes + tests/jobs/routes.test.ts | done — results/FIX-08b.md |

## Changed files (reviewer DELTA scope)
- `src/app/api/cron/{analytics-aggregation,daily-layers,flag-detection,job-productivity-daily,job-quarterly-report,job-tph-past-days,meeting-reminders,missed-1on1-check,oo-reminders,task-reminders}/route.ts` (FIX-08a)
- `src/app/api/cron/{job-tph-hourly,scorecard-nightly}/route.ts`,
  `src/app/api/integrations/{freshchat,freshdesk,gmail,maqsam}/route.ts` (FIX-08b)
- `tests/jobs/routes.test.ts` — new `routeGmail` import + regression test
- `specs/perf-remediation/results/FIX-08a.md`, `FIX-08b.md` (FIX-08b's result
  was written to a stray root `results/` dir; relocated by TL, dir removed —
  also recovered earlier `FIX-04.md` from the same stray dir)

## Fix applied (uniform, all 16 routes)
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
Mirrors the `cronOk` fail-closed parity from FIX-05; non-prod no-secret stays
open (documented, accepted tl-3 assumption). Churn: 21 files, +144/-21 total
(includes prior uncommitted FIX-05..07 work; this round = 16 routes +8/-1 each,
test file +~10).

## Regression evidence
- `grep -rn "Bearer \${process.env.CRON_SECRET" src/` -> 0 matches.
- New test (tests/jobs/routes.test.ts): NODE_ENV=production + CRON_SECRET
  deleted -> `Bearer undefined` gets 401 on cron GET (job-tph-hourly) and
  integration POST (gmail); missing header -> 401.

## Integration gates (round 4, all run by TL)
| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS (0 errors) |
| `npx eslint .` | PASS (0 errors; 366 pre-existing warnings) |
| `npx vitest run` | PASS (54 files, 1123/1123 — +1 new test) |
| `npm run test:security` | PASS (4/4) |
| `next build` | PASS (154/154 pages) |

Logs: `specs/perf-remediation/logs/fix4-{tsc,eslint,vitest,security,build}.log`.

## Status
- sec-4: FIXED — every open row in sec-2.md resolved; 0 remaining findings.
- No needs-split, no blocked items; no reviewer agents spawned (per rules).
- Unchanged NEEDS_APPROVAL items (migration applies, app.settings provisioning,
  vercel.json deploy order) remain in TRACKER "Blocked / needs user".

# FIX-08a: cron Bearer gate fails closed when CRON_SECRET is unset (batch A)
Kind: mini
ID: FIX-08a
Parent: -
Owner: dev
Depends: none
Criteria: sec-2 finding sec-4 (MED) — `Bearer undefined` passes 401 gate
Skills: none
Budget: files=10; actions=10; changed_lines=110; minutes=9

## Goal
In 10 cron routes the Bearer check `authHeader !== `Bearer ${process.env.CRON_SECRET}``
becomes fail-closed: when `CRON_SECRET` is unset in production every caller gets
401 (the literal string `Bearer undefined` must NOT authenticate). Outside
production the missing-secret case stays open, mirroring the `cronOk` parity.

## Files
- Edit: `src/app/api/cron/analytics-aggregation/route.ts` | gate lines 18-21
- Edit: `src/app/api/cron/daily-layers/route.ts` | gate lines 19-22
- Edit: `src/app/api/cron/flag-detection/route.ts` | gate lines 19-22
- Edit: `src/app/api/cron/job-productivity-daily/route.ts` | gate lines 15-18
- Edit: `src/app/api/cron/job-quarterly-report/route.ts` | gate lines 16-19
- Edit: `src/app/api/cron/job-tph-past-days/route.ts` | gate lines 15-18
- Edit: `src/app/api/cron/meeting-reminders/route.ts` | gate lines 11-14
- Edit: `src/app/api/cron/missed-1on1-check/route.ts` | gate lines 11-14
- Edit: `src/app/api/cron/oo-reminders/route.ts` | gate lines 11-14
- Edit: `src/app/api/cron/task-reminders/route.ts` | gate lines 11-14

## Context
- `src/app/api/cron/job-tph-hourly/route.ts:15-18` | the exact current shape in every file
- `src/app/api/cron/job-data-tick/route.ts:11-14` | cronOk parity: `if (!secret) return process.env.NODE_ENV !== 'production' // fail-closed in production`
- `reports/sec-2.md` row sec-4 | exact fix: hoist + null-check first
- `src/app/api/cron/job-nightly-aggregates/route.ts:9-13` | reference cronOk copy

## Contract
In EACH listed file replace this exact block:

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

No other line changes; imports untouched (NextResponse already imported).
Out of scope: the 5 `cronOk` routes (already fixed), the 6 routes owned by
FIX-08b, tests, identity.ts, job internals.

## Actions
1. Apply the gate replacement in analytics-aggregation/route.ts.
2. Apply it in daily-layers/route.ts.
3. Apply it in flag-detection/route.ts.
4. Apply it in job-productivity-daily/route.ts.
5. Apply it in job-quarterly-report/route.ts.
6. Apply it in job-tph-past-days/route.ts.
7. Apply it in meeting-reminders/route.ts.
8. Apply it in missed-1on1-check/route.ts.
9. Apply it in oo-reminders/route.ts.
10. Apply it in task-reminders/route.ts.

## Done when
- `grep -rn "Bearer \${process.env.CRON_SECRET}" src/app/api/cron` -> 0 matches
  in the 10 listed files.
- Each file still compiles standalone: `npx tsc --noEmit` -> 0 errors.
- No other edits in the files (gate block only).

## Verify
- Run: `npx tsc --noEmit` -> exit 0; `npx eslint src/app/api/cron` -> no new errors.

## Handoff
none (sibling leaf FIX-08b owns the remaining routes + regression test).
Write results/FIX-08a.md (<=10 lines); TL alone updates TRACKER.md.

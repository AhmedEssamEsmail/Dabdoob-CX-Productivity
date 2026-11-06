# Wave 2 — Golden-test coverage + jobs/scheduling audit (6 parallel WPs)

> Oracle method: `tests/golden/helpers-oracle.ts` (`createOracle(FILES)` loads legacy `.js` verbatim in node:vm; `callLegacy` vs port on fixtures; `expectSame`). Bare filenames resolve across all `*_deprecated` dirs. Per-module fakes follow `hub-fakes.ts`/`desk-fakes.ts`/`ops-fakes.ts`/`fixtures-people.js` patterns. Do NOT edit `helpers-oracle.ts` or the shared `LEGACY_FILES` constant — define your own `oracle()` file list per `PORTING-GUIDE.md`.
> Depends on: W0 (suite green), WP-00 (fakes fixed).

## WP-20 — operations golden tests

- Fix `tests/golden/ops-fakes.ts` (WP-00 may land first — coordinate via tracker; if WP-00 already fixed, extend).
- Write `tests/golden/ops.test.ts`: oracle `Trackers.js` (+ `Config/Options/Repo/Stores/Auth/Popups/Mailer/PeopleCore/WorkCore/WorkCalendar` fixtures). Cover: `getTrackersPage` shapes, `addTrackerField`/`updateTrackerField` type coercion per field `type` (text/number/date/dropdown/bool — read the legacy coercion code verbatim), `access_mode` enforcement, record CRUD ordering + `required` validation, `createTracker` defaults, `setupTrackers` seed idempotence.
- Gates: oracle suite green; tsc clean.

## WP-21 — desk golden tests

- Write `tests/golden/desk.test.ts`: oracle `TlPerformance.js`, `KpiLogs.js`, `MailDesk.js`, `TlSnapshots.js`, `KpiPayout.js`, `Mailer.js`, `WorkCalendar.js`, `PeopleCore.js`.
- Cover: TL performance week computation (team scores, `TLP_AREAS_SEED` responsibilities, expectation/outcome_rating, queue hours from `tlp_queue_daily`, mails-to-answer counts), `tlp_rating_zones` 0–100 → Below/Meets/Exceeds boundaries (test every edge), KPI logs invariants (one unplanned-leave entry = one leave on first day; OL exclusion semantics), KB tracker requested_at/done_at/accurate, OTD monthly entry, mail-desk SLA breach flags + approval decide/reset with `mail_approval_dry_run` true.
- Gates: oracle suite green; tsc clean.

## WP-22 — queue golden coverage extension

- `tests/golden/queue.test.ts` exists — audit its coverage vs `Scheduler.js`, `Heatmap.js`, `AgingHelp.js`, `QueueCore.js` internals. Add missing cases: `dqSlotState_` open/due/missed/submitted edges (read-delay 20 min, open-before 15, due-after 30), aging band edges (`aging_bands_h` 12 edges → `--cx-age-0..6`), check-in idempotence, scheduler shift defaults + cover splits (7/1/1 vs 3/3/3), swap/time-off decide flow, heatmap Erlang headcount per interval + prior-regression + upload parsing.
- Gates: extended suite green.

## WP-23 — people golden coverage extension

- Extend `tests/golden/{people,scorecard,kpi}.test.ts` where thin: `KpiPayout.js` every band edge (prod 95/86/80, qual 97/93/90, fcr 90/85/80, probation edges, OL halving, leave window 61/92 days — exactly-on-boundary cases), 1:1 lifecycle (schedule→alerts→log→missed→popup), soft-delete cascade+restore, `pwFit_` task fit/risk, working-day arithmetic with holidays + days off, scorecard `scAggregate_`/`scDerive_` derivation incl. FCR input.
- Gates: extended suite green.

## WP-24 — jobs/heartbeat/scheduling audit

- Produce `audits/jobs.md`: HB_PLAN 23 jobs × {implementation file, cron route, `dqStep_`/`hbBeat_` name, cadence source, schedule location (vercel.json | pg_cron SQL | none), heartbeat row written}.
- Resolve open items from §6: `queue_snapshot` 4×/day + `daily_report` + `fc_messages` — folded or missing? `jobTphHourly` vercel :05/:55 (30-min) vs legacy 15-min — propose the D-SCHED-consistent fix (pg_cron `*/15`, or document deviation).
- Draft `supabase/migrations/0NN_pg_cron_schedule.sql` — full `cron.schedule` batch per `BLOCKED_TASKS.md` B5 job list, using `net.http_get('<URL>/api/cron/...')` + `CRON_SECRET` header as placeholders (`{{APP_URL}}`, `{{CRON_SECRET}}` tokens so it's apply-ready once WP-50 lands). Do NOT apply remotely.
- Verify `mail_dry_run` + `qa_*`-only policy + notify templates (`platform/mail.ts`, `platform/notify.ts`) vs `Mailer.js`/`Notify.js`.
- Gates: doc committed; SQL compiles syntactically (no remote apply).

## WP-25 — fake-test retirement

- `src/features/cx-productivity/lib/{tph.test.ts,productivity.test.ts}` are the old literal-assertion suites. Confirm `tests/golden/{tph,productivity}.test.ts` cover the same cases (map a few spot cases), then delete the fake files. If a case exists only in the fake suite, port it to the golden file first.
- Sweep for any other `.test.ts` under `src/features/` that assert on literals instead of importing app code.
- Gates: vitest still green after deletion; no `.test.ts` inside `src/features/` unless it imports real module code.

## Wave-2 exit criteria

ops + desk golden suites exist and pass; queue/people suites extended; `audits/jobs.md` + pg_cron SQL draft committed; zero literal-assertion tests remain.

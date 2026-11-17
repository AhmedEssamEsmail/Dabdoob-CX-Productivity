# RESUME — qa-live-sheets-freeze (wave 1)

Project root: `C:\Users\AHMED\KPIs\CX-Hub` · Spec dir: `specs/qa-live-sheets-freeze/`
Read first: `PLAN.md` (+3 amendments), `DECISION.md`, `TRACKER.md`, this file.

## Task
Literal Google-Sheets read freeze (exceptions: `qa_audits` tab of
`1sOFoYdrbKorQ0WOA6bgJT1ROpzPxq2N-7oWnjhsxm3w`; HCT `Sheet1` in manual
`syncRosterNow` only; FD activity workbook) + finish QA queue-engine live flip +
quality-page perf incident. User approved remote DB writes, pg_cron scheduling,
and push+deploy after gates.

## State (as of 2026-11-16 ~19:15 UTC)
- ALL wave-1 leaves DONE: S01 freeze guard+grandfather list+CI scan gate · S02
  dbbook synthesizers (8 tabs) · S03 env.ts de-sheeted · S07 dq_hct recreate
  migration + snapshot write + `jobRosterSync` manual-gated · S08 job-qa-engine
  route DB-only (qaQueueStep_ + direct qaReconcileQueueLog_ import + ctlReminders;
  qaHistoryStep_ dropped) · S09 scoped pg_cron migration (5 jobs) · S11 aux_spans
  recreate + prod_assumptions seed script + admin config control.
- Review gates: QA PASS (r2) · Security PASS (r2; sec-2/sec-3/sec-5 LOW deferred)
  · Data PASS (r2, reports/data-2.md; data-4/data-5 LOW deferred) —
  **remaining gate: performance-engineer only** (perf flag).
- Gates: tsc 0 · eslint 0 (5 pre-existing warnings) · vitest 1449/1450 — sole
  fail `tests/quality/qe-fd-cache.test.ts` = parallel-workstream file, NOT ours.
- Remote `qe_migration_done`=true already set. `qa_engine_live` was already TRUE.

## Remaining steps (in order)
1. Spawn `performance-engineer` mode FULL round 1 (perf flag) — PLAN.md +
   reports/tl-5.md paths, write `reports/perf-1.md`. FAIL -> TL FIX + DELTA.
2. After all gates PASS — REMOTE APPLY (user pre-approved):
   a. Provision GUCs: `env -u SUPABASE_ACCESS_TOKEN npx supabase db query --linked`
      piping via stdin: `ALTER DATABASE postgres SET "app.settings.app_url" =
      'https://dabdoob-cx-productivity.vercel.app';` and same for
      `app.settings.cron_secret` = CRON_SECRET from `vercel env pull` (prod;
      NEVER print the value). Verify `Target:` line first.
   b. `env -u SUPABASE_ACCESS_TOKEN npx supabase db push --linked` — applies 4
      pending migrations: 20261116202604_recreate_dq_hct, 20261116202809_pg_cron_scoped_wave1,
      20261116204115_recreate_aux_spans, 20261116175742_drop_dead_and_mirror_only_tables.
   c. Verify: `SELECT jobname,schedule,active FROM cron.job` shows 5 new jobs;
      `cron.job_run_details` after next run.
3. Prod seed: `npx tsx --tsconfig scripts/tsconfig.json scripts/ops/seed-prod-assumptions.ts`
   with real prod env (.env.production has real GOOGLE_*; .env.local is placeholder).
4. Commit (workflow: one commit, user asked) → push → poll Vercel deployment to
   READY (`vercel ls dabdoob-cx-productivity --scope ismails-projects-f1e5c1e6`).
5. Delete all `reports/qa-*.md`, mark TRACKER `verified`, append lessons.

## Hand-backs owed to user's parallel workstream (they own src/features/cx-quality/**
and src/app/api/qa/[action]/route.ts — do NOT edit)
- `dq_hct` consumer contract: `results/S07-02.md` — repoint `qaActiveEmails_`
  (server.ts ~L1811) to `public.dq_hct`; empty table → null (fail-open).
- `server.ts:383` sheet fallback now throws SheetsFreezeError (dead path once live).
- `dqReadHct_()` without `{manualHct:true}` now logs violation + throws;
  `scripts/ops/verify-hct-parity.mts` needs updating on their side.
- `qe-fd-cache.test.ts` failure is theirs.

## Wave-2 backlog (deferred, spec'd in DECISION.md)
scorecard/heatmap/tlqueue de-sheeting · FCR verdict source · FD_AUX upstream
(FUTURE: daily email-attachment ingestion from user's mailbox — user asked to
hold aux_spans for it) · freshchat message pairs · strict-mode flip of the
grandfather list · sec-2/sec-3 LOWs · data-4 docstring.

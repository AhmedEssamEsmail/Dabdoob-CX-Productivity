# PLAN: qa-build-missing-agents
Type: bugfix   Status: draft
Date: 2026-11-20   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Symptom: Admin clicked "Build the queue now" (live engine, day mode) on 2026-11-20 (quota week W2026-11-15, weekStartsOn=Sunday). Seven roster agents received **zero** new samples even though their 20-audits/week quota was NOT reached (current-week counts from the Agents-by-week grid: Abdelsamad 12, Adel 10, Maria 10, Eman 16, Yasser 14, Shorouk 5, Shirin 10). Affected agents (email → roster name):
- abdelsamad.mohamed@dabdoob.com → Abdelsamad Mohamed Abdelsamad Youssef
- adel@dabdoob.com → Adel Sharif Shorhabil Ahmed
- maria.mamdouh@dabdoob.com → Maria Mamdouh Youssif Hanna
- eman.abdelhamied@dabdoob.com → Eman Abdelhamid Ibrahim Mgahed Badran
- yasser.anwar@dabdoob.com → Yasser Anwar Othamn Eissa
- shorouk.ehab@dabdoob.com → Shorouk Ehab Abdo Abdelrahman
- shirin.abuagla@dabdoob.com → Shirin Abuagla Mustafa Hamadelnil

Expected: any quota agent with remaining weekly slots AND eligible fresh tickets gets samples; agents legitimately skipped get an accurate reason. Suspicion: agents are being skipped/mis-counted in `qeDraw_` (fresh-pool blocking, `weekTaken`/`extraTaken` over-count, agent-name canon key mismatch between `qe_queue_log`/`qa_queue` and the pool, or `minTouches`/`requireCustomerFacing` filtering), OR the build wrote rows to `qe_queue_log` that `qaImportQueue_` then dropped. Diagnose first — do not guess.

## Success criteria
1. Root cause identified and proven from the build's own diagnostics (`qe_outcomes` row for the run, per-agent `r` reason + `f`/`w`/`s`/`k` fields) and/or a deterministic repro.
2. Fix applied so eligible under-quota agents receive samples on the next build (or a correct, user-visible reason when they truly have no eligible tickets).
3. A regression test exists that fails on the old behaviour and passes on the fix.
4. Gates pass: typecheck, lint, unit.

## Scope / Non-goals
In: queue build path (`engine-live.ts`, `engine.ts`, `server.ts` import path), quota/weekTaken counting, agent canon keys, qe→qa import.
Out: schema changes, quota policy changes (20/week stays), UI redesign, backfilling today's queue for those agents (separate ask), pushing/deploying.

## Risk flags (y/n)
arch n · db n (reads Supabase tables; no schema change expected) · data **y** (quota/KPI counting logic) · auth n · external-api n (Freshdesk/Sheets reads already exist) · ui n · perf n · deps n · tests y (regression test required) · docs n · deploy n
Review gates: QA (always) · Security: skip (no authz/input change) · Data: **run** · Performance: skip · UX/UI: skip

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`  e2e: `npm run test:e2e`  build: `npx next build`

## Conventions (<=10 lines: workflow.md + relevant lessons)
- Forbidden: package.json/lockfile, `.env*`, `cx-kpis-*.json`. No new deps.
- Remote DB read-only SELECT inspection of qe_outcomes/qe_queue_log/qe_builds/qa_queue: APPROVED by user 2026-11-20. No writes, no DDL.
- Supabase CLI: linked project `uugeyulccyytvgcabzzx` (production) — always `--remote`, check `Target:`; `env -u SUPABASE_ACCESS_TOKEN` only if calls 403.
- Legacy-parity repo: keep `qe*`/`qa*` function names verbatim; parity, not improvement.
- Leaf result files go under `specs/qa-build-missing-agents/results/`, never repo-root `results/`.
- Git Bash `> nul` makes a literal file — use `> /dev/null`. There's already a stray `nul` file at KPIs root; don't add more.
- Heavy output → log file under `specs/qa-build-missing-agents/logs/` + bounded tail.

## Research notes
- `qeDraw_` builds `byAgent` only from `fresh` = pool minus `blocked` (ticketId|agent already in log, any non-expired state) minus `blockedTickets` (any 'passed' ticket). An agent whose recent tickets were all already logged gets `r='none'`.
- `qePartitionLog_` counts `weekTaken[a][c]` for log rows whose `ISO Week` === current weekKey and state !== 'passed' (includes 'expired' rows! verify — `st` is read AFTER possible re-write to 'expired', and expired rows still count toward weekTaken since only 'passed' is excluded).
- `extraTaken` (from `qaRequestedTaken_`, server.ts:2205) adds request/non-ticket qa_queue items since weekStart into `weekTaken[a].Requested`, reducing slots — keyed by `qeCanonAgent_(q.agent_name)`; canon-key mismatch vs pool `agent` names would mis-attribute.
- `qeSlotsFor_`: day-mode slots = min(offerPerDay, offerPerWeek − taken); slots≤0 → r='week'/'today', counted `atQuota`.
- `qe_outcomes` table: per-build JSON `{a:{<agent>:{e,i,t,d,f,p,w,o,c,r,s,y,k}}, m, cf, lb}` — the per-agent reason codes: none|min|cf|week|today|capped|pool|channel|ok.

## Key pointers
- src/features/cx-quality/lib/server.ts:2302-2318 — `importQaQueueNow` (the button); calls `qeBuildQueue('day', …, {keepKeys, extraTaken})` then `qaImportQueue_`.
- src/features/cx-quality/lib/server.ts:2194-2214 — `qaStartedLogKeys_` (in_progress keep) and `qaRequestedTaken_` (extraTaken).
- src/features/cx-quality/lib/engine-live.ts:673-682 — `qeSlotsFor_` slot math.
- src/features/cx-quality/lib/engine-live.ts:685-719 — `qePartitionLog_` blocked/weekTaken/todayTaken rules.
- src/features/cx-quality/lib/engine-live.ts:767-878 — `qeDraw_` agent filter + per-agent draw + outcome reasons.
- src/features/cx-quality/lib/engine-live.ts:912-942 — `qeBuildQueue` orchestration; writes `qe_builds` + `qe_outcomes`.
- src/features/cx-quality/lib/engine.ts:597-778 — `qeSelectForAgent_`, `qeQuotaFor_`, `qeWeekKeyFor_`, `qeCanonAgent_`.
- `qaImportQueue_` in server.ts — qe_queue_log → qa_queue import (find exact lines; check agent/email matching & filters that could drop the 7 agents).
- Tests dir: tests/quality/ (qe-* tests exist; add regression test there).

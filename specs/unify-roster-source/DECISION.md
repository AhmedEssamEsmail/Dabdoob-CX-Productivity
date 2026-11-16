# DECISION: unify-roster-source
Context: `roster` is the one people table; `dq_hct` is a Postgres mirror of HCT `Sheet1` the app can already read via `readSheet` (same SA creds proven in-prod by /api/admin/migrate). Plus 8 dead V1 remote tables user-approved for drop. Constraints: verbatim legacy names stay; migration auto-applies on merge; auth = roster feeds every role check.

## Options
**Q1 — how `dqReadHct_` reads Sheet1:**
- A) `readSheet` + local projection in roster.ts — move `sheetToDb`/`columns`/`require`/`upsertOn` consts from mappings/hct.ts; project + require-filter + last-wins email dedupe (~30 lines; backfill-hct-headcount.mts:84-112 is a verbatim precedent). Pros: zero engine API churn, byte-identical record stream to what dq_hct held. Cons: mapRow-lite duplicated.
- B) Export a generic `readMappedSheet(mapping)` from engine.ts — reuses real mapRow/coercion. Cons: new public engine API for one consumer; global col sets (INT/NUM) risk coercing text cols (position precedent, script line 81-83); mapping ownership stays split.
- C) Keep a thinner mirror — rejected; contradicts the goal.

**Q2 — `qaActiveEmails_` re-point (PLAN §4b):**
- A) `roster.active` — rejected: roster holds only in-scope sections; dq_hct holds out-of-scope (Data Entry) agents who DO have QA audits → silent narrowing of the Active filter.
- B) Call `dqReadHct_()` itself + `cacheGet/cachePut` (repo in-process cache, already imported in server.ts), TTL 600s, key `qa_hct_active`; on throw/empty → null (fail-open = today's missing-store path). Same deduped stream preserves ANY-row-`dqHctActive_` semantics exactly.
- C) Sheet read, no cache — rejected: ~700ms paced Sheets call per QA cache-miss, quota risk.

Decision: **Q1=A, Q2=B** — simplest options that preserve the exact record stream both consumers saw from dq_hct (require + dedupe parity), no new deps, fits existing lazy-import + repo-cache patterns.

## Design
- `dqReadHct_` (roster.ts): `await import('@/features/shared/migration/engine')` → `readSheet(SPREADSHEETS.hct,'Sheet1')` → project via moved consts → drop rows missing email|name → Map last-wins on email. Sheet/API failure propagates as the honest error (replaces 'Roster master is not connected'); empty sheet → [] → existing 'No HCT rows matched'.
- mappings/hct.ts deleted; engine.ts drops its import/`HCT_MAPPINGS`/`HCT_DECISIONS` refs. `wanted={dq_hct}` on /api/admin/migrate becomes a tolerated no-op. `scripts/ops/backfill-hct-headcount.mts` deleted (whole purpose = dq_hct upsert; sync covered by button+cron).
- `qaActiveEmails_` (server.ts:1754): cache-first → `dqReadHct_()` in try/catch → build set via `dqHctActive_` → cachePut JSON 600s → null on error/empty. Doc comment updated.
- Drop migration (`npx supabase migration new`): `DROP TABLE IF EXISTS public.{dq_hct,headcount,team_structure,schedule,days_off,weekly_schedule,tls,tlp,md}` — exact names only (`tlp`≠`tlp_*`, `schedule`≠`one_on_one_schedule`, `days_off` table≠`roster.days_off`), NO CASCADE so hidden dependents fail loudly instead of silently dropping. Historical migrations untouched.
- `env.ts:318` `headcount` variable: leave as-is (cosmetic; renaming a JobEnv key is churn without payoff).

## Risks & mitigations
- Sheet read adds latency/quota to sync+QA paths — paced readSheet + 600s caches; QA page payloads already 600s-cached.
- Duplicate-email/active-vs-last divergence — dedupe replicates upsertOn parity before the adapter sees rows.
- Sheets outage → sync errs honestly (heartbeat error), QA fails open unfiltered (same as today).
- Migration drops a still-referenced remote object — no CASCADE → loud failure pre/post merge; remote apply user-gated.

## Rollback / migration path
Revert code commit (roster.ts, server.ts, engine.ts, deletions); recreate `dq_hct` from 20261109131140/20261112142701 migrations + rerun HCT_MAPPINGS backfill if dropped in prod. The 8 V1 tables have no recreate scripts — restore only via PITR; acceptable (verified dead 2026-11-16).

## Impacts on PLAN
- §4b resolved: shared `dqReadHct_` + 600s cache + fail-open null (not roster.active).
- Add criterion: projection applies require[email,name] + last-wins email dedupe (upsertOn parity).
- Test strategy: mock `@/features/shared/migration/engine` `readSheet` via importOriginal spread (keeps real `headerKeys`/`SPREADSHEETS`; 'server-only' already resolves under vitest); fake serves raw 2D Sheet1 fixtures → single fixture drives BOTH oracle and port (hand-transcribed portHct at test:375-385 becomes derived); 'refuse without dq_hct' → 'refuse when readSheet throws' + 'empty sheet → No HCT rows matched'; remove 'dq_hct' from hubDb.missing; qa-pushdown test still fails open (no fixture → throw → null → unfiltered).
- Verification leaf: before merge, one-off diff — project live Sheet1 vs current `dq_hct` rows (deleted script's logic is the harness).

## Open questions
None blocking.

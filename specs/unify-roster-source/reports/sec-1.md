# sec report - unify-roster-source - round 1 (FULL)

Verdict: PASS
Open: 0/0/0/3

## Scope reviewed
Task diff (unstaged tree): `src/features/cx-hub/lib/roster.ts`, `src/features/cx-quality/lib/server.ts` (S01-02 portion + interleaved qa-active-toggle edits), `src/features/shared/migration/engine.ts`, `src/app/api/qa/[action]/route.ts`, `supabase/migrations/20261116171029_drop_dead_v1_tables.sql`, tests (hub-fakes.ts, hub-people-holidays.test.ts, qa-pushdown.test.ts, dq-hct-active.test.ts), `scripts/ops/verify-hct-parity.mts`, `probe-sync-health.ts`; deletions: `mappings/hct.ts`, `backfill-hct-headcount.mts`. Unchanged-but-relevant: `src/app/api/admin/migrate/route.ts`, `src/app/api/hub/roster/route.ts`, `identity.ts:requireJobCaller`, `20261106151132_remote_reconcile.sql`.

## Verified (no finding)
- **Roster lockout (auth flag)**: `dqReadHct_` (roster.ts:264-287) propagates Sheets errors and returns `[]` on empty/require-filtered input; `dqSyncRoster_` throws when `res.rows` is empty (roster.ts:310-316) *before* the deactivation loop — fail-closed identical to the old missing-table path. Deactivation still limited to `source==='hct'` rows (roster.ts:365-376).
- **Gates**: `syncRosterNow` keeps `requireRole(['admin'])` + `assertWritable` (roster.ts:410-411); `jobRosterSync` keeps `requireJobCaller()` (roster.ts:423, no route exposes it yet); `/api/admin/migrate` unchanged — `x-migration-key` fail-closed (route.ts:14-18) + `assertWritable`; `tables:['dq_hct']` is now a tolerated no-op via `wanted` filtering. No `requireRole`/`assertWritable`/`requireJobCaller`/`qaRequireRole_` line removed in the diff (diff grep clean).
- **qaActiveEmails_** (server.ts:1767-1799): reachable only from role-gated handlers (`['admin','tl','agent']`+auditor / `['admin','tl']`); cache is the in-process Map (repo.ts:35) — no new persistence; fail-open null only un-filters pages for already-authorized viewers (DECISION Q2=B).
- **Sheets creds**: same `GOOGLE_SERVICE_ACCOUNT_*` + `spreadsheets.readonly` scope the migrate route already uses (engine.ts:104-118); `readSheet` is dynamically imported inside `dqReadHct_`; no secrets in code/tests.
- **DROP migration** (20261116171029): 9 exact-name `DROP TABLE IF EXISTS public.<t>`, no CASCADE — dependents fail loudly; `tlp`/`schedule`/`days_off` collisions avoided; historical migrations untouched. Positive: `headcount` et al. currently carry `app_all USING(true) WITH CHECK(true)` (remote_reconcile.sql:211-216) — fully anon/authenticated-readable via PostgREST *today*; the drop removes that exposure (dq_hct was deny-all anyway).

| ID | Sev | file:line | Attack scenario | Exact fix | Owner |
|---|---|---|---|---|---|
| sec-1 | LOW | src/features/cx-quality/lib/server.ts:553 | `setQaAuditorGrant` eligibility widened from `qaImportablePeople_` (CX agents + title-TLs) to ANY `p.active` roster person — an admin can now grant Audit Desk (read all audits + submit audits) to out-of-scope/ineligible staff. Admin-gated and deliberate-looking (qa-active-toggle spec), but a real privilege-scope widening. | Confirm intent in qa-active-toggle spec; if unintended, restore `qaImportablePeople_` check or require `via`. | dev |
| sec-2 | LOW | scripts/ops/verify-hct-parity.mts:138-139 | Diff output prints raw field values incl. `contactNumber` (mobile), `gender`, `code` plus emails to stdout — PII lands in terminal scrollback/CI logs if run there (capped 25, values clipped to 40 chars). | Redact `contactNumber` (and any PII col) in the `diff` print line; keep counts only. | data-engineer |
| sec-3 | LOW | src/features/cx-quality/lib/server.ts:1782 | New live Google Sheets read on auditor-reachable paths (agent auditors via getQaQueuePage): Sheets outage/misconfig silently un-filters QA pages (fail-open null, DECISION-documented); adds shared Sheets-API quota dependency at ≤1 read/600s. | None required (accepted design); consider logging cache-miss failures once for observability. | dev |

## Not verified / assumptions
- Live-data parity (qa-1) is QA-owned: sheet quirks vs stored `dq_hct` text is exactly what `verify-hct-parity.mts` must prove pre-merge — still unrun pending user-approved remote read. If it exits 1, the new read path changes roster mutations (lockout/deactivation blast radius) — treat merge as blocked.
- Migration remote apply is merge-gated (auto-applies on merge to main); DROP is destructive — the 8 legacy tables may still hold V1 data, but they are also currently world-readable via `app_all`; user approved the drop.
- `getQaAccess`/`setQaAuditorGrant`/`active`-param changes in server.ts belong to the concurrent qa-active-toggle spec (user's edits); reviewed for interference only — sec-1 flagged since it ships on this tree.
- `probe-sync-health.ts`/`probe-aging-stale.ts` are untracked scratch (read-only selects, keys from env, no secrets printed); `ux-check.cjs` is a spec artifact — kept out of findings per scope.
- No `npm audit` run — no manifest/lockfile changes (deps flag n).

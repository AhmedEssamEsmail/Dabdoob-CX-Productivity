# sec report - perf-pushdown - round 1 (FULL)

Verdict: PASS
Open: 0B/0H/0M/4L

Scope: uncommitted worktree diff vs HEAD (90 files, +2026/-734) covering all
perf-pushdown leaves incl. tl-1/tl-2/tl-3 FIX rounds. Deep review on every
server-side file touching auth, queries, caches, routes and the new migration;
pattern scan (dangerouslySetInnerHTML/eval/innerHTML/env/redirect) on all added
lines — zero hits. UI-only tsx, test, docs files: surface-scanned.

| ID | Sev | file:line | Attack scenario (1-2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| sec-1 | LOW | src/features/cx-people/lib/scorecard-server.ts:210 | `from`/`to` are interpolated into a raw PostgREST `.or()` string (`and(date.gte.${from},...)`). Only caller today passes `'sc_daily'` (different branch) with `scDateOk_`-validated dates, so the branch is dead — but the exported helper is unsafe-by-default for any future `'sc_behaviour'` caller: a crafted `from` containing `,`/`)` could rewrite the filter. Same surface at cx-quality/lib/server.ts:106 (`f.or` passthrough; callers pass constants only). | Inside `scReadRange_`, throw unless `/^\d{4}-\d\d-\d\d$/` matches `from` and `to` before building the `.or()` string (or assemble via `and()` params). | dev |
| sec-2 | LOW | src/app/api/prod/analytics/route.ts:28 | Cache key `prod_an\|week\|email\|full` omits `user.role`. Non-admin scope depends on role (tl vs agent) + roster; a tl→agent demotion within the 120 s TTL serves the prior wider-scope payload to that user. Per-user key prevents cross-user leakage; this is a stale-scope edge only. | Add `${user.role}` to the key. | dev |
| sec-3 | LOW | scripts/perf-profile.mjs:13 | Committed fallback password `E2E-cx-local-2026!` for admin fixture `e2e.admin@dabdoob.com`. Pre-existing documented convention (e2e/users.ts:10, seed-users.mjs:32, e2e/README.md) — risk only if the fixture is ever seeded outside local/staging. | None required; confirm seeding stays local-only (no change vs convention). | dev |
| sec-4 | LOW | src/features/shared/platform/repo.ts:205 | `readAllPaged` loops `for (let from = 0; ; from += pageSize)` with no page cap; a table receiving concurrent appends can keep returning full pages indefinitely → long-running request (self-DoS on auth'd endpoints). | Cap iterations (e.g. 200 pages / 200k rows) and throw/log on overflow. | dev |

Verified clean (evidence):
- AuthN/Z: every touched route keeps server-side `requireRole`/`checkAdminAuth`/`viewAsGuard`/`assertWritable` before data access (api/tph/*: cases:42, page:15, run-step:15, slots:14, tasks:42, touches:22; list-sheets:8; analytics:17). `getAgingPage` agent-scope filter retained (cx-queue/lib/pages.ts:~47). `getQaMyAuditsPage`/`getQaMyAuditorKpis` filter on server-derived `user.email` (server.ts:1028,1690). `kpiLogRemove` logged_by/admin check kept after the pushed-down read (kpilogs.ts:164).
- identity.ts: `roleForEmail` `.eq('email',...)` parameterized; ilike fallback still ends in exact `normEmail` JS match — wildcard input can't match a different user. `pwDirectory` wrapped in React `cache()` = per-request dedupe only, no cross-request state. Admin synthesis moved from `by` to `lookup()` — same effective role resolution (qa1-04 invariant tested).
- Caches: `live|name` (dqCachedLive) holds role-agnostic aggregate tables, invalidated in flushWrites (env.ts:421-426). `qa_sc1:`/`qa_an7:`/`qa_cov3:` keys = version+params; output identical for the admin/tl gate — no per-user data under shared keys. No `'use cache'` on user-scoped data.
- Injection: all pushed-down filters use parameterized builder methods (`.eq/.in/.is/.gte/.lte`) with constant column names; `columns:` args are constants; `qaRowsWhere_` or-string is a constant literal (`interaction_at.is.null,interaction_at.eq.`).
- Migration `20261111083859_add_prod_window_hist_date_index.sql`: single `CREATE INDEX IF NOT EXISTS` btree — no RLS/policy/security-definer impact; non-destructive (pending user-approved apply per tl-1).
- eval('from') removed (prod/analytics.ts:291) — closes a deliberately-preserved crash; `secrets`: none added (perf-profile password is the established fixture pattern); no manifest/lockfile changes → npm audit N/A; error responses still generic (`{error: m}`), table/key names only in logs.

Not verified / assumptions:
- `queue_submissions` (one-on-ones-page.ts:578) exists in DDL with `id`; order column resolves via PK_OVERRIDES→'id' — functional parity owned by QA.
- `roleForEmail` `.eq` is case-sensitive vs prior `ilike`: callers pass normEmail'd input (precondition: 0 non-lower roster emails) — de-escalation-only failure mode if a caller ever passes mixed case.
- Remote apply of the new index NOT done (NEEDS_APPROVAL); no RLS/policy/view changes exist in this diff to apply the supabase RLS checklist against.
- `readStoreFiltered`/`readAllPaged` swallow DB errors to `{rows:[],exists:false}` by design — unchanged semantics.

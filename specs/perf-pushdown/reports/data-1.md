# data report - perf-pushdown - round 1 (FULL)

Verdict: FAIL — unit gate is red on this checkout (5 deterministic memo-test failures,
contradicting recorded round-6 evidence); plus three data-correctness edge findings.

Open: 0B / 1H / 3M / 1L

## Reconciliation

- Fixture parity re-run (independent): `npx vitest run tests/perf` -> **104/109**; full suite
  `npx vitest run` -> **1287/1292** (output reviewed then logs removed per output-budget).
  ALL data-parity fixtures green: scorecard-range `date:''`/`date:null` vs `legacyFilter`,
  stores-filter gte/lte superset asserts, qa-pushdown, prod-analytics 4/4 (admin `full=true`
  -> 200, `cal.idle['3']===4`), tph-store windows, queue-pages, job-preload bounds,
  dq-live-cache + flush-invalidate, identity-roster 6/6. Tolerance: byte-parity; deltas 0.
- Code-level: every `PK_OVERRIDES` key is backed by a unique constraint / remote-verified pkey
  (`migration_hardening.sql:45-58`, `dedupe_uniques`, `docs/perf/pk-drift-evidence.md`) -> total
  page order -> `readAllPaged` cannot dup/skip; sc_daily (1153) now returns count rows, not 1000.
- prod analytics: JS hist bound `String(r.date) < inp.weeks[0]` (analytics.ts:293) equals the SQL
  window bound `gte('date', weeksFrom)` (route.ts:52-55); cache key `prod_an|week|email|full`
  is user+scope keyed. `or` form `date.is.null,date.eq.,and(...)` is a strict superset of the
  legacy `d===''`+range guard.

## Findings

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| data-1 | HIGH | `src/features/cx-productivity/components/tph-grid-views.tsx:211`, `src/features/cx-quality/components/audit-queue-page.tsx:225-226` | 5 memo tests fail deterministically (vitest 1287/1292; reproducible 2-file re-run). tl-2 recorded 1292/1292 with both files green (`logs/qa1-gate-vitest.log:40,74`) -> regression landed after the round-6 gate. Deps invalidate on identity: `[d, missingMap]` (whole `d`) and `[C, f]`/`[sPassed, g]` (`f`/`g` re-created per render). No wrong numbers — but PLAN C10 "all gates green" fails and the P-19 memoization claim is unverified. | Narrow `missingItems` deps to the fields `We(d,…)` consumes; stabilize `f`/`g` (useMemo/useCallback); re-run `npx vitest run` to 1292/1292. | dev |
| data-2 | MED | `src/features/cx-hub/lib/aggregates.ts:169,374`; `src/features/cx-queue/lib/server.ts:78-79`; `pages.ts:236` | `eq`/`in` on `slot_date` matches raw text, but the consumer normalizes `dqKeyPart_('slot_date', …).slice(0,10)` (queue-core.ts:103) — a stored `'YYYY-MM-DDT…'`/`'dd/mm/yyyy'` row passes the guard yet is dropped by SQL -> check-ins read "missed", snapshots missed. App writes ISO (pages.ts:232) but migrated/remote rows were never precondition-counted (T0 covered only sc_daily dates + roster case). | Remote count: `select count(*) from queue_submissions where slot_date !~ '^\d{4}-\d{2}-\d{2}$'` (same for `queue_snapshots`, `agg_snapshots_today`); if >0 widen the bound or normalize on write. | supabase-expert |
| data-3 | MED | `src/features/cx-queue/lib/jobs.ts:70-76`; `src/features/shared/platform/stores.ts:90` | `dqRewrite_` rewrites `agg_queue_now`/`agg_snapshots_today`/`aging_open_tickets`/`agg_inflow_*`/`agg_agent_*` via direct `db()` and never evicts `live|<table>` — only `env.flushWrites` does (env.ts:422). Post-refresh, `dqCachedLive` serves stale rows up to 45 s (legacy `cache_stamps` invalidated on write). | `cacheRemove('live|' + table)` inside `dqRewrite_`. | dev |
| data-4 | MED | `src/features/shared/jobs/env.ts:642-666` | One bulk `upsert` carrying duplicate key tuples -> "cannot affect row a second time" matches `/conflict/` -> delete+insert fallback inserts BOTH dup rows (no unique constraint) or aborts the job (with constraint). Legacy loop was last-wins; `memoUpsert` dedupes only the memo, not `op.rows`. | Dedupe `op.rows` last-wins per key tuple (`tuplesOf` pattern) before the upsert. | dev |
| data-5 | LOW | `src/features/shared/platform/repo.ts:323-332` | `updateRows` batch path selects `*` `.in(keyField, keys)` unpaginated — >~1000 existing matches hit PostgREST max-rows; missed keys return `null` and their updates are silently skipped. All current callers are UI-scale (<100 keys) — latent. | Page the select via `readAllPaged` or chunk `keys`. | dev |

## Not verified / assumptions

- No remote SELECTs run (approval scope was S01-01's); reconciliation is fixture + DDL/code level.
  `slot_date` formats (data-2) and the roster-email-case precondition are remote-unknown.
- Cross-referenced, not re-filed: sec-1 (or-string interpolation, scorecard-server.ts:210),
  sec-2 (`prod_an` cache key omits role — tl->agent demotion stale-scope), sec-4 (unbounded
  `readAllPaged` page loop).
- Other bounded text-date columns (`prod_flags.date`, `fcr_*`, `prod_tph_*`, `qe_queue_log.
  queued_date`) are consistent: guards compare the same raw strings the SQL compares; only the
  `slice(0,10)` normalizing seam diverges (data-2).
- `env.ts` upsert delete+insert fallback is non-atomic — same non-transactional shape as the
  legacy sheet writes; accepted parity, noted.
- `prod_window_hist` 126 rows: new `idx_prod_window_hist_date` migration file pending
  user-approved apply (tl-1 NEEDS_APPROVAL); correctness unaffected.
- `roleForEmail` `.eq('email')`: all callers pass `normEmail`'d input (callback:27,
  currentUser via viewas normEmail'd target) — case-sensitivity de-escalation only, as sec-1 noted.

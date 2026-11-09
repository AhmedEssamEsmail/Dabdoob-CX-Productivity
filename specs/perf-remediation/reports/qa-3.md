# qa report - perf-remediation - round 3 (DELTA)

Verdict: **FAIL** — 1 MED open (queue-aging status filter is narrower than the
in-memory semantics it replaced). All tl-3..tl-6 fixes verified; gates green.

Open: 0 BLOCKER / 0 HIGH / 1 MED / 3 LOW

Scope this round: tl-3 (FIX-05/06/07), tl-4 (FIX-08a/b), tl-5 (FIX-09..14),
tl-6 (FIX-15..19) changed files only.

Checks run (exit codes; logs in `specs/perf-remediation/logs/qa3-*.log`):
- `npx tsc --noEmit` -> 0 (qa3-tsc.log, empty)
- `npx vitest run` -> 0, 55 files / 1128 tests (qa3-vitest.log)
- `npx eslint .` -> 0 errors / 366 warnings — same baseline as qa-1/qa-2 (qa3-eslint.log)
- `npm run test:security` -> 0, 4/4 (qa3-security.log)
- `next build` -> exit 0, "Generating static pages (154/154)", no error lines (qa3-build.log:8-16)
- `npm run test:e2e` -> not run (needs dev server + seeded auth; same limitation as prior rounds — PM gate)

## Prior findings — all verified fixed

| Finding | Status | Evidence |
|---|---|---|
| sec-1 MED `cronOk` fail-open | FIXED | 5 routes now `return process.env.NODE_ENV !== 'production'` when `CRON_SECRET` unset (job-data-tick:13, job-tl-queue, job-qa-engine, job-nightly-aggregates, desk/job/mail). `grep "if (!secret) return true"` -> 0. Regression test asserts 401 in prod (routes.test.ts:87). |
| sec-4 MED `Bearer undefined` on 16 routes | FIXED | Uniform `!secret -> prod 401 / else-if header!==Bearer -> 401` block in all 16 files; `grep "Bearer \${process.env.CRON_SECRET"` -> 0. New test covers cron GET + integration POST + missing header. |
| sec-3 LOW fire-and-forget `net.http_get` | FIXED | Same (unapplied) migration adds `cxh-job-data-tick-health` `7-59/15` — newest `net._http_response` within 20 min must be clean-200 else `RAISE EXCEPTION`; NOT-FOUND covered; sole-pg_net-caller assumption commented; unschedule guard covers both jobs; ARCHITECTURE.md updated. |
| sec-2 LOW `updateRows` lost-update | FIXED | `patchByKey` sends `{keyField, ...patch}` only (repo.ts:236); `out` still returns merged rows; constraint-fallback verbatim. Test asserts payload excludes unpatched columns. |
| data-1 BLOCKER mixed upsert key-sets | FIXED | Groups rows by sorted patch-key signature -> one homogeneous upsert per group (repo.ts:240-253). Stamps applied pre-grouping so signatures stay uniform. Test asserts per-call uniform key-sets. |
| data-2 MED dedupe keep-wrong-survivor | FIXED | `a.id < b.id` keep-highest (migration 20261108204952:19), matching memoUpsert LWW + the queue_submissions block (untouched, already `updated_at` LWW). |
| data-3 LOW refresh_log wrong index | FIXED | `idx_refresh_log_started_at (started_at)` replaces (job,finished_at); matches the unfiltered `ORDER BY started_at DESC LIMIT 300` reader. |
| data-4 LOW roster upsert assumed unique | FIXED | New unapplied migration `20261108234911_roster_email_unique.sql`: dedupe keep-highest-id + `ctid` fallback for the 001 email-PK shape + `roster_email_uidx` IF NOT EXISTS. |
| data-5 LOW `keyOf` concat collision | FIXED | `JSON.stringify(keys.map(k => r[k] ?? null))` in env.ts:292 + mirrored stub; ('ab','c')/('a','bc') regression test passes. |
| data-6 LOW popups cache key case | FIXED | `POPUPS_POLL_KEY + normEmail(email)` (popups.ts:130); mixed-case invalidate test added. |
| perf-1 qa_audits full scans | FIXED | `qaRowsWhere_` (eq/in/is/gte, missingOk, empty-`in` -> []) bounds all 7 cited sites; `in`-sets verified exact (open ctls only in submitQaCtl — matches `qaFindOpenCtls_` `status==='open'` filter, core.ts:345; `shown` disputes; `mine` ctls; month-01 bound is a superset of `qaDisputeStats_`'s month filter, core.ts:415). |
| perf-2 tickets full scan in `buildQueueAggregates_` | FIXED w/ caveat | `.or(status.in + created_at.gte + resolved_at.gte)` bound = bizTz today-1d 00:00 UTC — strict superset of the `isToday` counters' window (jobs.ts:85-108). See qa-1 below. |
| perf-3/4 prod routes unbounded | FIXED | intervals + daily-layers: `gte('date', now-31d)` when no `date` + `.limit(5000)`. flags: `.or('decision.eq.pending,date.gte.'+decidedFrom)` — stacked PostgREST `or`s AND, giving `(scope) AND (pending OR decided>=30d)`, matching the L44 docstring and L91/L100 filters. |
| perf-5 prod_daily_layers full scan | FIXED | `.gte('date', today-45d)`; `dqAgentPerf_` horizon is mtd+30d ≤45d — worst case today=1st needs prior-month-01 (~31d). Verified at core index.ts:766-775. |

## Regression / scope check
- Working-tree diff = tl-2 files (qa-2 reviewed, uncommitted) + tl-3..6 lists + PLAN/TRACKER bookkeeping. No edits outside scope; no forbidden files (package.json, lockfile, .env*, cx-kpis-*.json); no new deps.
- `updateRows`: missing keys still `out.push(null)` and never reach `patchByKey` — no partial-row INSERT path; upsert on existing rows = UPDATE of patched cols only.
- `submitQaCtl` restructure: `auditIds` = open-ctl ids (+ resolved ctlId's) before `qaFindOpenCtls_` — exact coverage; `row: Row|undefined` flow verified.
- flags route `.neq('decision','void')` still applies globally to both or-groups.
- `dqTicketsReadOr_` handles `opts.open` as array or CSV; quotes+strips `"`; `now` defaulted at jobs.ts:115 before use.
- Test quality: new tests assert recorded query-builder calls / upsert payloads — would fail without the changes. `updateRows` env-var hygiene note below.

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| qa-1 | MED | src/features/cx-queue/lib/jobs.ts:92-104 | `dqTicketsReadOr_` emits only raw/lower/upper per configured status, but `dqBuildAging_` accepts `st.trim().toLowerCase()` (index.ts:597). Stored statuses like `'Waiting on Customer'` vs config `'waiting on customer'` (variants: `waiting on customer`,`WAITING ON CUSTOMER` — Title-Case missed), `'oPen'`, or `'Open '` (trailing ws) pass the old check but are excluded server-side when >1d old -> silently dropped from queue aging for the ticket's whole open life. | Emit case-insensitive terms instead: push one `status.ilike.<v>` or-term per status (PostgREST ilike covers every case form), or add title-case + trimmed variants with the residual documented. | dev |
| qa-2 | LOW | src/features/shared/platform/repo.ts:242 | Signature `Object.keys(patch).sort().join('')` can collide (`['a','bc']`->`'abc'` = `['ab','c']`) — same bug class just fixed in env.ts; would regroup non-uniform key-sets into one upsert, re-exposing the data-1 failure. Needs fictional column names on one table — near-zero probability. | `JSON.stringify(Object.keys(patch).sort())` | dev |
| qa-3 | LOW | repo root + specs/perf-remediation/ | Stray files from FIX runs: `nul` (root + spec dir, 0-byte), `tsc-FIX17.log`, `tsc-fix18.log`; prior `.qa-tmp/` note still open. Untracked, would dirty any commit. | Delete strays (or gitignore logs) before commit. | dev |
| qa-4 | LOW | tests/jobs/routes.test.ts:89-99 | `delete process.env.CRON_SECRET` is not restored (only NODE_ENV via `vi.unstubAllEnvs()`); if CRON_SECRET is ever set in the test env it bleeds into later tests. Harmless today (env unset). | Save/restore around the test or `vi.stubEnv('CRON_SECRET','')` + adapt the `!secret` path. | test-engineer |

Not verified / assumptions:
- `getQaMyAuditsPage` `eq agent_email=user.email` is exact-match vs the old `normEmail()` JS compare — safe because audit writes normalize (`normEmail(q.agent_email)`, server.ts:755) and `user.email` is session-normalized; any historical case-variant `agent_email` rows would now be missed (data-quality edge, not a code bug).
- intervals/daily-layers `.limit(5000)` + 31d default window: intended bound; any consumer fetching with no `date` param expecting full history is silently truncated (none found in-scope).
- `npm run test:e2e` not run (PM/release gate).
- pg_cron tick + health job behaviour unverifiable until the migration is applied (NEEDS_APPROVAL, file-only); `7-59/15` syntax and `net._http_response` column usage are correct on inspection.
- dedupe/unique migrations remain FILE-ONLY; case-variant `roster.email` pairs are not dups under `roster_email_uidx` (exact `email`, not `lower(email)`) — acceptable since app upserts `dqCleanEmail_`-normalized values.

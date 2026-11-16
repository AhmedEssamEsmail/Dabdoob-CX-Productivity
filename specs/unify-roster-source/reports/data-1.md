# data report - unify-roster-source - round 1 (FULL)
Verdict: PASS
Open: 0/0/0/1

Reconciliation: sheet-vs-table parity (`logs/hct-parity.log`, user-approved remote read): sheet 51 rows indexed 51 vs table 51/51; only-sheet 0, only-table 0, blank-email 0, case-variants 0/0; field diffs = 2, both `.status` (`mariam.almotairi@`, `nada.alamshani@`: sheet "Resigned" vs mirror "Current"). Delta = stale-mirror drift, not a read-path defect — sheet is HR source of truth; expected post-merge effect is exactly those 2 rows flipping `active=false`/`employment_status='Resigned'` on next sync, shrinking isCxAgent_/qaActiveEmails_ populations by ≤2. Tolerance: exact key universe, field diffs explainable.

## Semantics audit (git diff vs HEAD, working tree)
- `dqRosterFromHct_` (roster.ts:189-261): **byte-unchanged**. Scope filter `dqInScope_` (section ∈ roster_scope), `people` manager-resolution pool built from ALL records incl. out-of-scope, `seen` email dedupe, aliases — all preserved.
- `dqSyncRoster_` (roster.ts:299-406): **not in diff**. role_override/tl_override, DQ_SYNC_KEEP_MANUAL blank-protect, `source==='hct' && !incoming && wasActive` deactivation, `dqLogRun_` warn/ok + error path via jobRosterSync, `dq_last_roster_sync` write — identical.
- `dqReadHct_` (roster.ts:271-287): `readSheet(SPREADSHEETS.hct,'Sheet1')` (id `1LtUZbF4…` literal, engine.ts:39) → FORMATTED_VALUE strings; 15-col projection = retired mappings/hct.ts verbatim ('direct repporter' misspelling kept; '#N' dup-header side table never read); `''`/undefined→null matches mapRow; require [email,name]; last-wins `String(email)` Map = upsertOn parity. Errors propagate (fail-closed sync, same as old missing-table throw).
- `qaActiveEmails_` (server.ts:1767-1798): reads whole Sheet1 — out-of-scope sections (Data Entry) still in universe, **no silent narrowing** (PLAN 4b honored). ANY-row `dqHctActive_` + 600s `qa_hct_active` cache + fail-open null = DECISION Q2=B.
- KPI/agent-count definitions unchanged: `isCxAgent_` (active && position==='Customer Experience Agent', identity.ts:39-43), `qaImportablePeople_`/`qaQuotaAgents_`, `qaHeadcount_` (roster fd fields, server.ts:317), `JobEnv.headcount` = roster rows (env.ts:318). No metric formula touched — only source freshness.
- Drop migration 20261116171029: 9 exact-name `DROP TABLE IF EXISTS`, no CASCADE; `tlp`/`schedule`/`days_off` collisions avoided; merge-gated.
- No live refs: `dq_hct`/`headcount` zero executable hits in src/tests (comments only); HCT_MAPPINGS out of MODULE_MAPPINGS; `/api/admin/migrate` `wanted` Set makes `tables:['dq_hct']` a no-op (route.ts:32-36, engine.ts:355).

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| data-1 | LOW | scripts/ops/verify-hct-parity.mts:42 | Parity normalizes `String(v ?? '')` — cannot distinguish null vs '' per cell. Immaterial: dqRosterFromHct_/dqHctActive_ normalize both identically via `String(v||'')` | None required; note only if parity re-run as regression | data-engineer |

Not verified / assumptions:
- Parity is point-in-time; sheet edits after the run flow straight to next sync (by design — sync reconciles).
- Date-typed cells: prod `values.get` returns FORMATTED_VALUE strings, so `hiringDate instanceof Date` branch is test-fixture-only; lwd Date handling unreachable in prod but correct if it ever fires.
- Gate claims (tsc PASS, eslint 0 errors, vitest 35/35, e2e 4/4) taken from tl-2/qa-2 logs — not independently re-run.
- UV_HANDLE_CLOSING line in parity log = tsx teardown artifact after output completed (per qa-2); run itself finished, exit 1 by design (any diff).

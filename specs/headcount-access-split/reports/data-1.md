# data report - headcount-access-split - round 1 (FULL)

Verdict: FAIL
Open: 0/0/2/3

Reconciliation:
- Headcount rule (PLAN #6): `isCxAgent_` = `active` && `position === 'Customer Experience Agent'` (exact, trimmed, case-sensitive) — identity.ts:36-43; truth table pinned tests/platform/directory-title.test.ts:81-92. Every live agent surface verified on it: kpilogs.ts:82,140 · tph/page.ts:106 · tlqueue.ts:465 · qaQuotaAgents_ server.ts:585 · qaCoverage_ pure.ts:544 (pre-filtered by qaImportablePeople_ :312) · agents list server.ts:1505.
- Expected post-backfill counts (sheet ground truth, PLAN:49): 16 CX Agents; tls()=4 (incl. admin-access CX TL); qaImportablePeople_=20 (16 agents+4 TLs); CX Manager/Head-of excluded. NOT verified against live DB — backfill still NEEDS_APPROVAL (dry-run: 51 upserts; position=51, code=46, gender=51, contactNumber=45 non-null; 53 data rows -> 51 upserted = require/dedupe drop, consistent).
- Mirror mapping (hct.ts): `code`->HR ID, `contactNumber`->mobile, `gender`, `position` covered; Sheet1 A:S only; `require:[email,name]` + last-wins email dedupe = engine parity (engine.ts:255-269). Migration cols match adapter keys verbatim.
- Offqueue date: `qaCleanInteractionDate_` (pure.ts:56) -> `'yyyy-MM-dd`; submit branches on `q.source==='offqueue'` (server.ts:759); form renders required `type="date"` (qa-shared.tsx:826); `qaWhen_`/`qaScoreDate_`/`qaHasInteraction_` all accept the date-only value (analytics.ts:151-162). Calibration path correctly keeps datetime (server.ts:1568). Unit-pinned tests/quality/qa-interaction-date.test.ts.
- refresh_log fix: migration adds submitted_by/at; appendRows stamps both (repo.ts:268) -> dqLogRun_ (jobs.ts:40) unblocked.

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| data-1 | MED | src/features/cx-productivity/lib/tph/write.ts:47 | `tphCheckAgent_` write gate still access-keyed (`role!=='agent'&&'specialist'`) while the TPH people grid uses `isCxAgent_` (page.ts:106). Non-agents (CX Manager defaulting role='agent' via dqRoleFor_; Enablemen Specialist) can write TPH rows invisible in the grid but read by `eligible`/touches; an agent-titled person with role_override is wrongly rejected. | `if (!p || !isCxAgent_(p)) throw` — TphStore dir already carries `position` (page.ts:119,149). | dev |
| data-2 | MED | src/features/shared/lib/adapters.ts:528-529 vs src/features/shared/platform/identity.ts:219 | NULL `roster.active` (nullable `BOOLEAN DEFAULT TRUE`, 20261030163812:19) is **active** under `pwDirectory`/`roleForEmail` (`!== 'false'`) but **inactive** under `pwDirectory_`/`dqActiveTlEmails_`/`getRosterAdmin`/`isCxAgent_` (`=== 'true'`/`!!`). Same row: signable + shown active, yet missing from tlqueue team rows (tlqueue.ts:599 uses adapters impl) and TL lists. | Unify the predicate (recommend `!== 'false'` to match DEFAULT TRUE); optionally `ALTER COLUMN active SET NOT NULL` after backfilling NULLs->true. | dev (+supabase-expert) |
| data-3 | LOW | src/features/shared/lib/adapters.ts:542-552 | `pwDirectory_` inserts non-rostered config admins into `by`; `pwDirectory` deliberately keeps `by` roster-only (identity.ts:233-234). `Object.keys(by)` enumerations differ between the two impls (current consumers filter by titleLevel -> no live impact). | Keep `by` roster-only in adapters too; resolve synthetic admins inside `person()`/`name()` like identity's `lookup()`. | dev |
| data-4 | LOW | src/features/cx-productivity/lib/tph/index.ts:1255,1294 | Legacy `tphPeople_`/`tphCheckAgent_` copies remain role-keyed; no src callers (golden-oracle seam) but any future caller gets pre-split semantics. | Re-point to `isCxAgent_` or delete the unused exports. | dev |
| data-5 | LOW | src/features/cx-hub/lib/roster.ts:154-158 | `dqHctActive_` = `status==='current'` AND `lwd` blank/'-'; PLAN #6 writes `status='Current'` only — a Current-with-LWD row drops from headcount silently. Legacy verbatim, likely intended; definition not recorded and sheet LWD state unverified. | Document the LWD guard in the criterion; at backfill, confirm none of the 16 Current CX Agents carries an LWD. | data-engineer |

Not verified / assumptions:
- No live DB access this round — counts reconciled against PLAN's sheet probe + dry-run log + test pins, not a recomputed SELECT. Post-backfill spot-check: `SELECT position, count(*) FROM roster WHERE active GROUP BY position` should show CX Agent=16, TL=4, Manager=1, Specialist=1.
- `roster_scope` config value (CX section filter) not inspected — dqInScope_ is verbatim; Data Entry rows stay out of roster per PLAN:49.
- `hct_role`/`hct_tl_email` are never refreshed on the sync update path (not in `fields`, roster.ts:291) — override bookkeeping base stays first-synced; pre-existing, no headcount impact.
- Backfill leaves `dq_hct.synced_at` stale (engine parity — engine never stamps it either).
- Deploy-order dependency (position NULL until backfill runs -> all agent counts read 0) already logged as sec-1 LOW; unchanged.
